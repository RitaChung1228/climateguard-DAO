import axios from 'axios'
import { config } from '../config/index.js'
import { db, locationStationMap } from '../data/store.js'

// 中央氣象署 API - 取得測站 24 小時累積雨量
async function fetchRainfallFromCWA(stationId) {
  const url = 'https://opendata.cwa.gov.tw/api/v1/rest/datastore/O-A0002-001'
  const res = await axios.get(url, {
    params: {
      Authorization: config.cwaApiKey,
      StationId: stationId,
      WeatherElement: 'Now'
    },
    timeout: 8000
  })

  const stations = res.data?.records?.Station
  if (!stations || stations.length === 0) throw new Error('No station data returned')

  const station = stations[0]
  // 24小時累積雨量
  const rainfall = parseFloat(
    station.WeatherElement?.Now?.Precipitation ?? station.WeatherElement?.Daily?.Precipitation ?? 0
  )

  return {
    stationId,
    stationName: station.StationName,
    rainfall,
    observedAt: station.ObsTime?.DateTime ?? new Date().toISOString(),
    source: 'CWA'
  }
}

// Mock oracle - 產生隨機或指定雨量 (MVP 展示用)
function fetchRainfallMock(stationId, mockValue = null) {
  const rainfall = mockValue !== null ? mockValue : Math.floor(Math.random() * 400)
  return {
    stationId,
    stationName: `Mock Station (${stationId})`,
    rainfall,
    observedAt: new Date().toISOString(),
    source: 'Mock'
  }
}

// 主要入口：根據 config 決定用真實 API 或 mock
export async function queryRainfall(location, mockValue = null) {
  const stationId = locationStationMap[location] || locationStationMap['Taipei']

  if (config.useMockOracle || !config.cwaApiKey) {
    return fetchRainfallMock(stationId, mockValue)
  }

  try {
    return await fetchRainfallFromCWA(stationId)
  } catch (err) {
    console.warn(`[Oracle] CWA API failed, falling back to mock: ${err.message}`)
    return fetchRainfallMock(stationId, mockValue)
  }
}

// 記錄 oracle 查詢結果
export function recordOracleResult(eventId, data) {
  const record = {
    id: Date.now(),
    eventId,
    ...data,
    recordedAt: new Date().toISOString()
  }
  db.oracleRecords.unshift(record)
  return record
}
