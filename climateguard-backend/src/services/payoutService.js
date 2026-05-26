import { db } from '../data/store.js'
import { getPoolBalance } from './poolService.js'

// 核心 payout 邏輯
// 對應前端 triggerPayout()，但加上準備金保護
export function executePayout(eventId, rainfall) {
  const event = db.events.find((e) => e.id === Number(eventId))
  if (!event) throw new Error(`Event ${eventId} not found`)

  const threshold = Number(event.threshold)
  const isTriggered = Number(rainfall) >= threshold

  // 雨量未達門檻，記錄後返回
  if (!isTriggered) {
    const record = {
      id: Date.now(),
      eventId: event.id,
      eventName: event.name,
      vendor: '-',
      rainfall: Number(rainfall),
      threshold,
      amount: 0,
      status: 'Not triggered',
      payoutRatio: 0,
      createdAt: new Date().toISOString()
    }
    db.payoutHistory.unshift(record)
    return { triggered: false, rainfall, threshold, payouts: [] }
  }

  // 取得該活動 active policies
  const eligiblePolicies = db.policies.filter(
    (p) => p.eventId === Number(eventId) && p.status === 'Active'
  )
  if (eligiblePolicies.length === 0) {
    return { triggered: true, rainfall, threshold, payouts: [], message: 'No eligible policies' }
  }

  // 計算可動用資金（扣除準備金）
  const poolBalance = getPoolBalance()
  const reserveRatio = db.settings.reserveRatio / 100
  const maxAvailable = Math.max(poolBalance * (1 - reserveRatio), 0)

  const totalRequired = eligiblePolicies.reduce((sum, p) => sum + Number(p.coverage), 0)
  const payoutRatio = totalRequired > maxAvailable ? maxAvailable / totalRequired : 1

  const newPayouts = eligiblePolicies.map((policy) => {
    const amount = Math.floor(Number(policy.coverage) * payoutRatio)
    return {
      id: Date.now() + policy.id,
      eventId: event.id,
      eventName: event.name,
      vendor: policy.vendor,
      vendorAddress: policy.vendorAddress,
      policyId: policy.id,
      rainfall: Number(rainfall),
      threshold,
      coverage: policy.coverage,
      amount,
      payoutRatio: Math.round(payoutRatio * 100),
      status: payoutRatio >= 1 ? 'Full payout' : 'Proportional payout',
      createdAt: new Date().toISOString()
    }
  })

  // 更新 policy 狀態
  db.policies = db.policies.map((policy) =>
    policy.eventId === Number(eventId) && policy.status === 'Active'
      ? {
          ...policy,
          status: 'Paid',
          paidOut: Math.floor(Number(policy.coverage) * payoutRatio)
        }
      : policy
  )

  // 寫入 payout 歷史
  db.payoutHistory.unshift(...newPayouts)

  return {
    triggered: true,
    rainfall: Number(rainfall),
    threshold,
    payoutRatio: Math.round(payoutRatio * 100),
    totalPaidOut: newPayouts.reduce((s, p) => s + p.amount, 0),
    payouts: newPayouts
  }
}
