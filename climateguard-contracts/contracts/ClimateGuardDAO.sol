// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ClimateGuardDAO
/// @notice DAO 治理合約：提案 → 投票 → 執行
///
/// 流程：
///   1. 任何人可以 createProposal()
///   2. 任何地址可以投票 (vote)，每個地址只能投一次
///   3. votesYes >= quorum → 狀態自動變 Passed
///   4. 任何人可以 executeProposal() → 呼叫 Pool 合約執行變更
///
/// 提案類型：
///   Threshold    → 調整特定活動的降雨觸發門檻
///   ReserveRatio → 調整全域準備金比例

interface IClimateGuardPool {
    function updateThreshold(uint256 eventId, uint256 newThreshold) external;
    function updateReserveRatio(uint256 newRatio) external;
}

contract ClimateGuardDAO {

    // ─────────────────────────── Types ────────────────────────────────

    enum ProposalType   { Threshold, ReserveRatio }
    enum ProposalStatus { Active, Passed, Rejected, Executed }

    struct Proposal {
        uint256        id;
        uint256        eventId;      // 0 = 全域提案 (ReserveRatio)
        ProposalType   pType;
        string         description;
        uint256        newValue;
        uint256        votesYes;
        uint256        votesNo;
        ProposalStatus status;
        uint256        createdAt;
        uint256        votingDeadline;
    }

    // ─────────────────────────── Storage ──────────────────────────────

    IClimateGuardPool public pool;
    address public owner;

    uint256 public proposalCount;
    uint256 public votingPeriod = 3 days;

    mapping(uint256 => Proposal)                    public proposals;
    mapping(uint256 => mapping(address => bool))    public hasVoted;

    // ─────────────────────────── Events ───────────────────────────────

    event ProposalCreated(
        uint256 indexed proposalId,
        ProposalType    pType,
        uint256         eventId,
        string          description,
        uint256         newValue
    );
    event Voted(
        uint256 indexed proposalId,
        address indexed voter,
        bool            support,
        uint256         votesYes,
        uint256         votesNo
    );
    event ProposalPassed(uint256 indexed proposalId);
    event ProposalRejected(uint256 indexed proposalId);
    event ProposalExecuted(uint256 indexed proposalId, ProposalType pType, uint256 newValue);

    // ─────────────────────────── Modifiers ────────────────────────────

    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }

    // ─────────────────────────── Constructor ──────────────────────────

    constructor(address poolAddress) {
        owner = msg.sender;
        pool  = IClimateGuardPool(poolAddress);
    }

    // ─────────────────────────── Core ─────────────────────────────────

    /// @notice 建立提案
    /// @param eventId  活動 ID；ReserveRatio 提案傳 0
    /// @param pType    ProposalType.Threshold 或 ProposalType.ReserveRatio
    /// @param description  顯示給使用者的描述文字
    /// @param newValue 新數值（門檻 mm 或準備金 %）
    function createProposal(
        uint256      eventId,
        ProposalType pType,
        string calldata description,
        uint256      newValue
    ) external returns (uint256 proposalId) {
        proposalId = ++proposalCount;
        proposals[proposalId] = Proposal({
            id:            proposalId,
            eventId:       eventId,
            pType:         pType,
            description:   description,
            newValue:      newValue,
            votesYes:      0,
            votesNo:       0,
            status:        ProposalStatus.Active,
            createdAt:     block.timestamp,
            votingDeadline: block.timestamp + votingPeriod
        });

        emit ProposalCreated(proposalId, pType, eventId, description, newValue);
    }

    /// @notice 對提案投票
    /// @param proposalId 提案 ID
    /// @param support    true = 贊成, false = 反對
    function vote(uint256 proposalId, bool support) external {
        Proposal storage p = proposals[proposalId];
        require(p.id != 0,                               "Proposal not found");
        require(p.status == ProposalStatus.Active,       "Not active");
        require(block.timestamp <= p.votingDeadline,     "Voting period ended");
        require(!hasVoted[proposalId][msg.sender],       "Already voted");

        hasVoted[proposalId][msg.sender] = true;

        if (support) p.votesYes++;
        else         p.votesNo++;

        emit Voted(proposalId, msg.sender, support, p.votesYes, p.votesNo);
    }

    /// @notice 投票期結束後，任何人可呼叫此函式結算結果
    /// @dev    yes > no → Passed；otherwise → Rejected（平票算否決）
    function finalizeProposal(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        require(p.id != 0,                           "Proposal not found");
        require(p.status == ProposalStatus.Active,   "Not active");
        require(block.timestamp > p.votingDeadline,  "Voting still ongoing");

        if (p.votesYes > p.votesNo) {
            p.status = ProposalStatus.Passed;
            emit ProposalPassed(proposalId);
        } else {
            p.status = ProposalStatus.Rejected;
            emit ProposalRejected(proposalId);
        }
    }

    /// @notice 執行已通過的提案，呼叫 Pool 合約變更參數
    function executeProposal(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        require(p.id != 0,                         "Proposal not found");
        require(p.status == ProposalStatus.Passed, "Not passed");

        p.status = ProposalStatus.Executed;

        if (p.pType == ProposalType.Threshold) {
            pool.updateThreshold(p.eventId, p.newValue);
        } else if (p.pType == ProposalType.ReserveRatio) {
            pool.updateReserveRatio(p.newValue);
        }

        emit ProposalExecuted(proposalId, p.pType, p.newValue);
    }

    // ─────────────────────────── Admin ────────────────────────────────

    /// @notice 調整投票期限（秒）
    function setVotingPeriod(uint256 period) external onlyOwner {
        votingPeriod = period;
    }

    /// @notice 更換 Pool 合約地址（升級用）
    function setPool(address poolAddress) external onlyOwner {
        pool = IClimateGuardPool(poolAddress);
    }
}
