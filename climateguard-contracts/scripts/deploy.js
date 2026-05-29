const { ethers } = require("hardhat")

async function main() {
  const [deployer, alice, bob, carol] = await ethers.getSigners()
  console.log("Deploying with:", deployer.address)

  // 1. MockUSDC
  const MockUSDC = await ethers.getContractFactory("MockUSDC")
  const usdc = await MockUSDC.deploy()
  await usdc.waitForDeployment()
  console.log("MockUSDC:        ", await usdc.getAddress())

  // 2. ClimateGuardPool
  const Pool = await ethers.getContractFactory("ClimateGuardPool")
  const pool = await Pool.deploy(await usdc.getAddress())
  await pool.waitForDeployment()
  console.log("ClimateGuardPool:", await pool.getAddress())

  // 3. ClimateGuardDAO
  const DAO = await ethers.getContractFactory("ClimateGuardDAO")
  const dao = await DAO.deploy(await pool.getAddress())
  await dao.waitForDeployment()
  console.log("ClimateGuardDAO: ", await dao.getAddress())

  // 4. 將 DAO 地址設定到 Pool，讓 DAO 有權呼叫 updateThreshold / updateReserveRatio
  await pool.setDAO(await dao.getAddress())
  console.log("DAO wired to Pool ✓")

  // 5. 給部署者 mint mUSDC
  const MINT = ethers.parseEther("100000") // 100,000 mUSDC
  await usdc.mint(deployer.address, MINT)
  console.log(`Minted 100,000 mUSDC → deployer (${deployer.address})`)

  console.log("\n─────── Deployment Summary ───────")
  console.log("MockUSDC:        ", await usdc.getAddress())
  console.log("ClimateGuardPool:", await pool.getAddress())
  console.log("ClimateGuardDAO: ", await dao.getAddress())
  console.log("──────────────────────────────────")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
