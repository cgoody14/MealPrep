import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'

const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || '').toLowerCase()

function money(n, currency = 'usd') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: 2 }).format(n || 0)
}
function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function Tile({ label, value, sub }) {
  return (
    <div className="admin-tile">
      <div className="admin-tile-value">{value}</div>
      <div className="admin-tile-label">{label}</div>
      {sub != null && <div className="admin-tile-sub">{sub}</div>}
    </div>
  )
}

// Dependency-free dual bar chart (signups + recipes per day).
function BarChart({ days, signups, recipes }) {
  const max = Math.max(1, ...signups, ...recipes)
  return (
    <div className="admin-chart">
      <div className="admin-chart-legend">
        <span><i className="dot dot-sage" /> Signups</span>
        <span><i className="dot dot-terra" /> Recipes</span>
      </div>
      <div className="admin-chart-bars">
        {days.map((d, i) => (
          <div className="admin-chart-col" key={d} title={`${d}\nSignups: ${signups[i]} · Recipes: ${recipes[i]}`}>
            <div className="admin-chart-stack">
              <div className="admin-bar admin-bar-sage" style={{ height: `${(signups[i] / max) * 100}%` }} />
              <div className="admin-bar admin-bar-terra" style={{ height: `${(recipes[i] / max) * 100}%` }} />
            </div>
            {i % 5 === 0 && <div className="admin-chart-tick">{d.slice(5)}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Admin() {
  const [email, setEmail] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail((data?.user?.email || '').toLowerCase()))
  }, [])

  const isAdmin = email != null && email === ADMIN_EMAIL

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not signed in')
      const res = await fetch('/api/admin-stats', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.status === 403) throw new Error('Not authorized')
      if (!res.ok) throw new Error('Failed to load stats')
      setStats(await res.json())
    } catch (err) {
      setError(err.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (isAdmin) load() }, [isAdmin, load])

  if (email == null) return <div className="page"><p className="page-subtitle">Loading…</p></div>
  if (!isAdmin) {
    return (
      <div className="page">
        <div className="page-header"><h1 className="page-title">Dashboard</h1></div>
        <p className="page-subtitle">Not authorized.</p>
      </div>
    )
  }

  const r = stats
  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title-row">
          <h1 className="page-title">Dashboard</h1>
          <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
            {loading ? 'Refreshing…' : '↻ Refresh'}
          </button>
        </div>
      </div>
      <p className="page-subtitle">
        Internal overview{r ? ` · updated ${new Date(r.generatedAt).toLocaleTimeString()}` : ''}
      </p>

      {error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}
      {loading && !r && <p className="page-subtitle">Crunching numbers…</p>}

      {r && (
        <>
          <div className="admin-grid">
            <Tile label="Total Users" value={r.users.total} sub={`${r.users.active7} active (7d)`} />
            <Tile label="New Signups (7d)" value={r.users.new7} sub={`${r.users.new30} in 30d`} />
            <Tile label="Total Recipes" value={r.recipes.total} sub={`${r.recipes.new7} in 7d`} />
            <Tile label="Recipes (30d)" value={r.recipes.new30} />
            <Tile label="Paying Customers" value={r.revenue.payingCustomers} sub={r.revenue.stripeConfigured ? 'active subs' : 'Stripe not set'} />
            <Tile label="MRR" value={money(r.revenue.mrr, r.revenue.currency)} />
            <Tile label="Gross (30d)" value={money(r.revenue.gross30, r.revenue.currency)} />
            <Tile label="Plans" value={`${r.tiers.pro + r.tiers.unlimited} paid`} sub={`${r.tiers.free} free · ${r.tiers.pro} pro · ${r.tiers.unlimited} unltd`} />
          </div>

          <div className="admin-section">
            <h2 className="admin-section-title">Activity — last 30 days</h2>
            <BarChart days={r.series.days} signups={r.series.signups} recipes={r.series.recipes} />
          </div>

          <div className="admin-two-col">
            <div className="admin-section">
              <h2 className="admin-section-title">Recent signups</h2>
              <table className="admin-table">
                <tbody>
                  {r.recentSignups.length === 0 && <tr><td className="admin-empty">No users yet</td></tr>}
                  {r.recentSignups.map((u, i) => (
                    <tr key={i}>
                      <td className="admin-td-email">{u.email || '—'}</td>
                      <td className="admin-td-date">{fmtDate(u.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="admin-section">
              <h2 className="admin-section-title">Recent payments</h2>
              <table className="admin-table">
                <tbody>
                  {r.recentPayments.length === 0 && <tr><td className="admin-empty">No payments yet</td></tr>}
                  {r.recentPayments.map((p, i) => (
                    <tr key={i}>
                      <td className="admin-td-email">{p.email || '—'}</td>
                      <td className="admin-td-amt">{money(p.amount / 100, p.currency)}</td>
                      <td className={`admin-td-status admin-status-${p.status}`}>{p.status}</td>
                      <td className="admin-td-date">{fmtDate(p.created * 1000)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
