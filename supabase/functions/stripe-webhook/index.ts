import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import Stripe from "https://esm.sh/stripe@17?target=deno"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Required secrets (Supabase Dashboard → Edge Functions → stripe-webhook → Secrets):
//   STRIPE_SECRET_KEY          — Stripe secret key (sk_test_… or sk_live_…)
//   STRIPE_WEBHOOK_SECRET      — signing secret from the webhook endpoint in Stripe
//   STRIPE_PRICE_PRO           — price ID for the Pro tier
//   STRIPE_PRICE_UNLIMITED     — price ID for the Unlimited tier
//   SUPABASE_URL               — auto-populated
//   SUPABASE_SERVICE_ROLE_KEY  — service-role key so we can bypass RLS

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2024-11-20.acacia',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
)

const PRICE_PRO       = Deno.env.get('STRIPE_PRICE_PRO')
const PRICE_UNLIMITED = Deno.env.get('STRIPE_PRICE_UNLIMITED')

function tierForPriceId(priceId: string | null | undefined): string {
  if (priceId === PRICE_UNLIMITED) return 'unlimited'
  if (priceId === PRICE_PRO)       return 'pro'
  return 'free'
}

Deno.serve(async (req: Request) => {
  const signature = req.headers.get('stripe-signature')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!signature || !webhookSecret) {
    return new Response('Missing signature', { status: 400 })
  }

  const body = await req.text()
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', (err as Error).message)
    return new Response('Invalid signature', { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const householdId = session.client_reference_id
        const subscriptionId = session.subscription as string | null
        const customerId = session.customer as string | null
        if (!householdId) break

        let tier = 'pro'
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId)
          tier = tierForPriceId(sub.items.data[0]?.price?.id)
        }

        await supabase
          .from('households')
          .update({
            tier,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
          })
          .eq('id', householdId)
        console.log(`[stripe-webhook] household ${householdId} → ${tier}`)
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const priceId = sub.items.data[0]?.price?.id
        const active = sub.status === 'active' || sub.status === 'trialing'
        const tier = active ? tierForPriceId(priceId) : 'free'

        await supabase
          .from('households')
          .update({ tier, stripe_subscription_id: sub.id })
          .eq('stripe_subscription_id', sub.id)
        console.log(`[stripe-webhook] sub ${sub.id} ${sub.status} → ${tier}`)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await supabase
          .from('households')
          .update({ tier: 'free', stripe_subscription_id: null })
          .eq('stripe_subscription_id', sub.id)
        console.log(`[stripe-webhook] sub ${sub.id} deleted → free`)
        break
      }

      default:
        console.log(`[stripe-webhook] Unhandled event: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[stripe-webhook] Handler error:', (err as Error).message)
    return new Response('Handler error', { status: 500 })
  }
})
