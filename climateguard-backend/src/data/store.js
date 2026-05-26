// In-memory store (MVP 階段)
// 未來可替換為 PostgreSQL / MongoDB

export const db = {
  events: [
    {
      id: 1,
      name: '週末文創市集',
      location: 'Taipei',
      stationId: '466920', // 台北測站 (CWA)
      date: '2026-06-10',
      threshold: 200,
      organizerContribution: 12000,
      organizer: '0xOrganizer01',
      status: 'Active'
    }
  ],

  policies: [
    {
      id: 1,
      vendor: 'A01 咖啡攤',
      vendorAddress: '0xVendorA01',
      eventId: 1,
      plan: 'basic',
      contribution: 300,
      coverage: 800,
      status: 'Active',
      paidOut: 0,
      createdAt: new Date().toISOString()
    },
    {
      id: 2,
      vendor: 'B08 手作甜點',
      vendorAddress: '0xVendorB08',
      eventId: 1,
      plan: 'standard',
      contribution: 500,
      coverage: 1500,
      status: 'Active',
      paidOut: 0,
      createdAt: new Date().toISOString()
    }
  ],

  payoutHistory: [],

  // DAO 提案
  proposals: [
    {
      id: 1,
      eventId: 1,
      type: 'threshold',
      description: '將週末文創市集降雨門檻調整為 250mm',
      newValue: 250,
      status: 'Active',
      votesYes: 0,
      votesNo: 0,
      createdAt: new Date().toISOString()
    }
  ],

  // DAO 投票紀錄
  votes: [],

  // Oracle 紀錄
  oracleRecords: [],

  // 全域設定
  settings: {
    reserveRatio: 20, // 準備金比例 %
    plans: [
      { id: 'basic', name: 'Basic Plan', contribution: 300, coverage: 800, desc: '適合小型攤商，提供基礎豪雨補償。' },
      { id: 'standard', name: 'Standard Plan', contribution: 500, coverage: 1500, desc: '適合食物攤商或備貨成本較高的攤位。' }
    ]
  }
}

// CWA 測站對應表 (location -> stationId)
export const locationStationMap = {
  Taipei: '466920',
  Kaohsiung: '467440',
  Taichung: '467490',
  Tainan: '467410',
  Hualien: '466990',
  Keelung: '466940'
}
