import React, { useEffect, useState } from 'react'

const money = (n) => `NT$${Number(n).toLocaleString()}`

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
  const [error, setError] = useState(null)

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
    fetchEvents()
    fetchPolicies()
    fetchPoolStats()
    fetchPayouts()
    fetchPlans()
    fetchProposals()
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

  const selectedEvent = events.find((e) => e.id === Number(selectedEventId)) || events[0]
  const eligiblePolicies = policies.filter(
    (p) => p.eventId === Number(selectedEventId) && p.status === 'Active'
  )
  const poolHealthType =
    poolStats.poolHealth >= 120 ? 'success' : poolStats.poolHealth >= 80 ? 'warning' : 'danger'

  async function createEvent() {
    setLoading(true)
    setError(null)
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
      setTab('dashboard')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function joinPlan() {
    setLoading(true)
    setError(null)
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
      setTab('dashboard')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function triggerPayout() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/oracle/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: selectedEventId, mockRainfall: Number(rainfall) })
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.message)
      await Promise.all([fetchPolicies(), fetchPayouts(), fetchPoolStats()])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function createProposal() {
    setLoading(true)
    setError(null)
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
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function voteYes(proposalId) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/dao/proposals/${proposalId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote: 'yes' })
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.message)
      await fetchProposals()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function executeProposal(proposalId) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/dao/proposals/${proposalId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.message)
      await Promise.all([fetchProposals(), fetchEvents(), fetchPoolStats()])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    ['dashboard', 'Dashboard'],
    ['event', '建立活動'],
    ['join', '加入方案'],
    ['oracle', 'Oracle / Payout'],
    ['dao', 'DAO 治理']
  ]

  return (
    <div className="app">
      <header className="hero">
        <div>
          <div className="eyebrow">Web3 · DAO · DeFi · Climate Finance</div>
          <h1>ClimateGuard DAO</h1>
          <p>戶外活動氣候風險的 Web3 指數型互助池</p>
        </div>
        <button className="primary-btn">Connect Wallet</button>
      </header>

      <nav className="tabs">
        {tabs.map(([id, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      {error && <div className="error-banner">{error}</div>}

      {tab === 'dashboard' && (
        <>
          <div className="grid four">
            <StatCard label="Pool Balance" value={money(poolStats.poolBalance)} note="目前 smart contract pool 餘額" />
            <StatCard label="Active Coverage" value={money(poolStats.totalActiveCoverage)} note="目前有效保障總額" />
            <StatCard label="Pool Health" value={`${poolStats.poolHealth}%`} note={poolStats.poolHealthLabel} />
            <StatCard label="Active Vendors" value={poolStats.activeVendors} note="目前仍在保障中的攤商" />
          </div>

          <div className="grid three">
            <Section title="Pool Health Status" subtitle="用來判斷資金池是否足以支撐目前保障額度。">
              <div className="health-box">
                <Badge type={poolHealthType}>{poolStats.poolHealthLabel}</Badge>
                <strong>{poolStats.poolHealth}%</strong>
              </div>
              <div className="progress">
                <div style={{ width: `${Math.min(poolStats.poolHealth, 160) / 1.6}%` }} />
              </div>
              <p className="hint">
                Pool Health Ratio = Available Pool Balance / Total Active Coverage。
              </p>
            </Section>

            <Section title="Active Events" subtitle="目前加入 ClimateGuard pool 的戶外活動。">
              {events.map((event) => (
                <div className="list-item" key={event.id}>
                  <div>
                    <strong>{event.name}</strong>
                    <p>{event.location} · {event.date}</p>
                    <p>Rainfall threshold: {event.threshold}mm</p>
                  </div>
                  <Badge type="info">{event.status}</Badge>
                </div>
              ))}
            </Section>

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
          </div>
        </>
      )}

      {tab === 'event' && (
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

      {tab === 'join' && (
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
            {plans.map((plan) => (
              <button
                key={plan.id}
                className={vendorForm.plan === plan.id ? 'plan selected' : 'plan'}
                onClick={() => setVendorForm({ ...vendorForm, plan: plan.id })}
              >
                <strong>{plan.name}</strong>
                <p>{plan.desc}</p>
                <span>Pay {money(plan.contribution)} · Coverage {money(plan.coverage)}</span>
              </button>
            ))}
          </div>

          <button className="primary-btn" onClick={joinPlan} disabled={loading}>
            {loading ? 'Joining...' : 'Join Protection Plan'}
          </button>
        </Section>
      )}

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
                    <button className="secondary-btn" onClick={() => voteYes(proposal.id)} disabled={loading}>
                      Vote Yes
                    </button>
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
