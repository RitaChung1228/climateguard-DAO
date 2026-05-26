import { db } from '../data/store.js'

// 計算 pool 總餘額
export function getPoolBalance() {
  const organizerTotal = db.events.reduce((sum, e) => sum + Number(e.organizerContribution), 0)
  const vendorTotal = db.policies.reduce((sum, p) => sum + Number(p.contribution), 0)
  const payoutTotal = db.payoutHistory.reduce((sum, p) => sum + Number(p.amount), 0)
  return organizerTotal + vendorTotal - payoutTotal
}

// 計算有效保障總額
export function getTotalActiveCoverage() {
  return db.policies
    .filter((p) => p.status === 'Active')
    .reduce((sum, p) => sum + Number(p.coverage), 0)
}

// Pool health ratio (%)
export function getPoolHealth() {
  const balance = getPoolBalance()
  const coverage = getTotalActiveCoverage()
  if (coverage === 0) return 0
  return Math.round((balance / coverage) * 100)
}

// 取得 pool 摘要統計
export function getPoolSummary() {
  const balance = getPoolBalance()
  const totalActiveCoverage = getTotalActiveCoverage()
  const poolHealth = getPoolHealth()

  return {
    poolBalance: balance,
    totalActiveCoverage,
    poolHealth,
    poolHealthLabel: poolHealth >= 120 ? 'Healthy' : poolHealth >= 80 ? 'Warning' : 'Underfunded',
    activeVendors: db.policies.filter((p) => p.status === 'Active').length,
    totalEvents: db.events.length,
    reserveRatio: db.settings.reserveRatio
  }
}
