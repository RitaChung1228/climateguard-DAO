import { Router } from 'express'
import { db } from '../data/store.js'

const router = Router()

// GET /api/dao/proposals - 列出所有提案
router.get('/proposals', (req, res) => {
  res.json({ success: true, data: db.proposals })
})

// POST /api/dao/proposals - 新增提案
router.post('/proposals', (req, res) => {
  const { eventId, type, description, newValue } = req.body

  if (!type || !description || newValue === undefined) {
    return res.status(400).json({ success: false, message: '缺少必要欄位' })
  }

  const validTypes = ['threshold', 'reserveRatio', 'coverage', 'contribution']
  if (!validTypes.includes(type)) {
    return res.status(400).json({ success: false, message: `無效的提案類型，可用: ${validTypes.join(', ')}` })
  }

  const newProposal = {
    id: db.proposals.length > 0 ? Math.max(...db.proposals.map((p) => p.id)) + 1 : 1,
    eventId: eventId ? Number(eventId) : null,
    type,
    description,
    newValue: Number(newValue),
    status: 'Active',
    votesYes: 0,
    votesNo: 0,
    createdAt: new Date().toISOString()
  }

  db.proposals.push(newProposal)
  res.status(201).json({ success: true, data: newProposal })
})

// POST /api/dao/proposals/:id/vote - 投票
router.post('/proposals/:id/vote', (req, res) => {
  const { vote, voter } = req.body // vote: 'yes' | 'no'
  const proposal = db.proposals.find((p) => p.id === Number(req.params.id))

  if (!proposal) return res.status(404).json({ success: false, message: 'Proposal not found' })
  if (proposal.status !== 'Active') {
    return res.status(400).json({ success: false, message: `提案狀態為 ${proposal.status}，無法投票` })
  }
  if (!['yes', 'no'].includes(vote)) {
    return res.status(400).json({ success: false, message: 'vote 必須是 yes 或 no' })
  }

  // 防止重複投票
  const alreadyVoted = db.votes.find(
    (v) => v.proposalId === proposal.id && v.voter === voter
  )
  if (voter && alreadyVoted) {
    return res.status(400).json({ success: false, message: '已經投過票了' })
  }

  if (vote === 'yes') proposal.votesYes += 1
  else proposal.votesNo += 1

  db.votes.push({ proposalId: proposal.id, voter: voter || 'anonymous', vote, votedAt: new Date().toISOString() })

  res.json({ success: true, data: proposal })
})

// POST /api/dao/proposals/:id/finalize - 結算投票（簡單多數決：yes > no → Passed）
router.post('/proposals/:id/finalize', (req, res) => {
  const proposal = db.proposals.find((p) => p.id === Number(req.params.id))
  if (!proposal) return res.status(404).json({ success: false, message: 'Proposal not found' })
  if (proposal.status !== 'Active') {
    return res.status(400).json({ success: false, message: `提案狀態為 ${proposal.status}，無法結算` })
  }

  if (proposal.votesYes > proposal.votesNo) {
    proposal.status = 'Passed'
  } else {
    proposal.status = 'Rejected'
  }

  res.json({ success: true, data: proposal })
})

// POST /api/dao/proposals/:id/execute - 執行通過的提案
router.post('/proposals/:id/execute', (req, res) => {
  const proposal = db.proposals.find((p) => p.id === Number(req.params.id))
  if (!proposal) return res.status(404).json({ success: false, message: 'Proposal not found' })
  if (proposal.status !== 'Passed') {
    return res.status(400).json({ success: false, message: `提案尚未通過，目前狀態: ${proposal.status}` })
  }

  // 執行提案
  switch (proposal.type) {
    case 'threshold': {
      if (proposal.eventId) {
        const event = db.events.find((e) => e.id === proposal.eventId)
        if (event) event.threshold = proposal.newValue
      }
      break
    }
    case 'reserveRatio': {
      db.settings.reserveRatio = proposal.newValue
      break
    }
    default:
      break
  }

  proposal.status = 'Executed'
  proposal.executedAt = new Date().toISOString()

  res.json({ success: true, data: proposal })
})

// GET /api/dao/settings - 取得全域設定
router.get('/settings', (req, res) => {
  res.json({ success: true, data: db.settings })
})

// PATCH /api/dao/settings - 更新設定 (reserveRatio)
router.patch('/settings', (req, res) => {
  const { reserveRatio } = req.body
  if (reserveRatio !== undefined) {
    db.settings.reserveRatio = Number(reserveRatio)
  }
  res.json({ success: true, data: db.settings })
})

export default router
