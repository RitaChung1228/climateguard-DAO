import { ethers } from 'ethers'
import { ADDRESSES, CHAIN_ID } from './addresses.js'
import PoolABI from './ClimateGuardPool.abi.json'
import DAOABI  from './ClimateGuardDAO.abi.json'
import USDCABI from './MockUSDC.abi.json'

// Read-only provider (no wallet needed for reading data)
export const readProvider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com')

export function getContracts(signerOrProvider) {
  return {
    pool: new ethers.Contract(ADDRESSES.ClimateGuardPool, PoolABI, signerOrProvider),
    dao:  new ethers.Contract(ADDRESSES.ClimateGuardDAO,  DAOABI,  signerOrProvider),
    usdc: new ethers.Contract(ADDRESSES.MockUSDC,         USDCABI, signerOrProvider),
  }
}

// Load all on-chain data and return formatted objects
export async function loadChainData(pool, dao) {
  // Events
  const eventCount = Number(await pool.eventCount())
  const eventsData = []
  for (let i = 1; i <= eventCount; i++) {
    const e = await pool.events(i)
    eventsData.push({
      id:                  Number(e.id),
      name:                e.name,
      location:            e.location,
      date:                e.date,
      threshold:           Number(e.threshold),
      organizer:           e.organizer,
      poolBalance:         Number(ethers.formatEther(e.poolBalance)),
      totalActiveCoverage: Number(ethers.formatEther(e.totalActiveCoverage)),
      status:              ['Active', 'PayoutTriggered', 'Closed'][Number(e.status)],
    })
  }

  // Policies
  const policyCount = Number(await pool.policyCount())
  const policiesData = []
  for (let i = 1; i <= policyCount; i++) {
    const p = await pool.policies(i)
    policiesData.push({
      id:           Number(p.id),
      eventId:      Number(p.eventId),
      vendor:       p.vendorName,
      vendorAddress:p.vendor,
      plan:         p.planId,
      contribution: Number(ethers.formatEther(p.contribution)),
      coverage:     Number(ethers.formatEther(p.coverage)),
      status:       Number(p.status) === 0 ? 'Active' : 'PaidOut',
      paidOut:      Number(ethers.formatEther(p.paidOut)),
    })
  }

  // Payout records
  const recordIds = await pool.getPayoutRecordIds()
  const payoutsData = []
  for (const id of recordIds) {
    const r = await pool.payoutRecords(id)
    payoutsData.push({
      id:        Number(r.id),
      eventId:   Number(r.eventId),
      vendor:    r.vendorName,
      rainfall:  Number(r.rainfall),
      threshold: Number(r.threshold),
      coverage:  Number(ethers.formatEther(r.coverage)),
      amount:    Number(ethers.formatEther(r.amount)),
    })
  }

  // Proposals
  const proposalCount = Number(await dao.proposalCount())
  const proposalsData = []
  for (let i = 1; i <= proposalCount; i++) {
    const p = await dao.proposals(i)
    proposalsData.push({
      id:          Number(p.id),
      eventId:     Number(p.eventId),
      description: p.description,
      newValue:    Number(p.newValue),
      votesYes:    Number(p.votesYes),
      votesNo:     Number(p.votesNo),
      status:      ['Active', 'Passed', 'Rejected', 'Executed'][Number(p.status)],
    })
  }

  return { eventsData, policiesData, payoutsData, proposalsData }
}
