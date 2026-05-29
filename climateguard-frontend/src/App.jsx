import React, { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { ethers } from 'ethers'
import { ADDRESSES, CHAIN_ID } from './contracts/addresses.js'
import { getContracts, loadChainData, readProvider } from './contracts/contracts.js'

const money = (n) => `NT$${Number(n).toLocaleString()}`

const PLAN_DISPLAY = [
  {
    id: 'basic',
    name: 'Basic',
    icon: '🌱',
    contribution: 300,
    coverage: 800,
    color: 'plan-basic',
    features: [
      { icon: '☔', text: 'Rainfall trigger protection' },
      { icon: '⚡', text: 'Instant auto-payout' },
      { icon: '🏛️', text: 'DAO governance rights' },
    ],
  },
  {
    id: 'standard',
    name: 'Standard',
    icon: '⭐',
    contribution: 500,
    coverage: 1500,
    color: 'plan-standard',
    features: [
      { icon: '☔', text: 'Advanced rainfall protection' },
      { icon: '🔮', text: 'Real-time Oracle monitoring' },
      { icon: '⚡', text: 'Instant auto-payout' },
      { icon: '🏛️', text: 'DAO governance rights' },
    ],
  },
]

function Badge({ children, type = 'default' }) {
  return <span className={`badge badge-${type}`}>{children}</span>
}

function EmptyState({ message }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon" />
      <p>{message}</p>
    </div>
  )
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
  const [view, setView] = useState('vendor') // 'vendor' | 'organizer' | 'platform'
  const [tab, setTab] = useState('join-plan')

  const [events, setEvents] = useState([])
  const [policies, setPolicies] = useState([])
  const [payoutHistory, setPayoutHistory] = useState([])
  const [plans, setPlans] = useState([])
  const [proposals, setProposals] = useState([])
  const [poolStats, setPoolStats] = useState({
    poolBalance: 0, totalActiveCoverage: 0,
    poolHealth: 0, poolHealthLabel: 'Healthy',
    activeVendors: 0, reserveRatio: 20
  })
  const [rainfall, setRainfall] = useState(230)
  const [selectedEventId, setSelectedEventId] = useState(1)
  const [loading, setLoading] = useState(false)
  const [initLoading, setInitLoading] = useState(true)
  const [error, setError] = useState(null)
  const [account, setAccount] = useState(null)
  const [success, setSuccess] = useState(null)
  const [signer, setSigner] = useState(null)
  const [contracts, setContracts] = useState(null)

  const [eventForm, setEventForm] = useState({
    name: '河濱週末市集', location: 'Taipei',
    date: '2026-06-24', threshold: 200, organizerContribution: 10000
  })
  const [vendorForm, setVendorForm] = useState({
    vendor: 'Booth C12', eventId: 1, plan: 'basic'
  })
  const [proposalForm, setProposalForm] = useState({ threshold: 200 })

  useEffect(() => {
    async function init() {
      try {
        // 用 read-only provider 讀取鏈上資料（不需要 MetaMask）
        const { pool, dao } = getContracts(readProvider)
        const { eventsData, policiesData, payoutsData, proposalsData } = await loadChainData(pool, dao)
        setEvents(eventsData)
        setPolicies(policiesData)
        setPayoutHistory(payoutsData)
        setProposals(proposalsData)
        if (eventsData.length > 0) setSelectedEventId(eventsData[0].id)
      } catch (e) {
        console.error('Chain read failed:', e)
        setError('Failed to load on-chain data. Check your network connection.')
      } finally {
        setInitLoading(false)
      }
    }
    init()
  }, [])

  async function refreshChainData(c) {
    const src = c || contracts
    if (!src) return
    const { eventsData, policiesData, payoutsData, proposalsData } = await loadChainData(src.pool, src.dao)
    setEvents(eventsData)
    setPolicies(policiesData)
    setPayoutHistory(payoutsData)
    setProposals(proposalsData)
  }

  function showSuccess(msg) {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 3000)
  }

  function switchView(newView) {
    const defaults = { vendor: 'join-plan', organizer: 'create-event', platform: 'dashboard' }
    setView(newView)
    setTab(defaults[newView])
    setError(null)
    setSuccess(null)
  }

  function switchTab(id) {
    setTab(id)
    setError(null)
    setSuccess(null)
  }

  async function connectWallet() {
    if (!window.ethereum) {
      setError('MetaMask not detected. Please install MetaMask to connect your wallet.')
      return
    }
    try {
      // 切換到 Sepolia（如果還不在的話）
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x' + CHAIN_ID.toString(16) }],
        })
      } catch (switchErr) {
        if (switchErr.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{ chainId: '0xaa36a7', chainName: 'Sepolia', rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com'], nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 } }],
          })
        }
      }

      const provider = new ethers.BrowserProvider(window.ethereum)
      const s = await provider.getSigner()
      const addr = await s.getAddress()
      const c = getContracts(s)

      setSigner(s)
      setContracts(c)
      setAccount(addr)
    } catch {
      setError('Wallet connection rejected.')
    }
  }

  function calcEventPool(eventId) {
    const event = events.find((e) => e.id === eventId)
    if (!event) return null
    const ep = policies.filter((p) => p.eventId === eventId)
    // 直接用鏈上的 poolBalance / totalActiveCoverage
    const poolBalance = Number(event.poolBalance) || 0
    const totalActiveCoverage = Number(event.totalActiveCoverage) || 0
    const poolHealth = totalActiveCoverage > 0
      ? Math.round((poolBalance / totalActiveCoverage) * 100) : 200
    const poolHealthLabel = poolHealth >= 120 ? 'Healthy' : poolHealth >= 80 ? 'Warning' : 'Underfunded'
    const poolHealthType = poolHealth >= 120 ? 'success' : poolHealth >= 80 ? 'warning' : 'danger'
    const activeVendors = ep.filter((p) => p.status === 'Active').length
    return { poolBalance, totalActiveCoverage, poolHealth, poolHealthLabel, poolHealthType, activeVendors }
  }

  function requireWallet() {
    if (!contracts) { setError('Please connect your wallet first.'); return false }
    return true
  }

  async function createEvent() {
    if (!requireWallet()) return
    setLoading(true); setError(null); setSuccess(null)
    try {
      const amount = ethers.parseEther(String(eventForm.organizerContribution))
      setSuccess('Step 1/2: Approving USDC...')
      const approveTx = await contracts.usdc.approve(ADDRESSES.ClimateGuardPool, amount)
      await approveTx.wait()
      setSuccess('Step 2/2: Creating event on-chain...')
      const tx = await contracts.pool.createEvent(
        eventForm.name, eventForm.location, eventForm.date,
        Number(eventForm.threshold), amount
      )
      await tx.wait()
      await refreshChainData()
      showSuccess(`Event "${eventForm.name}" created successfully!`)
    } catch (e) { setError(e.reason || e.message) }
    finally { setLoading(false) }
  }

  async function joinPlan() {
    if (!requireWallet()) return
    setLoading(true); setError(null); setSuccess(null)
    try {
      const planAmounts = { basic: '300', standard: '500' }
      const amount = ethers.parseEther(planAmounts[vendorForm.plan] || '300')
      setSuccess('Step 1/2: Approving USDC...')
      const approveTx = await contracts.usdc.approve(ADDRESSES.ClimateGuardPool, amount)
      await approveTx.wait()
      setSuccess('Step 2/2: Joining plan on-chain...')
      const tx = await contracts.pool.joinPlan(vendorForm.eventId, vendorForm.vendor, vendorForm.plan)
      await tx.wait()
      await refreshChainData()
      showSuccess(`${vendorForm.vendor} successfully joined the ${vendorForm.plan} plan!`)
    } catch (e) { setError(e.reason || e.message) }
    finally { setLoading(false) }
  }

  async function triggerPayout() {
    if (!requireWallet()) return
    setLoading(true); setError(null); setSuccess(null)
    try {
      const tx = await contracts.pool.triggerPayout(selectedEventId, Number(rainfall))
      await tx.wait()
      await refreshChainData()
      showSuccess('Oracle executed successfully!')
    } catch (e) { setError(e.reason || e.message) }
    finally { setLoading(false) }
  }

  async function createProposal() {
    if (!requireWallet()) return
    setLoading(true); setError(null); setSuccess(null)
    try {
      const selectedEvent = events.find((e) => e.id === Number(selectedEventId))
      const tx = await contracts.dao.createProposal(
        selectedEventId, 0,
        `Adjust rainfall threshold for "${selectedEvent?.name}" to ${proposalForm.threshold}mm`,
        Number(proposalForm.threshold)
      )
      await tx.wait()
      await refreshChainData()
      showSuccess('Proposal submitted!')
    } catch (e) { setError(e.reason || e.message) }
    finally { setLoading(false) }
  }

  async function voteYes(proposalId) {
    if (!requireWallet()) return
    setLoading(true); setError(null); setSuccess(null)
    try {
      const tx = await contracts.dao.vote(proposalId, true)
      await tx.wait()
      await refreshChainData()
      showSuccess('Vote submitted!')
    } catch (e) { setError(e.reason || e.message) }
    finally { setLoading(false) }
  }

  async function executeProposal(proposalId) {
    if (!requireWallet()) return
    setLoading(true); setError(null); setSuccess(null)
    try {
      const tx = await contracts.dao.executeProposal(proposalId)
      await tx.wait()
      await refreshChainData()
      showSuccess('Proposal executed successfully!')
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const selectedEvent = events.find((e) => e.id === Number(selectedEventId)) || events[0]
  const eligiblePolicies = policies.filter(
    (p) => p.eventId === Number(selectedEventId) && p.status === 'Active'
  )

  if (initLoading) {
    return <div className="init-loading">Loading...</div>
  }

  // ── Shared Header ──
  const AppHeader = (
    <header className="app-header">
      <div className="header-brand">
        <img src="/logo.png" alt="ClimateGuard" className="header-logo" />
        <span className="header-name">ClimateGuard</span>
      </div>
      <div className="header-actions">
        {view !== 'vendor' && (
          <button className="header-ghost-btn" onClick={() => switchView('vendor')}>← Back to Vendor</button>
        )}
        {view === 'vendor' && (
          <button className="header-outline-btn" onClick={() => switchView('organizer')}>Create Event</button>
        )}
        {view !== 'platform' && (
          <button className="header-solid-btn" onClick={() => switchView('platform')}>ClimateGuard Dashboard</button>
        )}
        {account ? (
          <button className="wallet-connected-btn">
            <span className="wallet-dot" />
            {account.slice(0, 6)}…{account.slice(-4)}
          </button>
        ) : (
          <button className="wallet-btn" onClick={connectWallet}>Connect Wallet</button>
        )}
      </div>
    </header>
  )

  // ── Platform Dashboard content (reused) ──
  const platformContent = (() => {
    const poolData = events.map((e) => {
      const pool = calcEventPool(e.id)
      return {
        name: e.name.length > 10 ? e.name.slice(0, 10) + '…' : e.name,
        fullName: e.name,
        poolBalance: pool?.poolBalance ?? 0,
        coverage: pool?.totalActiveCoverage ?? 0,
        health: pool?.poolHealth ?? 0,
      }
    })
    const totalPoolBalance = events.reduce((s, e) => s + (calcEventPool(e.id)?.poolBalance ?? 0), 0)
    const totalActiveVendors = policies.filter((p) => p.status === 'Active').length

    if (tab === 'dashboard') return (
      <>
        <div className="summary-strip">
          <div className="summary-item">
            <span className="summary-label">Total Events</span>
            <strong className="summary-value">{events.length}</strong>
          </div>
          <div className="summary-item">
            <span className="summary-label">Active Vendors</span>
            <strong className="summary-value">{totalActiveVendors}</strong>
          </div>
          <div className="summary-item">
            <span className="summary-label">Total Pool</span>
            <strong className="summary-value">{money(totalPoolBalance)}</strong>
          </div>
        </div>

        <div className="grid two" style={{ marginBottom: 18 }}>
          <div className="card">
            <div className="chart-title">Pool Balance vs Coverage by Event</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={poolData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8f0fe" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#4a6fa5' }} />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#4a6fa5' }} />
                <Tooltip formatter={(v) => money(v)} contentStyle={{ borderRadius: 10, fontSize: 13 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="poolBalance" name="Pool Balance" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                <Bar dataKey="coverage" name="Total Coverage" fill="#f472b6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <div className="chart-title">Pool Health by Event</div>
            <div className="health-status-list">
              {poolData.length === 0 && <EmptyState message="No event data yet." />}
              {poolData.map((d, i) => {
                const isHealthy = d.health >= 120
                const isWarning = d.health >= 80 && d.health < 120
                const statusLabel = isHealthy ? 'Healthy' : isWarning ? 'Warning' : 'Underfunded'
                const statusType = isHealthy ? 'success' : isWarning ? 'warning' : 'danger'
                return (
                  <div className="health-status-row" key={i}>
                    <span className="health-status-name">{d.fullName}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="health-status-pct">{d.health}%</span>
                      <Badge type={statusType}>{statusLabel}</Badge>
                    </div>
                  </div>
                )
              })}
            </div>
            <p style={{ margin: '12px 0 0', fontSize: 12, color: '#4a6fa5' }}>
              Health = Pool Balance ÷ Total Coverage. Below 100% means the pool cannot fully cover all claims.
            </p>
          </div>
        </div>

        <div className="section-title-row"><h2>Event Details</h2></div>
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
                  <div className="pool-stat"><span>Pool Balance</span><strong>{money(pool.poolBalance)}</strong></div>
                  <div className="pool-stat"><span>Coverage</span><strong>{money(pool.totalActiveCoverage)}</strong></div>
                  <div className="pool-stat"><span>Vendors</span><strong>{pool.activeVendors}</strong></div>
                  <div className="pool-stat"><span>Health</span><strong>{pool.poolHealth}%</strong></div>
                </div>
                <div className="health-box" style={{ marginTop: 14 }}>
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
      </>
    )

    if (tab === 'oracle') return (
      <Section title="Weather Oracle / Auto Payout" subtitle="MVP 階段用 mock oracle 模擬降雨資料，展示自動補償流程。">
        <div className="form-grid">
          <label>Select Event
            <select value={selectedEventId} onChange={(e) => setSelectedEventId(Number(e.target.value))}>
              {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </label>
          <label>Mock rainfall mm
            <input type="number" value={rainfall} onChange={(e) => setRainfall(e.target.value)} />
          </label>
          <div className="info-box">
            <span>Current threshold</span>
            <strong>{selectedEvent?.threshold || 0}mm</strong>
          </div>
        </div>
        <h3 style={{ color: '#0c1e44', marginTop: '1.5rem' }}>Eligible Vendors</h3>
        <div className="grid two">
          {eligiblePolicies.length === 0
            ? <EmptyState message="No active policies for this event." />
            : eligiblePolicies.map((p) => (
              <div className="list-item" key={p.id}>
                <strong>{p.vendor}</strong>
                <Badge type="info">Coverage {money(p.coverage)}</Badge>
              </div>
            ))}
        </div>
        <button className="primary-btn" onClick={triggerPayout} disabled={loading}>
          {loading ? 'Processing...' : 'Run Oracle & Trigger Payout'}
        </button>
      </Section>
    )

    if (tab === 'dao') return (
      <Section title="DAO Governance" subtitle="DAO members can vote to adjust risk pool parameters.">
        <div className="form-grid">
          <label>New Rainfall Threshold (mm)
            <input type="number" value={proposalForm.threshold}
              onChange={(e) => setProposalForm({ ...proposalForm, threshold: e.target.value })} />
          </label>
        </div>
        <button className="secondary-btn" onClick={createProposal} disabled={loading}>
          {loading ? 'Submitting...' : 'Submit Proposal'}
        </button>
        <h3 style={{ marginTop: '1.5rem', color: '#0c1e44' }}>Proposals</h3>
        {proposals.length === 0
          ? <EmptyState message="No proposals yet." />
          : proposals.map((proposal) => (
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
                  <button className="secondary-btn" onClick={() => voteYes(proposal.id)} disabled={loading}>Vote Yes</button>
                )}
                {proposal.status === 'Passed' && (
                  <button className="primary-btn" onClick={() => executeProposal(proposal.id)} disabled={loading}>Execute</button>
                )}
              </div>
            </div>
          ))}
      </Section>
    )

    return null
  })()

  return (
    <div className="app-wrapper">
      {view !== 'vendor' && AppHeader}

      {/* ══════════════ VENDOR VIEW ══════════════ */}
      {view === 'vendor' && (
        <>
          <div className="page-hero vendor-hero-img">
            <img src="/hero-bg.png" className="hero-bg-img" alt="" />
            <div className="hero-full-overlay">
              {/* Header floats on image */}
              <div className="hero-top-bar">
                <div className="header-brand">
                  <img src="/logo.png" alt="ClimateGuard" className="header-logo" />
                  <span className="header-name">ClimateGuard</span>
                </div>
                <div className="header-actions">
                  <button className="header-outline-btn" onClick={() => switchView('organizer')}>Create Event</button>
                  <button className="header-solid-btn" onClick={() => switchView('platform')}>ClimateGuard Dashboard</button>
                  {account ? (
                    <button className="wallet-connected-btn">
                      <span className="wallet-dot" />
                      {account.slice(0, 6)}…{account.slice(-4)}
                    </button>
                  ) : (
                    <button className="wallet-btn" onClick={connectWallet}>Connect Wallet</button>
                  )}
                </div>
              </div>
              {/* Title text at bottom-left */}
              <div className="hero-text-content">
                <p className="hero-eyebrow">Web3 Payment Module And Tool for Climate Risk</p>
                <h1 className="hero-title">When Climate Strikes,<br />We Stand Together.</h1>
                <p className="hero-subtitle">Decentralized climate risk protection for outdoor event vendors.</p>
              </div>
            </div>
          </div>

          <div className="page-tabs">
            <div className="page-tabs-inner">
              <button className={`page-tab${tab === 'join-plan' ? ' active' : ''}`} onClick={() => switchTab('join-plan')}>Join a Plan</button>
              <button className={`page-tab${tab === 'my-policies' ? ' active' : ''}`} onClick={() => switchTab('my-policies')}>My Policies</button>
            </div>
          </div>

          <div className="page-content">
            {error && <div className="error-banner">{error}</div>}
            {success && <div className="success-banner">{success}</div>}

            {tab === 'join-plan' && (
              <>
                {/* How It Works */}
                <div className="how-it-works">
                  <div className="hiw-header">
                    <h2>How It Works</h2>
                    <p>Three simple steps to build a fair and transparent climate risk protection pool.</p>
                  </div>
                  <div className="hiw-steps">
                    <div className="hiw-step">
                      <img src="/hiw-1.png" alt="Organizer creates event" className="hiw-img" />
                      <div className="hiw-num">01</div>
                      <h3>Organizer Creates Event</h3>
                      <p>Set event details, rainfall threshold, and deposit the initial pool contribution into the smart contract.</p>
                    </div>
                    <div className="hiw-arrow">›</div>
                    <div className="hiw-step">
                      <img src="/hiw-2.png" alt="Vendors join a plan" className="hiw-img" />
                      <div className="hiw-num">02</div>
                      <h3>Vendors Join a Plan</h3>
                      <p>Choose a protection plan and contribute to the shared pool. Coverage is locked on-chain.</p>
                    </div>
                    <div className="hiw-arrow">›</div>
                    <div className="hiw-step">
                      <img src="/hiw-3.png" alt="Automatic payout" className="hiw-img" />
                      <div className="hiw-num">03</div>
                      <h3>Automatic Payout</h3>
                      <p>When rainfall exceeds the threshold, the Oracle triggers instant payouts directly to your wallet.</p>
                    </div>
                  </div>
                </div>

                {/* Event selection */}
                <div className="content-section">
                  <div className="content-section-head">
                    <h2>Select an Event</h2>
                    <p>Choose the outdoor event you're joining to purchase climate protection for your booth.</p>
                  </div>
                  {events.length === 0
                    ? <EmptyState message="No events available. Please check back later." />
                    : (
                      <div className={`grid${events.length >= 3 ? ' three' : ' two'}`}>
                        {events.map((event, i) => {
                          const marketImgs = ['/market-1.png', '/market-2.png', '/market-3.png', '/market-4.png']
                          const img = marketImgs[i % marketImgs.length]
                          return (
                            <div
                              key={event.id}
                              className={`event-select-card${vendorForm.eventId === event.id ? ' selected' : ''}`}
                              onClick={() => setVendorForm({ ...vendorForm, eventId: event.id })}
                            >
                              <div className="event-card-thumb">
                                <img src={img} alt={event.name} className="event-thumb-img" />
                              </div>
                              <div className="event-card-info">
                                <div className="event-card-info-top">
                                  <strong>{event.name}</strong>
                                  <Badge type={event.status === 'Active' ? 'success' : 'default'}>{event.status}</Badge>
                                </div>
                                <p>📍 {event.location} · 📅 {event.date}</p>
                                <p>🌧️ Rain trigger: {event.threshold}mm</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                </div>

                {/* Plan selection */}
                <div className="content-section">
                  <div className="content-section-head">
                    <h2>Choose a Protection Plan</h2>
                    <p>Your contribution enters the smart contract pool. Payouts trigger automatically when rainfall exceeds the threshold.</p>
                  </div>
                  <div className="grid two">
                    {PLAN_DISPLAY.map((plan) => (
                      <div
                        key={plan.id}
                        className={`plan-display-card ${plan.color}${vendorForm.plan === plan.id ? ' selected' : ''}`}
                        onClick={() => setVendorForm({ ...vendorForm, plan: plan.id })}
                      >
                        <div className="plan-card-icon">{plan.icon}</div>
                        <div className="plan-card-name">{plan.name}</div>
                        <div className="plan-card-price">NT${plan.contribution.toLocaleString()}</div>
                        <div className="plan-card-coverage">保障額度 NT${plan.coverage.toLocaleString()}</div>
                        <ul className="plan-card-features">
                          {plan.features.map((f) => <li key={f.text}><span className="feat-icon">{f.icon}</span>{f.text}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>

                  <div className="join-form">
                    <label>
                      Vendor Name
                      <input
                        value={vendorForm.vendor}
                        onChange={(e) => setVendorForm({ ...vendorForm, vendor: e.target.value })}
                        placeholder="Enter your booth name"
                      />
                    </label>
                    <button className="primary-btn" style={{ marginTop: 0 }} onClick={joinPlan} disabled={loading}>
                      {loading ? 'Joining...' : 'Join Protection Plan'}
                    </button>
                  </div>
                </div>
              </>
            )}

            {tab === 'my-policies' && (
              <div className="content-section">
                <div className="content-section-head">
                  <h2>My Policies</h2>
                  <p>View your active coverage and payout history.</p>
                </div>
                {policies.length === 0
                  ? <EmptyState message="No plans joined yet." />
                  : policies.map((p) => {
                    const event = events.find((e) => e.id === p.eventId)
                    return (
                      <div className="list-item" key={p.id}>
                        <div>
                          <strong>{p.vendor}</strong>
                          <p>{event?.name || `Event #${p.eventId}`} · {p.plan}</p>
                          <p>Contribution {money(p.contribution)} · Coverage {money(p.coverage)}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <Badge type={p.status === 'Active' ? 'success' : p.status === 'Paid' ? 'warning' : 'default'}>
                            {p.status}
                          </Badge>
                          {p.paidOut > 0 && <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#4a6fa5' }}>Payout {money(p.paidOut)}</p>}
                        </div>
                      </div>
                    )
                  })}
                {payoutHistory.length > 0 && (
                  <>
                    <h3 style={{ margin: '1.5rem 0 1rem', color: '#0c1e44' }}>Payout History</h3>
                    {payoutHistory.slice(0, 10).map((p) => (
                      <div className="list-item" key={p.id}>
                        <div>
                          <strong>{p.vendor || p.eventName}</strong>
                          <p>Rainfall {p.rainfall}mm / Threshold {p.threshold}mm</p>
                        </div>
                        <Badge type={p.amount > 0 ? 'success' : 'default'}>{money(p.amount)}</Badge>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════ ORGANIZER VIEW ══════════════ */}
      {view === 'organizer' && (
        <>
          <div className="page-hero organizer-hero">
            <div className="hero-inner">
              <div className="hero-left">
                <p className="hero-eyebrow">Event Organizer</p>
                <h1 className="hero-title" style={{ fontSize: '2.2rem' }}>Create Events, Protect Every Vendor</h1>
                <p className="hero-subtitle">Set event details and rainfall thresholds to launch your decentralized climate protection pool.</p>
              </div>
            </div>
          </div>

          <div className="page-tabs">
            <div className="page-tabs-inner">
              <button className={`page-tab${tab === 'create-event' ? ' active' : ''}`} onClick={() => switchTab('create-event')}>Create Event</button>
              <button className={`page-tab${tab === 'my-events' ? ' active' : ''}`} onClick={() => switchTab('my-events')}>My Events</button>
            </div>
          </div>

          <div className="page-content">
            {error && <div className="error-banner">{error}</div>}
            {success && <div className="success-banner">{success}</div>}

            {tab === 'create-event' && (
              <Section title="Create Outdoor Event" subtitle="Create an event and deposit the organizer contribution into the smart contract pool.">
                <div className="form-grid">
                  <label>Event Name<input value={eventForm.name} onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })} /></label>
                  <label>Location<input value={eventForm.location} onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })} /></label>
                  <label>Date<input type="date" value={eventForm.date} onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })} /></label>
                  <label>Rain Trigger Threshold (mm)<input type="number" value={eventForm.threshold} onChange={(e) => setEventForm({ ...eventForm, threshold: e.target.value })} /></label>
                  <label>Organizer Contribution<input type="number" value={eventForm.organizerContribution} onChange={(e) => setEventForm({ ...eventForm, organizerContribution: e.target.value })} /></label>
                </div>
                <button className="primary-btn" onClick={createEvent} disabled={loading}>
                  {loading ? 'Creating...' : 'Create Event'}
                </button>
              </Section>
            )}

            {tab === 'my-events' && (
              <Section title="My Events" subtitle="View your created events, each event's pool status, and participating vendors.">
                {events.length === 0
                  ? <EmptyState message="No events created yet." />
                  : events.map((event) => {
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
                            <p className="pool-section-title">Pool Status</p>
                            <div className="pool-stats-row">
                              <div className="pool-stat"><span>Pool Balance</span><strong>{money(pool.poolBalance)}</strong></div>
                              <div className="pool-stat"><span>Coverage</span><strong>{money(pool.totalActiveCoverage)}</strong></div>
                              <div className="pool-stat"><span>Vendors</span><strong>{pool.activeVendors}</strong></div>
                              <div className="pool-stat"><span>Health</span><strong>{pool.poolHealth}%</strong></div>
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
                          <p className="vendors-title">Participating Vendors ({eventPolicies.length})</p>
                          {eventPolicies.length === 0
                            ? <EmptyState message="No vendors joined yet." />
                            : eventPolicies.map((p) => (
                              <div className="list-item" key={p.id}>
                                <div>
                                  <strong>{p.vendor}</strong>
                                  <p>{p.plan} · Coverage {money(p.coverage)}</p>
                                </div>
                                <Badge type={p.status === 'Active' ? 'success' : 'default'}>{p.status}</Badge>
                              </div>
                            ))}
                        </div>
                      </div>
                    )
                  })}
              </Section>
            )}
          </div>
        </>
      )}

      {/* ══════════════ PLATFORM VIEW ══════════════ */}
      {view === 'platform' && (
        <>
          <div className="page-hero platform-hero">
            <div className="hero-inner">
              <div className="hero-left">
                <p className="hero-eyebrow">ClimateGuard Platform</p>
                <h1 className="hero-title" style={{ fontSize: '2.2rem' }}>Platform Monitoring & Governance</h1>
                <p className="hero-subtitle">Monitor all pool statuses, execute Oracle payouts, and manage DAO proposals.</p>
              </div>
            </div>
          </div>

          <div className="page-tabs">
            <div className="page-tabs-inner">
              {[['dashboard', 'Dashboard'], ['oracle', 'Oracle / Payout'], ['dao', 'DAO Governance']].map(([id, label]) => (
                <button key={id}
                  className={`page-tab${tab === id ? ' active' : ''}`}
                  onClick={() => switchTab(id)}
                >{label}</button>
              ))}
            </div>
          </div>

          <div className="page-content">
            {error && <div className="error-banner">{error}</div>}
            {success && <div className="success-banner">{success}</div>}
            {platformContent}
          </div>
        </>
      )}
    </div>
  )
}
