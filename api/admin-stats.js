import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

// Owner-only metrics endpoint. Access control lives HERE (server-side): the
// caller's email — taken from their validated Supabase JWT, never from the
// request body — must equal ADMIN_EMAIL. Only this function holds the service
// role + Stripe secrets; the browser never sees them. Read-only.

const DAY = 24 * 60 * 60 * 1000

function dayKey(d) {
  return new Date(d).toISOString().slice(0, 10) // YYYY-MM-DD (UTC)
}

// Build an ordered list of the last `n` day-keys, oldest first.
function lastNDays(n, now) {
  const days = []
  for (let i = n - 1; i >= 0; i--) days.push(dayKey(now - i * DAY))
  return days
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // ── Auth: validate JWT, then gate on owner email ──
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
  const { data: { user }, error: authErr } = await anon.auth.getUser(auth.slice(7))
  if (authErr || !user) {
    return res.status(401).json({ error: 'Invalid session' })
  }
  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase()
  if (!adminEmail || (user.email || '').toLowerCase() !== adminEmail) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const now = Date.now()
  const d7 = now - 7 * DAY
  const d30 = now - 30 * DAY
  const days30 = lastNDays(30, now)

  try {
    // ── Users / signups / activity (auth.users via admin API) ──
    const allUsers = []
    for (let page = 1; page <= 50; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) throw error
      const batch = data?.users || []
      allUsers.push(...batch)
      if (batch.length < 1000) break
    }
    const signupSeries = Object.fromEntries(days30.map(k => [k, 0]))
    let users7 = 0, users30 = 0, active7 = 0, active30 = 0
    for (const u of allUsers) {
      const created = u.created_at ? new Date(u.created_at).getTime() : 0
      if (created >= d7) users7++
      if (created >= d30) {
        users30++
        const k = dayKey(created)
        if (k in signupSeries) signupSeries[k]++
      }
      const seen = u.last_sign_in_at ? new Date(u.last_sign_in_at).getTime() : 0
      if (seen >= d7) active7++
      if (seen >= d30) active30++
    }
    const recentSignups = [...allUsers]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 12)
      .map(u => ({ email: u.email, created_at: u.created_at }))

    // ── Recipes ──
    const { count: totalRecipes } = await admin
      .from('meals').select('*', { count: 'exact', head: true })
    const { count: recipes7 } = await admin
      .from('meals').select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(d7).toISOString())
    const { data: recent30Meals } = await admin
      .from('meals').select('created_at')
      .gte('created_at', new Date(d30).toISOString())
    const recipeSeries = Object.fromEntries(days30.map(k => [k, 0]))
    let recipes30 = 0
    for (const m of recent30Meals || []) {
      recipes30++
      const k = dayKey(m.created_at)
      if (k in recipeSeries) recipeSeries[k]++
    }

    // ── Tiers (households) ──
    const { data: households } = await admin.from('households').select('tier')
    const tiers = { free: 0, pro: 0, unlimited: 0 }
    for (const h of households || []) {
      const t = h.tier || 'free'
      tiers[t] = (tiers[t] || 0) + 1
    }

    // ── Stripe: subscriptions (MRR) + recent payments + 30d gross ──
    let mrrCents = 0, payingCustomers = 0, gross30Cents = 0
    let recentPayments = []
    if (process.env.STRIPE_SECRET_KEY) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

      // Active subscriptions → MRR (normalize all intervals to monthly)
      let starting_after
      for (let i = 0; i < 20; i++) {
        const subs = await stripe.subscriptions.list({ status: 'active', limit: 100, starting_after })
        for (const s of subs.data) {
          payingCustomers++
          for (const item of s.items?.data || []) {
            const price = item.price
            const qty = item.quantity || 1
            const amt = (price?.unit_amount || 0) * qty
            const interval = price?.recurring?.interval
            const count = price?.recurring?.interval_count || 1
            if (interval === 'year') mrrCents += Math.round(amt / (12 * count))
            else if (interval === 'week') mrrCents += Math.round((amt * 52) / (12 * count))
            else if (interval === 'day') mrrCents += Math.round((amt * 365) / (12 * count))
            else mrrCents += Math.round(amt / count) // month
          }
        }
        if (!subs.has_more) break
        starting_after = subs.data[subs.data.length - 1]?.id
      }

      // Recent charges + 30-day gross
      const charges = await stripe.charges.list({ limit: 100, created: { gte: Math.floor(d30 / 1000) } })
      for (const c of charges.data) {
        if (c.paid && c.status === 'succeeded' && !c.refunded) gross30Cents += c.amount
      }
      recentPayments = charges.data.slice(0, 12).map(c => ({
        amount: c.amount,
        currency: c.currency,
        status: c.refunded ? 'refunded' : c.status,
        email: c.billing_details?.email || c.receipt_email || null,
        created: c.created,
      }))
    }

    return res.status(200).json({
      generatedAt: now,
      users: { total: allUsers.length, new7: users7, new30: users30, active7, active30 },
      recipes: { total: totalRecipes || 0, new7: recipes7 || 0, new30: recipes30 },
      tiers,
      revenue: {
        mrr: mrrCents / 100,
        payingCustomers,
        gross30: gross30Cents / 100,
        currency: 'usd',
        stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
      },
      series: { days: days30, signups: days30.map(k => signupSeries[k]), recipes: days30.map(k => recipeSeries[k]) },
      recentSignups,
      recentPayments,
    })
  } catch (err) {
    console.error('[admin-stats] error:', err?.message)
    return res.status(500).json({ error: 'Failed to load stats' })
  }
}
