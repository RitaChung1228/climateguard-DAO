import dotenv from 'dotenv'
dotenv.config()

export const config = {
  port: process.env.PORT || 3001,
  cwaApiKey: process.env.CWA_API_KEY || '',
  useMockOracle: process.env.USE_MOCK_ORACLE !== 'false',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173'
}
