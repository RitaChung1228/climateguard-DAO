import express from 'express'
import cors from 'cors'
import { config } from './src/config/index.js'
import eventsRouter from './src/routes/events.js'
import policiesRouter from './src/routes/policies.js'
import oracleRouter from './src/routes/oracle.js'
import daoRouter from './src/routes/dao.js'

const app = express()

app.use(cors({ origin: config.frontendUrl }))
app.use(express.json())

// 健康檢查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API Routes
app.use('/api/events', eventsRouter)
app.use('/api/policies', policiesRouter)
app.use('/api/oracle', oracleRouter)
app.use('/api/dao', daoRouter)

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` })
})

// Error handler
app.use((err, req, res, next) => {
  console.error('[Error]', err)
  res.status(500).json({ success: false, message: err.message || 'Internal server error' })
})

app.listen(config.port, () => {
  console.log(`ClimateGuard Backend running on http://localhost:${config.port}`)
  console.log(`Oracle mode: ${config.useMockOracle ? 'Mock' : 'CWA Live'}`)
})
