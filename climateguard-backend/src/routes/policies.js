import { Router } from 'express'
import { db } from '../data/store.js'
import { getPoolBalance, getTotalActiveCoverage, getPoolHealth, getPoolSummary } from '../services/poolService.js'

const router = Router()

// GET /api/policies - 列出所有保單
router.get('/', (req, res) => {
  const { eventId, status } = req.query
  let result = db.policies

  if (eventId) result = result.filter((p) => p.eventId === Number(eventId))
  if (status) result = result.filter((p) => p.status === status)

  res.json({ success: true, data: result })
})

// GET /api/policies/pool - 取得 pool 統計
router.get('/pool', (req, res) => {
  res.json({ success: true, data: getPoolSummary() })
})

// GET /api/policies/plans - 取得可選方案
router.get('/plans', (req, res) => {
  res.json({ success: true, data: db.settings.plans })
})

// POST /api/policies - 攤商加入保護方案
router.post('/', (req, res) => {
  const { vendor, vendorAddress, eventId, plan } = req.body

  if (!vendor || !eventId || !plan) {
    return res.status(400).json({ success: false, message: '缺少必要欄位' })
  }

  const selectedPlan = db.settings.plans.find((p) => p.id === plan)
  if (!selectedPlan) {
    return res.status(400).json({ success: false, message: `方案 ${plan} 不存在` })
  }

  const event = db.events.find((e) => e.id === Number(eventId))
  if (!event) {
    return res.status(404).json({ success: false, message: 'Event not found' })
  }

  const newPolicy = {
    id: db.policies.length > 0 ? Math.max(...db.policies.map((p) => p.id)) + 1 : 1,
    vendor,
    vendorAddress: vendorAddress || 'unknown',
    eventId: Number(eventId),
    plan: selectedPlan.id,
    contribution: selectedPlan.contribution,
    coverage: selectedPlan.coverage,
    status: 'Active',
    paidOut: 0,
    createdAt: new Date().toISOString()
  }

  db.policies.push(newPolicy)
  res.status(201).json({ success: true, data: newPolicy })
})

export default router
