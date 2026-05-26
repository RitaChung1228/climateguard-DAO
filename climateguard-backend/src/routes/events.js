import { Router } from 'express'
import { db, locationStationMap } from '../data/store.js'

const router = Router()

// GET /api/events - 列出所有活動
router.get('/', (req, res) => {
  res.json({ success: true, data: db.events })
})

// GET /api/events/:id - 取得單一活動
router.get('/:id', (req, res) => {
  const event = db.events.find((e) => e.id === Number(req.params.id))
  if (!event) return res.status(404).json({ success: false, message: 'Event not found' })
  res.json({ success: true, data: event })
})

// POST /api/events - 主辦方建立活動
router.post('/', (req, res) => {
  const { name, location, date, threshold, organizerContribution, organizer } = req.body

  if (!name || !location || !date || !threshold || !organizerContribution) {
    return res.status(400).json({ success: false, message: '缺少必要欄位' })
  }

  const newEvent = {
    id: db.events.length > 0 ? Math.max(...db.events.map((e) => e.id)) + 1 : 1,
    name,
    location,
    stationId: locationStationMap[location] || locationStationMap['Taipei'],
    date,
    threshold: Number(threshold),
    organizerContribution: Number(organizerContribution),
    organizer: organizer || 'unknown',
    status: 'Active',
    createdAt: new Date().toISOString()
  }

  db.events.push(newEvent)
  res.status(201).json({ success: true, data: newEvent })
})

// PATCH /api/events/:id/threshold - DAO 執行後更新門檻
router.patch('/:id/threshold', (req, res) => {
  const { threshold } = req.body
  const event = db.events.find((e) => e.id === Number(req.params.id))
  if (!event) return res.status(404).json({ success: false, message: 'Event not found' })

  event.threshold = Number(threshold)
  res.json({ success: true, data: event })
})

export default router
