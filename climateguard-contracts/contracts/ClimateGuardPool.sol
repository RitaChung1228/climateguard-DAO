// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ClimateGuardPool
/// @notice 核心合約：管理活動建立、攤商保單、各活動獨立資金池，以及 Oracle payout 執行
///
/// 資金池設計：
///   每個活動 (OutdoorEvent) 有自己獨立的 poolBalance 與 totalActiveCoverage
///   poolBalance = organizerContribution + sum(vendorContributions) - sum(paidOut)
///   Pool Health  = poolBalance / totalActiveCoverage * 100  (%)
///
/// Payout 邏輯：
///   available = poolBalance * (100 - reserveRatio) / 100
///   若 available >= totalRequired → 全額理賠 (payoutRatio = 100%)
///   若 available <  totalRequired → 按比例理賠 (proportional payout)

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract ClimateGuardPool {

    // ─────────────────────────── Roles ────────────────────────────────

    address public owner;
    address public oracle;  // 有權呼叫 triggerPayout
    address public dao;     // 有權更新 threshold / reserveRatio

    // ─────────────────────────── Config ───────────────────────────────

    IERC20 public token;
    uint256 public reserveRatio = 20; // 準備金比例 (%)，預設 20

    // ─────────────────────────── Types ────────────────────────────────

    enum EventStatus  { Active, PayoutTriggered, Closed }
    enum PolicyStatus { Active, PaidOut }

    struct Plan {
        uint256 contribution; // 攤商需繳金額 (token 最小單位)
        uint256 coverage;     // 理賠上限
    }

    /// @dev 對應前端 event 物件
    struct OutdoorEvent {
        uint256 id;
        string  name;
        string  location;
        string  date;
        uint256 threshold;              // 觸發門檻 (mm)
        address organizer;
        uint256 poolBalance;            // 此活動目前資金
        uint256 totalActiveCoverage;    // 有效保障總額
        EventStatus status;
    }

    /// @dev 對應前端 policy 物件
    struct Policy {
        uint256 id;
        uint256 eventId;
        address vendor;
        string  vendorName;
        string  planId;
        uint256 contribution;
        uint256 coverage;
        PolicyStatus status;
        uint256 paidOut;  // 實際理賠金額
    }

    struct PayoutRecord {
        uint256 id;
        uint256 eventId;
        uint256 policyId;
        address vendor;
        string  vendorName;
        uint256 rainfall;
        uint256 threshold;
        uint256 coverage;
        uint256 amount;
        uint256 payoutRatioPct; // 0–100
        uint256 timestamp;
    }

    // ─────────────────────────── Storage ──────────────────────────────

    uint256 public eventCount;
    uint256 public policyCount;
    uint256 public payoutRecordCount;

    mapping(uint256 => OutdoorEvent)  public events;
    mapping(uint256 => Policy)        public policies;
    mapping(uint256 => uint256[])     public eventPolicies;   // eventId → policyId[]
    mapping(uint256 => PayoutRecord)  public payoutRecords;
    uint256[] public payoutRecordIds;

    // planId hash → Plan
    mapping(bytes32 => Plan)  internal _plans;
    string[] public planIds;

    // ─────────────────────────── Events ───────────────────────────────

    event EventCreated(uint256 indexed eventId, string name, address organizer, uint256 threshold);
    event PolicyCreated(uint256 indexed policyId, uint256 indexed eventId, address vendor, string planId);
    event PayoutExecuted(uint256 indexed eventId, uint256 rainfall, uint256 totalPaidOut, uint256 payoutRatioPct);
    event PayoutNotTriggered(uint256 indexed eventId, uint256 rainfall, uint256 threshold);
    event ThresholdUpdated(uint256 indexed eventId, uint256 oldThreshold, uint256 newThreshold);
    event ReserveRatioUpdated(uint256 oldRatio, uint256 newRatio);

    // ─────────────────────────── Modifiers ────────────────────────────

    modifier onlyOwner()  { require(msg.sender == owner,  "Not owner");  _; }
    modifier onlyOracle() { require(msg.sender == oracle || msg.sender == owner, "Not oracle"); _; }
    modifier onlyDAO()    { require(msg.sender == dao    || msg.sender == owner, "Not DAO");    _; }

    // ─────────────────────────── Constructor ──────────────────────────

    constructor(address _token) {
        owner  = msg.sender;
        oracle = msg.sender;
        token  = IERC20(_token);

        // 預設方案 (對應 backend store.js + 前端方案選單)
        _addPlan("basic",    300  * 1e18, 800   * 1e18);
        _addPlan("standard", 500  * 1e18, 1500  * 1e18);
        _addPlan("premium",  3500 * 1e18, 20000 * 1e18);
    }

    function _addPlan(string memory id, uint256 contribution, uint256 coverage) internal {
        bytes32 key = keccak256(bytes(id));
        require(_plans[key].contribution == 0, "Plan already exists");
        _plans[key] = Plan(contribution, coverage);
        planIds.push(id);
    }

    // ─────────────────────────── Admin ────────────────────────────────

    function setOracle(address _oracle) external onlyOwner { oracle = _oracle; }
    function setDAO(address _dao)       external onlyOwner { dao = _dao; }

    // ─────────────────────────── Organizer ────────────────────────────

    /// @notice 主辦方建立活動，同時將 organizerContribution 存入此活動的資金池
    /// @dev    呼叫前需先 token.approve(poolAddress, organizerContribution)
    function createEvent(
        string calldata name,
        string calldata location,
        string calldata date,
        uint256 threshold,
        uint256 organizerContribution
    ) external returns (uint256 eventId) {
        require(organizerContribution > 0, "Organizer must contribute");
        require(
            token.transferFrom(msg.sender, address(this), organizerContribution),
            "Token transfer failed"
        );

        eventId = ++eventCount;
        events[eventId] = OutdoorEvent({
            id:                   eventId,
            name:                 name,
            location:             location,
            date:                 date,
            threshold:            threshold,
            organizer:            msg.sender,
            poolBalance:          organizerContribution,
            totalActiveCoverage:  0,
            status:               EventStatus.Active
        });

        emit EventCreated(eventId, name, msg.sender, threshold);
    }

    // ─────────────────────────── Vendor ───────────────────────────────

    /// @notice 攤商加入保護方案，contribution 進入對應活動的資金池
    /// @dev    呼叫前需先 token.approve(poolAddress, plan.contribution)
    function joinPlan(
        uint256 eventId,
        string calldata vendorName,
        string calldata planId
    ) external returns (uint256 policyId) {
        OutdoorEvent storage ev = events[eventId];
        require(ev.id != 0, "Event not found");
        require(ev.status == EventStatus.Active, "Event not active");

        Plan memory plan = _plans[keccak256(bytes(planId))];
        require(plan.contribution > 0, "Invalid plan");

        require(
            token.transferFrom(msg.sender, address(this), plan.contribution),
            "Token transfer failed"
        );

        policyId = ++policyCount;
        policies[policyId] = Policy({
            id:           policyId,
            eventId:      eventId,
            vendor:       msg.sender,
            vendorName:   vendorName,
            planId:       planId,
            contribution: plan.contribution,
            coverage:     plan.coverage,
            status:       PolicyStatus.Active,
            paidOut:      0
        });

        ev.poolBalance         += plan.contribution;
        ev.totalActiveCoverage += plan.coverage;
        eventPolicies[eventId].push(policyId);

        emit PolicyCreated(policyId, eventId, msg.sender, planId);
    }

    // ─────────────────────────── Oracle ───────────────────────────────

    /// @notice Oracle 送入降雨量，自動判斷是否觸發理賠
    /// @param  eventId      目標活動 ID
    /// @param  mockRainfall 降雨量 (mm)，正式版改為 Chainlink Oracle 回傳值
    function triggerPayout(uint256 eventId, uint256 mockRainfall) external onlyOracle {
        OutdoorEvent storage ev = events[eventId];
        require(ev.id != 0, "Event not found");
        require(ev.status == EventStatus.Active, "Event not active");

        // 未達門檻，不執行理賠
        if (mockRainfall < ev.threshold) {
            emit PayoutNotTriggered(eventId, mockRainfall, ev.threshold);
            return;
        }

        // 計算此活動可用資金（扣除準備金）
        uint256 available     = ev.poolBalance * (100 - reserveRatio) / 100;
        uint256 totalRequired = 0;

        uint256[] storage pIds = eventPolicies[eventId];
        for (uint256 i = 0; i < pIds.length; i++) {
            if (policies[pIds[i]].status == PolicyStatus.Active) {
                totalRequired += policies[pIds[i]].coverage;
            }
        }

        if (totalRequired == 0) {
            ev.status = EventStatus.PayoutTriggered;
            return;
        }

        // payoutRatioPct: 0–100，超額時按比例縮減
        uint256 payoutRatioPct = totalRequired <= available
            ? 100
            : (available * 100) / totalRequired;

        uint256 totalPaidOut = 0;

        for (uint256 i = 0; i < pIds.length; i++) {
            Policy storage policy = policies[pIds[i]];
            if (policy.status != PolicyStatus.Active) continue;

            uint256 amount = (policy.coverage * payoutRatioPct) / 100;

            // 更新 policy
            policy.status  = PolicyStatus.PaidOut;
            policy.paidOut = amount;

            // 更新 event pool
            ev.poolBalance         -= amount;
            ev.totalActiveCoverage -= policy.coverage;
            totalPaidOut           += amount;

            // 記錄理賠
            uint256 recId = ++payoutRecordCount;
            payoutRecords[recId] = PayoutRecord({
                id:             recId,
                eventId:        eventId,
                policyId:       policy.id,
                vendor:         policy.vendor,
                vendorName:     policy.vendorName,
                rainfall:       mockRainfall,
                threshold:      ev.threshold,
                coverage:       policy.coverage,
                amount:         amount,
                payoutRatioPct: payoutRatioPct,
                timestamp:      block.timestamp
            });
            payoutRecordIds.push(recId);

            // 轉帳給攤商
            if (amount > 0) {
                require(token.transfer(policy.vendor, amount), "Payout transfer failed");
            }
        }

        ev.status = EventStatus.PayoutTriggered;
        emit PayoutExecuted(eventId, mockRainfall, totalPaidOut, payoutRatioPct);
    }

    // ─────────────────────────── DAO ──────────────────────────────────

    /// @notice 調整活動降雨門檻（由 DAO 提案執行後呼叫）
    function updateThreshold(uint256 eventId, uint256 newThreshold) external onlyDAO {
        OutdoorEvent storage ev = events[eventId];
        require(ev.id != 0, "Event not found");
        uint256 old = ev.threshold;
        ev.threshold = newThreshold;
        emit ThresholdUpdated(eventId, old, newThreshold);
    }

    /// @notice 調整全域準備金比例（由 DAO 提案執行後呼叫）
    function updateReserveRatio(uint256 newRatio) external onlyDAO {
        require(newRatio <= 50, "Reserve ratio cannot exceed 50%");
        uint256 old = reserveRatio;
        reserveRatio = newRatio;
        emit ReserveRatioUpdated(old, newRatio);
    }

    // ─────────────────────────── View ─────────────────────────────────

    /// @notice 取得活動資金池健康度 (%)
    function getEventPoolHealth(uint256 eventId) external view returns (uint256) {
        OutdoorEvent storage ev = events[eventId];
        if (ev.totalActiveCoverage == 0) return 200; // 無保障需求視為 Healthy
        return (ev.poolBalance * 100) / ev.totalActiveCoverage;
    }

    function getEventPolicies(uint256 eventId) external view returns (uint256[] memory) {
        return eventPolicies[eventId];
    }

    function getPlan(string calldata planId) external view returns (uint256 contribution, uint256 coverage) {
        Plan memory p = _plans[keccak256(bytes(planId))];
        return (p.contribution, p.coverage);
    }

    function getAllPlanIds() external view returns (string[] memory) {
        return planIds;
    }

    function getPayoutRecordIds() external view returns (uint256[] memory) {
        return payoutRecordIds;
    }
}
