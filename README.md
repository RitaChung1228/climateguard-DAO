# ClimateGuard DAO

**Web3 Parametric Mutual Aid Pool for Climate Risk**
戶外活動氣候風險的 Web3 指數型互助池

---

## 專案背景

台灣每年面臨颱風、豪雨、淹水等極端氣候。大型企業有保險與風險管理機制，但小型攤商、戶外市集、學生社團、地方主辦方幾乎完全暴露在氣候財務風險中。

ClimateGuard DAO 解決的問題：
- 傳統保險理賠不透明、速度慢、規則對小型攤商不友善
- 活動取消後主辦方與攤商之間的信任問題
- 小型攤商無力承擔個別保險成本

---

## 系統架構

```
climateguard DAO/
├── climateguard-frontend/   # React + Vite 前端 (展示 MVP)
└── climateguard-backend/    # Node.js + Express 後端 API
```

### 核心概念

```
主辦方 createEvent()  ──┐
                        ├──> Smart Contract Pool (互助資金池)
攤商   joinPlan()     ──┘
                              │
                    Weather Oracle 查詢 (CWA 氣象 API)
                              │
               rainfall >= threshold ?
                   ┌──── Yes ────┐
              Auto Payout     Not triggered
         (按比例補償所有攤商)
```

### Pool 機制

| 角色 | 貢獻比例 | 說明 |
|------|---------|------|
| 活動主辦方 | 較高 (佔池子主要資金) | 建立活動時一次性投入 |
| 攤商 | 按方案繳費 | Basic NT$300 / Standard NT$500 |

**Pool Health** = 可用資金 / 有效保障總額 × 100%
- ≥ 120% → Healthy
- 80–119% → Warning
- < 80% → Underfunded

**準備金機制**：每次 payout 保留 `reserveRatio%` 不動用（預設 20%），防止資金池被單一事件抽乾。

---

## 技術棧

| 層級 | 技術 |
|------|------|
| 前端 | React 18 + Vite |
| 後端 | Node.js + Express (ESM) |
| 氣象資料 | 中央氣象署 Open Data API / Mock Oracle |
| 智能合約 (規劃中) | Solidity + Hardhat |
| Testnet (規劃中) | Sepolia / Base Sepolia |

---

## 快速啟動

### 環境需求

- Node.js 18+
- npm 9+

### 1. 啟動後端

```bash
cd climateguard-backend

# 設定環境變數 (首次)
cp .env.example .env
# 編輯 .env，填入 CWA_API_KEY (可先維持 USE_MOCK_ORACLE=true)

# 安裝依賴
npm install

# 開發模式 (檔案變更自動重啟)
npm run dev
```

後端啟動後：`http://localhost:3001`

### 2. 啟動前端

開啟另一個終端機視窗：

```bash
cd climateguard-frontend

# 安裝依賴
npm install

# 開發模式
npm run dev
```

前端啟動後：`http://localhost:5173`

---

## 後端 API 文件

Base URL: `http://localhost:3001`

### 系統

| Method | Path | 說明 |
|--------|------|------|
| GET | `/health` | 健康檢查 |

### 活動管理 `/api/events`

| Method | Path | 說明 |
|--------|------|------|
| GET | `/api/events` | 列出所有活動 |
| GET | `/api/events/:id` | 取得單一活動 |
| POST | `/api/events` | 主辦方建立活動 |
| PATCH | `/api/events/:id/threshold` | 更新降雨門檻 |

**POST `/api/events` 範例：**
```json
{
  "name": "週末文創市集",
  "location": "Taipei",
  "date": "2026-06-10",
  "threshold": 200,
  "organizerContribution": 12000,
  "organizer": "0xYourAddress"
}
```

### 保單管理 `/api/policies`

| Method | Path | 說明 |
|--------|------|------|
| GET | `/api/policies` | 列出保單（可篩選 eventId、status） |
| GET | `/api/policies/pool` | Pool 統計（餘額、健康度等） |
| GET | `/api/policies/plans` | 取得可選方案列表 |
| POST | `/api/policies` | 攤商加入保護方案 |

**POST `/api/policies` 範例：**
```json
{
  "vendor": "A01 咖啡攤",
  "vendorAddress": "0xVendorAddress",
  "eventId": 1,
  "plan": "basic"
}
```

方案選項：
- `basic` — 繳 NT$300，保障 NT$800
- `standard` — 繳 NT$500，保障 NT$1500

