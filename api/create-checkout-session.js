import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const PRICE_IDS = {
  pro: process.env.STRIPE_PRICE_PRO,
  unlimited: process.env.STRIPE_PRICE_UNLIMITED,
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  )
  const { data: { user }, error: authErr } = await supabase.auth.getUser(auth.slice(7))
  if (authErr || !user) {
    return res.status(401).json({ error: 'Invalid session' })
  }

  const { tier } = req.body || {}
  const priceId = PRICE_IDS[tier]
  if (!priceId) {
    return res.status(400).json({ error: 'Invalid tier' })
  }

  const admin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { data: membership } = await admin
    .from('user_households')
    .select('household_id')
    .eq('user_id', user.id)
    .single()

  if (!membership?.household_id) {
    return res.status(400).json({ error: 'No household found' })
  }
  const householdId = membership.household_id

  const { data: household } = await admin
    .from('households')
    .select('stripe_customer_id')
    .eq('id', householdId)
    .single()

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  let customerId = household?.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { household_id: householdId, user_id: user.id },
    })
    customerId = customer.id
    await admin
      .from('households')
      .update({ stripe_customer_id: customerId })
      .eq('id', householdId)
  }

  const appUrl = process.env.APP_URL || 'https://rouxlo.com'
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: householdId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/?upgrade=success`,
      cancel_url: `${appUrl}/?upgrade=canceled`,
      allow_promotion_codes: true,
      metadata: { household_id: householdId, tier },
    })
    return res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('[create-checkout-session]', err.message)
    return res.status(500).json({ error: 'Failed to create checkout session' })
  }
}
