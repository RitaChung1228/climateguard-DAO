# ClimateGuard DAO

**Web3 Parametric Mutual Aid Pool for Climate Risk**

去中心化的戶外活動氣候風險保障平台。主辦方建立活動資金池，攤商加入保障方案，降雨超過門檻時智能合約自動理賠。

---



### 環境需求

- Node.js 18+
- [MetaMask](https://metamask.io/) 瀏覽器擴充套件

### 1.啟動前端

cd climateguard-DAO/climateguard-frontend
npm install
npm run dev
```

瀏覽器開啟 `http://localhost:5173`

> **後端不需要啟動**。資料直接從 Sepolia 鏈上讀取。

---

### 2. MetaMask 設定

1. 安裝 MetaMask：https://metamask.io/
2. 在 MetaMask 切換網路到 **Sepolia testnet**（內建，直接選）
3. 去 faucet 領 Sepolia ETH（用來付 gas）：
   - https://faucets.chain.link/sepolia
   - https://sepoliafaucet.com

---

### 3. 領取測試代幣 mUSDC

平台使用 mUSDC 作為支付代幣（模擬台幣）。**每個人第一次使用前需要執行一次**：

```bash
cd climateguard-contracts
npm install
node -e "
const { ethers } = require('./node_modules/ethers');
const ABI = ['function faucet(uint256 amount) external'];
const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
const wallet = new ethers.Wallet('你的私鑰', provider);
const usdc = new ethers.Contract('0xBD03BcD517c021f8B2Ba4261Ff25012a1EE03DC0', ABI, wallet);
usdc.faucet(ethers.parseEther('100000')).then(tx => tx.wait()).then(() => console.log('Got 100,000 mUSDC!')).catch(console.error);
"
```

將 `你的私鑰` 換成 MetaMask 的私鑰（MetaMask → Account details → Show private key）。

領一次 100,000 mUSDC，之後不需要再領（除非花完）。

---

### 4. 連接錢包

在網頁右上角點 **Connect Wallet**，MetaMask 會自動切換到 Sepolia。

---

## 操作說明

### 角色切換

| 按鈕 | 進入介面 |
|---|---|
| （預設首頁） | 攤商介面 |
| **Create Event** | 主辦方介面 |
| **ClimateGuard Dashboard** | 平台監控介面 |

---

### 攤商（Vendor）

1. 在首頁選擇活動
2. 選擇 Basic（NT$300）或 Standard（NT$500）方案
3. 輸入攤位名稱，點 **Join Protection Plan**
4. MetaMask 會跳出兩筆交易：
   - Step 1：Approve mUSDC（授權合約扣款）
   - Step 2：加入方案

---

### 主辦方（Organizer）

1. 點右上角 **Create Event**
2. 填寫活動資訊與降雨門檻
3. 點 **Create Event**，MetaMask 跳出兩筆交易：
   - Step 1：Approve mUSDC
   - Step 2：建立活動（organizer contribution 存入合約）

---

### 平台（ClimateGuard Dashboard）

- **Dashboard**：查看所有活動資金池狀態
- **Oracle / Payout**：輸入 mock 降雨量，觸發自動理賠
- **DAO Governance**：提案調整門檻，投票，執行

---

## 智能合約地址（Sepolia）

| 合約 | 地址 |
|---|---|
| MockUSDC | `0xBD03BcD517c021f8B2Ba4261Ff25012a1EE03DC0` |
| ClimateGuardPool | `0xacA806D974264BEded8DbfEe35212a0576C6463e` |
| ClimateGuardDAO | `0x4269E8083439EfC4ACF927831A5b5bef6B2cf8dD` |

---

## 保障方案

| 方案 | Contribution | 保障額度 |
|---|---|---|
| Basic | NT$300 | NT$800 |
| Standard | NT$500 | NT$1,500 |

兩個方案都享有：DAO 治理參與、即時自動理賠。

---

## Pool Health 說明

```
Health = Pool Balance / Total Coverage × 100%
```

| 狀態 | 條件 |
|---|---|
| ✅ Healthy | ≥ 120% |
| ⚠️ Warning | 80–119% |
| 🔴 Underfunded | < 80% |

準備金比例預設 20%（DAO 可調整），每次 payout 保留 20% 不動用。

---

## 專案架構

```
climateguard-DAO/
├── climateguard-frontend/      # React + Vite 前端
│   └── src/contracts/          # ABI + 合約地址
├── climateguard-contracts/     # Solidity + Hardhat
│   ├── contracts/
│   │   ├── ClimateGuardPool.sol
│   │   ├── ClimateGuardDAO.sol
│   │   └── MockUSDC.sol
│   └── scripts/deploy.js
└── climateguard-backend/       # 舊版 API（已不使用）
```

---

## 技術棧

| 層 | 技術 |
|---|---|
| 前端 | React 18 + Vite + ethers.js |
| 智能合約 | Solidity 0.8.20 + Hardhat |
| 測試網 | Ethereum Sepolia |
| 錢包 | MetaMask |
