import React, { useMemo, useState } from 'react'

const money = (n) => `NT$${Number(n).toLocaleString()}`

const plans = [
  { id: 'basic', name: 'Basic Plan', contribution: 300, coverage: 800, desc: '適合小型攤商，提供基礎豪雨補償。' },
  { id: 'standard', name: 'Standard Plan', contribution: 500, coverage: 1500, desc: '適合食物攤商或備貨成本較高的攤位。' }
]

const initialEvents = [
  {
    id: 1,
    name: '週末文創市集',
    location: 'Taipei',
    date: '2026-06-10',
    threshold: 200,
    organizerContribution: 12000,
    status: 'Active'
  }
]

const initialPolicies = [
  {
    id: 1,
    vendor: 'A01 咖啡攤',
    eventId: 1,
    plan: 'basic',
    contribution: 300,
    coverage: 800,
    status: 'Active',
    paidOut: 0
  },
  {
    id: 2,
    vendor: 'B08 手作甜點',
    eventId: 1,
    plan: 'standard',
    contribution: 500,
    coverage: 1500,
    status: 'Active',
    paidOut: 0
  }
]

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
  const [events, setEvents] = useState(initialEvents)
  const [policies, setPolicies] = useState(initialPolicies)
  const [payoutHistory, setPayoutHistory] = useState([])
  const [rainfall, setRainfall] = useState(230)
  const [selectedEventId, setSelectedEventId] = useState(1)
  const [reserveRatio, setReserveRatio] = useState(20)
  const [proposalThreshold, setProposalThreshold] = useState(200)
  const [proposalStatus, setProposalStatus] = useState('Draft')

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

  const selectedEvent = events.find((e) => e.id === Number(selectedEventId)) || events[0]

  const poolBalance = useMemo(() => {
    const organizerTotal = events.reduce((sum, e) => sum + Number(e.organizerContribution), 0)
    const vendorTotal = policies.reduce((sum, p) => sum + Number(p.contribution), 0)
    const payoutTotal = payoutHistory.reduce((sum, p) => sum + Number(p.amount), 0)
    return organizerTotal + vendorTotal - payoutTotal
  }, [events, policies, payoutHistory])

  const totalActiveCoverage = useMemo(() => {
    return policies
      .filter((p) => p.status === 'Active')
      .reduce((sum, p) => sum + Number(p.coverage), 0)
  }, [policies])

  const poolHealth = totalActiveCoverage > 0
    ? Math.round((poolBalance / totalActiveCoverage) * 100)
    : 0

  const poolHealthType = poolHealth >= 120 ? 'success' : poolHealth >= 80 ? 'warning' : 'danger'
  const poolHealthLabel = poolHealth >= 120 ? 'Healthy' : poolHealth >= 80 ? 'Warning' : 'Underfunded'

  const eligiblePolicies = policies.filter(
    (p) => p.eventId === Number(selectedEventId) && p.status === 'Active'
  )

  function createEvent() {
    const newEvent = {
      id: events.length + 1,
      name: eventForm.name,
      location: eventForm.location,
      date: eventForm.date,
      threshold: Number(eventForm.threshold),
      organizerContribution: Number(eventForm.organizerContribution),
      status: 'Active'
    }
    setEvents([...events, newEvent])
    setSelectedEventId(newEvent.id)
    setVendorForm({ ...vendorForm, eventId: newEvent.id })
    setTab('dashboard')
  }

  function joinPlan() {
    const plan = plans.find((p) => p.id === vendorForm.plan)
    const newPolicy = {
      id: policies.length + 1,
      vendor: vendorForm.vendor,
      eventId: Number(vendorForm.eventId),
      plan: plan.id,
      contribution: plan.contribution,
      coverage: plan.coverage,
      status: 'Active',
      paidOut: 0
    }
    setPolicies([...policies, newPolicy])
    setTab('dashboard')
  }

  function triggerPayout() {
    const threshold = Number(selectedEvent.threshold)
    const isTriggered = Number(rainfall) >= threshold

    if (!isTriggered) {
      setPayoutHistory([
        {
          id: Date.now(),
          eventName: selectedEvent.name,
          vendor: '-',
          rainfall: Number(rainfall),
          threshold,
          amount: 0,
          status: 'Not triggered'
        },
        ...payoutHistory
      ])
      return
    }

    const totalRequired = eligiblePolicies.reduce((sum, p) => sum + Number(p.coverage), 0)
    const maxAvailable = Math.max(poolBalance * (1 - reserveRatio / 100), 0)
    const payoutRatio = totalRequired > maxAvailable ? maxAvailable / totalRequired : 1

    const newPayouts = eligiblePolicies.map((policy) => ({
      id: Date.now() + policy.id,
      eventName: selectedEvent.name,
      vendor: policy.vendor,
      rainfall: Number(rainfall),
      threshold,
      amount: Math.floor(policy.coverage * payoutRatio),
      status: payoutRatio >= 1 ? 'Full payout' : 'Proportional payout'
    }))

    setPayoutHistory([...newPayouts, ...payoutHistory])
    setPolicies(
      policies.map((policy) =>
        policy.eventId === Number(selectedEventId) && policy.status === 'Active'
          ? { ...policy, status: 'Paid', paidOut: Math.floor(policy.coverage * payoutRatio) }
          : policy
      )
    )
  }

  function executeProposal() {
    setEvents(
      events.map((event) =>
        event.id === Number(selectedEventId)
          ? { ...event, threshold: Number(proposalThreshold) }
          : event
      )
    )
    setProposalStatus('Executed')
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

      {tab === 'dashboard' && (
        <>
          <div className="grid four">
            <StatCard label="Pool Balance" value={money(poolBalance)} note="目前 smart contract pool 餘額" />
            <StatCard label="Active Coverage" value={money(totalActiveCoverage)} note="目前有效保障總額" />
            <StatCard label="Pool Health" value={`${poolHealth}%`} note={poolHealthLabel} />
            <StatCard label="Active Vendors" value={policies.filter((p) => p.status === 'Active').length} note="目前仍在保障中的攤商" />
          </div>

          <div className="grid three">
            <Section title="Pool Health Status" subtitle="用來判斷資金池是否足以支撐目前保障額度。">
              <div className="health-box">
                <Badge type={poolHealthType}>{poolHealthLabel}</Badge>
                <strong>{poolHealth}%</strong>
              </div>
              <div className="progress">
                <div style={{ width: `${Math.min(poolHealth, 160) / 1.6}%` }} />
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
          <button className="primary-btn" onClick={createEvent}>Create Event</button>
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

          <button className="primary-btn" onClick={joinPlan}>Join Protection Plan</button>
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

          <button className="primary-btn" onClick={triggerPayout}>Run Oracle & Trigger Payout</button>
        </Section>
      )}

      {tab === 'dao' && (
        <Section title="DAO Governance" subtitle="DAO 成員可以投票調整風險池規則。">
          <div className="form-grid">
            <label>Proposal: 新降雨門檻 mm<input type="number" value={proposalThreshold} onChange={(e) => setProposalThreshold(e.target.value)} /></label>
            <label>Reserve Ratio %<input type="number" value={reserveRatio} onChange={(e) => setReserveRatio(Number(e.target.value))} /></label>
          </div>

          <div className="proposal">
            <div>
              <strong>Proposal #1</strong>
              <p>將 {selectedEvent?.name} 的 rainfall threshold 調整為 {proposalThreshold}mm，並設定 reserve ratio 為 {reserveRatio}%。</p>
            </div>
            <Badge type={proposalStatus === 'Executed' ? 'success' : 'warning'}>{proposalStatus}</Badge>
          </div>

          <button className="secondary-btn" onClick={() => setProposalStatus('Passed')}>Vote Yes</button>
          <button className="primary-btn" onClick={executeProposal}>Execute Proposal</button>
        </Section>
      )}
    </div>
  )
}
