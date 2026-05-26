import { Router } from 'express'
import { db } from '../data/store.js'
import { queryRainfall, recordOracleResult } from '../services/oracleService.js'
import { executePayout } from '../services/payoutService.js'

const router = Router()

// GET /api/oracle/rainfall/:eventId - 查詢活動地點當前雨量
router.get('/rainfall/:eventId', async (req, res) => {
  const event = db.events.find((e) => e.id === Number(req.params.eventId))
  if (!event) return res.status(404).json({ success: false, message: 'Event not found' })

  try {
    const data = await queryRainfall(event.location)
    const record = recordOracleResult(event.id, data)
    res.json({ success: true, data: record })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// POST /api/oracle/trigger - 手動觸發 oracle + payout
// Body: { eventId, mockRainfall? }
router.post('/trigger', async (req, res) => {
  const { eventId, mockRainfall } = req.body

  if (!eventId) return res.status(400).json({ success: false, message: '缺少 eventId' })

  const event = db.events.find((e) => e.id === Number(eventId))
  if (!event) return res.status(404).json({ success: false, message: 'Event not found' })

  try {
    // 1. 查詢雨量
    const oracleData = await queryRainfall(
      event.location,
      mockRainfall !== undefined ? Number(mockRainfall) : null
    )
    recordOracleResult(event.id, oracleData)

    // 2. 執行 payout 判斷
    const result = executePayout(event.id, oracleData.rainfall)

    res.json({
      success: true,
      data: {
        oracle: oracleData,
        payout: result
      }
    })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// GET /api/oracle/history - 查詢 oracle 紀錄
router.get('/history', (req, res) => {
  res.json({ success: true, data: db.oracleRecords.slice(0, 20) })
})

// GET /api/oracle/payouts - 查詢 payout 歷史
router.get('/payouts', (req, res) => {
  const { eventId } = req.query
  let data = db.payoutHistory
  if (eventId) data = data.filter((p) => p.eventId === Number(eventId))
  res.json({ success: true, data: data.slice(0, 50) })
})

export default router