### Oracle / Payout `/api/oracle`

| Method | Path | 說明 |
|--------|------|------|
| GET | `/api/oracle/rainfall/:eventId` | 查詢活動地點當前雨量 |
| POST | `/api/oracle/trigger` | 觸發 Oracle 並執行 payout 判斷 |
| GET | `/api/oracle/history` | 查詢 Oracle 紀錄 |
| GET | `/api/oracle/payouts` | 查詢 payout 歷史 |

**POST `/api/oracle/trigger` 範例：**
```json
{
  "eventId": 1,
  "mockRainfall": 250
}
```

回應範例（已觸發）：
```json
{
  "success": true,
  "data": {
    "oracle": {
      "stationId": "466920",
      "rainfall": 250,
      "source": "Mock"
    },
    "payout": {
      "triggered": true,
      "rainfall": 250,
      "threshold": 200,
      "payoutRatio": 100,
      "totalPaidOut": 2300,
      "payouts": [...]
    }
  }
}
```

### DAO 治理 `/api/dao`

| Method | Path | 說明 |
|--------|------|------|
| GET | `/api/dao/proposals` | 列出所有提案 |
| POST | `/api/dao/proposals` | 新增提案 |
| POST | `/api/dao/proposals/:id/vote` | 投票 (yes/no) |
| POST | `/api/dao/proposals/:id/execute` | 執行通過的提案 |
| GET | `/api/dao/settings` | 取得全域設定 |
| PATCH | `/api/dao/settings` | 更新設定 |

**POST `/api/dao/proposals` 範例：**
```json
{
  "eventId": 1,
  "type": "threshold",
  "description": "將降雨門檻調整為 250mm",
  "newValue": 250
}
```

提案類型 (`type`)：
- `threshold` — 調整活動降雨門檻
- `reserveRatio` — 調整準備金比例

**POST `/api/dao/proposals/:id/vote` 範例：**
```json
{
  "vote": "yes",
  "voter": "0xYourAddress"
}
```

投票規則：累計 3 票以上且 yes > no → 自動變為 `Passed`，可執行。

---

## 環境變數說明

後端 `climateguard-backend/.env`：

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `PORT` | `3001` | 後端埠號 |
| `CWA_API_KEY` | - | 中央氣象署 API Key |
| `USE_MOCK_ORACLE` | `true` | `true` 使用假資料，`false` 呼叫真實 CWA API |
| `FRONTEND_URL` | `http://localhost:5173` | CORS 允許的前端網址 |

申請 CWA API Key：https://opendata.cwa.gov.tw/userLogin

---

## 支援地點與測站對應

| Location 參數 | 測站 | 測站 ID |
|--------------|------|---------|
| `Taipei` | 台北 | 466920 |
| `Kaohsiung` | 高雄 | 467440 |
| `Taichung` | 台中 | 467490 |
| `Tainan` | 台南 | 467410 |
| `Hualien` | 花蓮 | 466990 |
| `Keelung` | 基隆 | 466940 |

---

## 前端功能頁面

| Tab | 功能 |
|-----|------|
| Dashboard | Pool 統計、活動列表、近期 payout 紀錄 |
| 建立活動 | 主辦方建立戶外活動並設定雨量門檻 |
| 加入方案 | 攤商選擇 Basic / Standard 方案加入保護 |
| Oracle / Payout | Mock oracle 查詢雨量、觸發自動補償 |
| DAO 治理 | 提案、投票、執行門檻與準備金設定 |

---

## 智能合約（規劃中）

未來將部署到 Testnet，核心合約架構：

```
ClimateGuardPool.sol     # 主合約：資金池、payout 邏輯
PolicyManager.sol        # 保單管理
OracleConsumer.sol       # Chainlink Any API 串接
GovernanceDAO.sol        # 提案與投票
```

---

## 應用領域

- **Web3 / Smart Contract** — 自動執行的參數型保障
- **DAO** — 去中心化治理天氣門檻與準備金規則
- **DeFi** — 互助資金池、比例補償機制
- **Climate Finance** — 極端天氣財務風險轉移
- **永續與社會影響** — 保護台灣小型攤商、弱勢族群

---

## 目標用戶

- 小型攤商 / 戶外市集
- 學生社團活動主辦方
- 小農市集
- 地方文創活動主辦方
