import React, { useEffect, useState } from 'react'

const money = (n) => `NT$${Number(n).toLocaleString()}`

const ROLES = [
  { id: 'organizer', label: '廠商', sublabel: '主辦方' },
  { id: 'vendor', label: '攤商', sublabel: '攤位主' },
  { id: 'platform', label: 'ClimateGuard', sublabel: '平台總覽' }
]

const ROLE_TABS = {
  organizer: [
    ['create-event', '建立活動'],
    ['my-events', '我的活動']
  ],
  vendor: [
    ['join-plan', '加入方案'],
    ['my-policies', '我的保單']
  ],
  platform: [
    ['dashboard', 'Dashboard'],
    ['oracle', 'Oracle / Payout'],
    ['dao', 'DAO 治理']
  ]
}

function StatCard({ label, value, note }) {
  return (
    <div className="card stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {note && <div className="stat-note">{note}</div>}
    </div>
  )
}

function Badge({ children, type = 'default' }) {
  return <span className={`badge badge-${type}`}>{children}</span>
}

function Section({ title, subtitle, children }) {
  return (
    <section className="card section">
      <div className="section-head">
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

export default function App() {
  const [role, setRole] = useState('platform')
  const [tab, setTab] = useState('dashboard')
  const [events, setEvents] = useState([])
  const [policies, setPolicies] = useState([])
  const [payoutHistory, setPayoutHistory] = useState([])
  const [plans, setPlans] = useState([])
  const [proposals, setProposals] = useState([])
  const [poolStats, setPoolStats] = useState({
    poolBalance: 0,
    totalActiveCoverage: 0,
    poolHealth: 0,
    poolHealthLabel: 'Healthy',
    activeVendors: 0,
    reserveRatio: 20
  })
  const [rainfall, setRainfall] = useState(230)
  const [selectedEventId, setSelectedEventId] = useState(1)
  const [loading, setLoading] = useState(false)
  const [initLoading, setInitLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const [eventForm, setEventForm] = useState({
    name: '河濱週末市集',
    location: 'Taipei',
    date: '2026-06-24',
    threshold: 200,
    organizerContribution: 10000
  })

  const [vendorForm, setVendorForm] = useState({
    vendor: 'C12 插畫小物攤',
    eventId: 1,
    plan: 'basic'
  })

  const [proposalForm, setProposalForm] = useState({ threshold: 200 })

  useEffect(() => {
    async function init() {
      try {
        await Promise.all([
          fetchEvents(),
          fetchPolicies(),
          fetchPoolStats(),
          fetchPayouts(),
          fetchPlans(),
          fetchProposals()
        ])
      } catch (e) {
        setError('資料載入失敗，請確認後端服務是否啟動。')
      } finally {
        setInitLoading(false)
      }
    }
    init()
  }, [])

  async function fetchEvents() {
    const res = await fetch('/api/events')
    const json = await res.json()
    setEvents(json.data)
    if (json.data.length > 0) setSelectedEventId(json.data[0].id)
  }

  async function fetchPolicies() {
    const res = await fetch('/api/policies')
    const json = await res.json()
    setPolicies(json.data)
  }

  async function fetchPoolStats() {
    const res = await fetch('/api/policies/pool')
    const json = await res.json()
    setPoolStats(json.data)
  }

  async function fetchPayouts() {
    const res = await fetch('/api/oracle/payouts')
    const json = await res.json()
    setPayoutHistory(json.data)
  }

  async function fetchPlans() {
    const res = await fetch('/api/policies/plans')
    const json = await res.json()
    setPlans(json.data)
  }

  async function fetchProposals() {
    const res = await fetch('/api/dao/proposals')
    const json = await res.json()
    setProposals(json.data)
  }

  function showSuccess(msg) {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 3000)
  }

  function switchRole(newRole) {
    setRole(newRole)
    setTab(ROLE_TABS[newRole][0][0])
    setError(null)
    setSuccess(null)
  }

  function calcEventPool(eventId) {
    const event = events.find((e) => e.id === eventId)
    if (!event) return null
    const eventPolicies = policies.filter((p) => p.eventId === eventId)
    const vendorContributions = eventPolicies.reduce((s, p) => s + Number(p.contribution), 0)
    const totalPaidOut = eventPolicies.reduce((s, p) => s + Number(p.paidOut), 0)
    const poolBalance = Number(event.organizerContribution) + vendorContributions - totalPaidOut
    const totalActiveCoverage = eventPolicies
      .filter((p) => p.status === 'Active')
      .reduce((s, p) => s + Number(p.coverage), 0)
    const poolHealth = totalActiveCoverage > 0
      ? Math.round((poolBalance / totalActiveCoverage) * 100)
      : 0
    const poolHealthLabel = poolHealth >= 120 ? 'Healthy' : poolHealth >= 80 ? 'Warning' : 'Underfunded'
    const poolHealthType = poolHealth >= 120 ? 'success' : poolHealth >= 80 ? 'warning' : 'danger'
    const activeVendors = eventPolicies.filter((p) => p.status === 'Active').length
    return { poolBalance, totalActiveCoverage, poolHealth, poolHealthLabel, poolHealthType, activeVendors }
  }

  const selectedEvent = events.find((e) => e.id === Number(selectedEventId)) || events[0]
  const eligiblePolicies = policies.filter(
    (p) => p.eventId === Number(selectedEventId) && p.status === 'Active'
  )

  async function createEvent() {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventForm)
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.message)
      setEvents([...events, json.data])
      setSelectedEventId(json.data.id)
      setVendorForm({ ...vendorForm, eventId: json.data.id })
      await fetchPoolStats()
      showSuccess(`活動「${json.data.name}」建立成功！`)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function joinPlan() {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vendorForm)
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.message)
      setPolicies([...policies, json.data])
      await fetchPoolStats()
      showSuccess(`${json.data.vendor} 已成功加入 ${json.data.plan} 方案！`)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function triggerPayout() {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/oracle/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: selectedEventId, mockRainfall: Number(rainfall) })
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.message)
      await Promise.all([fetchPolicies(), fetchPayouts(), fetchPoolStats()])
      showSuccess('Oracle 執行完成！')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function createProposal() {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/dao/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: selectedEventId,
          type: 'threshold',
          description: `將 ${selectedEvent?.name} 的 rainfall threshold 調整為 ${proposalForm.threshold}mm`,
          newValue: Number(proposalForm.threshold)
        })
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.message)
      await fetchProposals()
      showSuccess('提案已送出！')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function castVote(proposalId, vote) {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`/api/dao/proposals/${proposalId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote })
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.message)
      await fetchProposals()
      showSuccess(`投票成功！(${vote === 'yes' ? '贊成' : '反對'})`)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function finalizeVote(proposalId) {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`/api/dao/proposals/${proposalId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.message)
      await fetchProposals()
      showSuccess(`提案結算完成：${json.data.status}`)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function executeProposal(proposalId) {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`/api/dao/proposals/${proposalId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.message)
      await Promise.all([fetchProposals(), fetchEvents(), fetchPoolStats()])
      showSuccess('提案執行成功！')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (initLoading) {
    return (
      <div className="app">
        <div className="init-loading">資料載入中...</div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="hero">
        <div>
          <div className="eyebrow">Web3 · DAO · DeFi · Climate Finance</div>
          <h1>ClimateGuard DAO</h1>
          <p>戶外活動氣候風險的 Web3 指數型互助池</p>
        </div>
        <div className="role-switcher">
          {ROLES.map((r) => (
            <button
              key={r.id}
              className={`role-btn${role === r.id ? ' active' : ''}`}
              onClick={() => switchRole(r.id)}
            >
              <span className="role-label">{r.label}</span>
              <span className="role-sublabel">{r.sublabel}</span>
            </button>
          ))}
        </div>
      </header>

      <nav className="tabs">
        {ROLE_TABS[role].map(([id, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      {error && <div className="error-banner">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      {/* ── 廠商：建立活動 ── */}
      {tab === 'create-event' && (
        <Section title="建立戶外活動" subtitle="主辦方建立活動，並投入 organizer contribution 到 smart contract pool。">
          <div className="form-grid">
            <label>活動名稱<input value={eventForm.name} onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })} /></label>
            <label>地點<input value={eventForm.location} onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })} /></label>
            <label>日期<input type="date" value={eventForm.date} onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })} /></label>
            <label>降雨觸發門檻 mm<input type="number" value={eventForm.threshold} onChange={(e) => setEventForm({ ...eventForm, threshold: e.target.value })} /></label>
            <label>主辦方 Contribution<input type="number" value={eventForm.organizerContribution} onChange={(e) => setEventForm({ ...eventForm, organizerContribution: e.target.value })} /></label>
          </div>
          <button className="primary-btn" onClick={createEvent} disabled={loading}>
            {loading ? 'Creating...' : 'Create Event'}
          </button>
        </Section>
      )}

      {/* ── 廠商：我的活動 ── */}
      {tab === 'my-events' && (
        <Section title="我的活動" subtitle="查看已建立的活動、各活動的獨立資金池狀態，以及加入的攤商。">
          {events.length === 0 ? (
            <p className="empty">尚未建立任何活動。</p>
          ) : (
            events.map((event) => {
              const eventPolicies = policies.filter((p) => p.eventId === event.id)
              const pool = calcEventPool(event.id)
              return (
                <div className="event-card" key={event.id}>
                  <div className="event-card-header">
                    <div>
                      <strong>{event.name}</strong>
                      <p>{event.location} · {event.date} · Threshold: {event.threshold}mm</p>
                      <p>Organizer Contribution: {money(event.organizerContribution)}</p>
                    </div>
                    <Badge type="info">{event.status}</Badge>
                  </div>

                  {pool && (
                    <div className="event-pool-section">
                      <p className="pool-section-title">資金池狀態</p>
                      <div className="pool-stats-row">
                        <div className="pool-stat">
                          <span>Pool Balance</span>
                          <strong>{money(pool.poolBalance)}</strong>
                        </div>
                        <div className="pool-stat">
                          <span>Coverage</span>
                          <strong>{money(pool.totalActiveCoverage)}</strong>
                        </div>
                        <div className="pool-stat">
                          <span>Vendors</span>
                          <strong>{pool.activeVendors}</strong>
                        </div>
                        <div className="pool-stat">
                          <span>Health</span>
                          <strong>{pool.poolHealth}%</strong>
                        </div>
                      </div>
                      <div className="health-row">
                        <div className="progress" style={{ flex: 1 }}>
                          <div style={{ width: `${Math.min(pool.poolHealth, 160) / 1.6}%` }} />
                        </div>
                        <Badge type={pool.poolHealthType}>{pool.poolHealthLabel}</Badge>
                      </div>
                    </div>
                  )}

                  <div className="event-card-body">
                    <p className="vendors-title">加入攤商（{eventPolicies.length}）</p>
                    {eventPolicies.length === 0 ? (
                      <p className="empty">尚未有攤商加入。</p>
                    ) : (
                      eventPolicies.map((p) => (
                        <div className="list-item" key={p.id}>
                          <div>
                            <strong>{p.vendor}</strong>
                            <p>{p.plan} · Coverage {money(p.coverage)}</p>
                          </div>
                          <Badge type={p.status === 'Active' ? 'success' : 'default'}>{p.status}</Badge>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            })
          )}
        </Section>
      )}

      {/* ── 攤商：加入方案 ── */}
      {tab === 'join-plan' && (
        <Section title="攤商加入 Weather Protection Plan" subtitle="攤商支付小額 contribution，取得較高的氣候風險保障額度。">
          <div className="form-grid">
            <label>攤商名稱<input value={vendorForm.vendor} onChange={(e) => setVendorForm({ ...vendorForm, vendor: e.target.value })} /></label>
            <label>選擇活動
              <select value={vendorForm.eventId} onChange={(e) => setVendorForm({ ...vendorForm, eventId: Number(e.target.value) })}>
                {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </label>
          </div>

          <div className="plan-grid">
            {plans.length === 0 ? (
              <p className="empty">方案載入中...</p>
            ) : (
              plans.map((plan) => (
                <button
                  key={plan.id}
                  className={vendorForm.plan === plan.id ? 'plan selected' : 'plan'}
                  onClick={() => setVendorForm({ ...vendorForm, plan: plan.id })}
                >
                  <strong>{plan.name}</strong>
                  <p>{plan.desc}</p>
                  <span>Pay {money(plan.contribution)} · Coverage {money(plan.coverage)}</span>
                </button>
              ))
            )}
          </div>

          <button className="primary-btn" onClick={joinPlan} disabled={loading}>
            {loading ? 'Joining...' : 'Join Protection Plan'}
          </button>
        </Section>
      )}

      {/* ── 攤商：我的保單 ── */}
      {tab === 'my-policies' && (
        <Section title="我的保單" subtitle="查看目前保障狀態與理賠紀錄。">
          {policies.length === 0 ? (
            <p className="empty">尚未加入任何方案。</p>
          ) : (
            policies.map((p) => {
              const event = events.find((e) => e.id === p.eventId)
              return (
                <div className="list-item" key={p.id}>
                  <div>
                    <strong>{p.vendor}</strong>
                    <p>{event?.name || `活動 #${p.eventId}`} · {p.plan}</p>
                    <p>Contribution {money(p.contribution)} · Coverage {money(p.coverage)}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Badge type={p.status === 'Active' ? 'success' : p.status === 'Paid' ? 'warning' : 'default'}>
                      {p.status}
                    </Badge>
                    {p.paidOut > 0 && <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#666' }}>理賠 {money(p.paidOut)}</p>}
                  </div>
                </div>
              )
            })
          )}

          <h3 style={{ marginTop: '1.5rem' }}>理賠紀錄</h3>
          {payoutHistory.length === 0 ? (
            <p className="empty">尚未有理賠紀錄。</p>
          ) : (
            payoutHistory.slice(0, 10).map((p) => (
              <div className="list-item" key={p.id}>
                <div>
                  <strong>{p.vendor || p.eventName}</strong>
                  <p>Rainfall {p.rainfall}mm / Threshold {p.threshold}mm</p>
                </div>
                <Badge type={p.amount > 0 ? 'success' : 'default'}>{money(p.amount)}</Badge>
              </div>
            ))
          )}
        </Section>
      )}

      {/* ── ClimateGuard：Dashboard ── */}
      {tab === 'dashboard' && (
        <>
          <div className="section-title-row">
            <h2>各活動資金池</h2>
          </div>
          <div className="grid two">
            {events.map((event) => {
              const pool = calcEventPool(event.id)
              if (!pool) return null
              return (
                <div className="card event-pool-card" key={event.id}>
                  <div className="event-pool-card-head">
                    <div>
                      <strong>{event.name}</strong>
                      <p>{event.location} · {event.date} · Threshold {event.threshold}mm</p>
                    </div>
                    <Badge type="info">{event.status}</Badge>
                  </div>
                  <div className="pool-stats-row">
                    <div className="pool-stat">
                      <span>Pool Balance</span>
                      <strong>{money(pool.poolBalance)}</strong>
                    </div>
                    <div className="pool-stat">
                      <span>Coverage</span>
                      <strong>{money(pool.totalActiveCoverage)}</strong>
                    </div>
                    <div className="pool-stat">
                      <span>Vendors</span>
                      <strong>{pool.activeVendors}</strong>
                    </div>
                    <div className="pool-stat">
                      <span>Health</span>
                      <strong>{pool.poolHealth}%</strong>
                    </div>
                  </div>
                  <div className="health-box" style={{ marginTop: '14px' }}>
                    <Badge type={pool.poolHealthType}>{pool.poolHealthLabel}</Badge>
                    <strong>{pool.poolHealth}%</strong>
                  </div>
                  <div className="progress">
                    <div style={{ width: `${Math.min(pool.poolHealth, 160) / 1.6}%` }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* 最近理賠紀錄 */}
          <Section title="Recent Payout History" subtitle="觸發補償後會留下 payout record。">
            {payoutHistory.length === 0 ? (
              <p className="empty">尚未有 payout record。</p>
            ) : (
              payoutHistory.slice(0, 5).map((p) => (
                <div className="list-item" key={p.id}>
                  <div>
                    <strong>{p.vendor || p.eventName}</strong>
                    <p>Rainfall {p.rainfall}mm / Threshold {p.threshold}mm</p>
                  </div>
                  <Badge type={p.amount > 0 ? 'success' : 'default'}>{money(p.amount)}</Badge>
                </div>
              ))
            )}
          </Section>
        </>
      )}

      {/* ── ClimateGuard：Oracle ── */}
      {tab === 'oracle' && (
        <Section title="Weather Oracle / Auto Payout" subtitle="MVP 階段用 mock oracle 模擬降雨資料，展示自動補償流程。">
          <div className="form-grid">
            <label>選擇活動
              <select value={selectedEventId} onChange={(e) => setSelectedEventId(Number(e.target.value))}>
                {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </label>
            <label>Mock rainfall mm<input type="number" value={rainfall} onChange={(e) => setRainfall(e.target.value)} /></label>
            <div className="info-box">
              <span>Current threshold</span>
              <strong>{selectedEvent?.threshold || 0}mm</strong>
            </div>
          </div>

          <h3>Eligible Vendors</h3>
          <div className="grid two">
            {eligiblePolicies.length === 0 ? (
              <p className="empty">目前沒有 active policies。</p>
            ) : (
              eligiblePolicies.map((p) => (
                <div className="list-item" key={p.id}>
                  <strong>{p.vendor}</strong>
                  <Badge type="info">Coverage {money(p.coverage)}</Badge>
                </div>
              ))
            )}
          </div>

          <button className="primary-btn" onClick={triggerPayout} disabled={loading}>
            {loading ? 'Processing...' : 'Run Oracle & Trigger Payout'}
          </button>
        </Section>
      )}

      {/* ── ClimateGuard：DAO ── */}
      {tab === 'dao' && (
        <Section title="DAO Governance" subtitle="DAO 成員可以投票調整風險池規則。">
          <div className="form-grid">
            <label>新降雨門檻 mm
              <input type="number" value={proposalForm.threshold} onChange={(e) => setProposalForm({ ...proposalForm, threshold: e.target.value })} />
            </label>
          </div>
          <button className="secondary-btn" onClick={createProposal} disabled={loading}>
            {loading ? 'Submitting...' : 'Submit Proposal'}
          </button>

          <h3 style={{ marginTop: '1.5rem' }}>Proposals</h3>
          {proposals.length === 0 ? (
            <p className="empty">目前沒有提案。</p>
          ) : (
            proposals.map((proposal) => (
              <div className="proposal" key={proposal.id}>
                <div>
                  <strong>Proposal #{proposal.id}</strong>
                  <p>{proposal.description}</p>
                  <p>Yes: {proposal.votesYes} / No: {proposal.votesNo}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <Badge type={proposal.status === 'Executed' ? 'success' : proposal.status === 'Passed' ? 'warning' : 'default'}>
                    {proposal.status}
                  </Badge>
                  {proposal.status === 'Active' && (
                    <>
                      <button className="secondary-btn" onClick={() => castVote(proposal.id, 'yes')} disabled={loading}>
                        Vote Yes
                      </button>
                      <button className="danger-btn" onClick={() => castVote(proposal.id, 'no')} disabled={loading}>
                        Vote No
                      </button>
                      <button className="secondary-btn" onClick={() => finalizeVote(proposal.id)} disabled={loading}>
                        Finalize
                      </button>
                    </>
                  )}
                  {proposal.status === 'Passed' && (
                    <button className="primary-btn" onClick={() => executeProposal(proposal.id)} disabled={loading}>
                      Execute
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </Section>
      )}
    </div>
  )
}
