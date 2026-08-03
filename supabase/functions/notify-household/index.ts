import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import webpush from "npm:web-push@3.6.7"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Required secrets (Supabase Dashboard → Edge Functions → notify-household → Secrets):
//   VAPID_PUBLIC_KEY  — VAPID public key
//   VAPID_PRIVATE_KEY — VAPID private key
//   VAPID_SUBJECT     — e.g. mailto:you@example.com
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — auto-injected
//
// Called (authenticated) by the client after a household action. Identifies
// the actor from their JWT, finds the OTHER members of their household, and
// web-pushes each of their subscriptions. Never notifies the actor; no-ops
// for solo households.

const VAPID_PUBLIC  = Deno.env.get("VAPID_PUBLIC_KEY") || ""
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") || ""
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:noreply@rouxlo.com"

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

const admin = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
)

function buildMessage(type: string, actor: string, mealName?: string) {
  switch (type) {
    case "new_recipe":
      return { title: `🍳 ${actor} added a recipe`, body: mealName || "A new recipe was added" }
    case "week_meal":
      return { title: `📅 ${actor} planned a meal`, body: mealName ? `${mealName} · This Week` : "Added to This Week" }
    case "member_join":
      return { title: `👋 ${actor} joined your household`, body: "Say hi and start sharing recipes." }
    default:
      return null
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 })

  // Identify the actor from their JWT.
  const auth = req.headers.get("Authorization")
  if (!auth?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 })
  const { data: { user }, error: authErr } = await admin.auth.getUser(auth.slice(7))
  if (authErr || !user) return new Response("Invalid session", { status: 401 })

  let type = "", mealName: string | undefined
  try {
    const body = await req.json()
    type = body?.type
    mealName = body?.mealName
  } catch { /* ignore */ }

  // Actor's household + display name.
  const { data: me } = await admin
    .from("user_households")
    .select("household_id, display_name")
    .eq("user_id", user.id)
    .single()
  if (!me?.household_id) return new Response(JSON.stringify({ sent: 0 }), { status: 200 })

  const actorName = me.display_name || (user.email ? user.email.split("@")[0] : "Someone")

  const msg = buildMessage(type, actorName, mealName)
  if (!msg) return new Response("Unknown type", { status: 400 })

  // Other members of the household.
  const { data: members } = await admin
    .from("user_households")
    .select("user_id")
    .eq("household_id", me.household_id)
    .neq("user_id", user.id)

  const otherIds = (members || []).map((m) => m.user_id)
  if (otherIds.length === 0) return new Response(JSON.stringify({ sent: 0 }), { status: 200 })

  // Their push subscriptions.
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", otherIds)

  if (!subs || subs.length === 0) return new Response(JSON.stringify({ sent: 0 }), { status: 200 })

  const payload = JSON.stringify({ title: msg.title, body: msg.body, url: "/" })

  let sent = 0
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload
      )
      sent += 1
    } catch (err) {
      const status = (err as { statusCode?: number })?.statusCode
      // Stale/expired subscription — remove it so we stop trying.
      if (status === 404 || status === 410) {
        await admin.from("push_subscriptions").delete().eq("id", s.id)
      } else {
        console.error("[notify-household] push failed:", (err as Error)?.message)
      }
    }
  }))

  return new Response(JSON.stringify({ sent }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
})
