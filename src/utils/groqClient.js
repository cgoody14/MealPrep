import { supabase } from '../supabase'

const GROQ_DIRECT = 'https://api.groq.com/openai/v1/chat/completions'

// In local dev VITE_GROQ_API_KEY may still be set in .env.local — call Groq
// directly so developers don't need `vercel dev` running.  In production the
// key is server-only (GROQ_API_KEY), so the browser always uses the proxy.
async function getAuthHeader() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? `Bearer ${session.access_token}` : null
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const RATE_LIMIT_UI_MSG =
  "Rouxlo's AI is busy right now — please wait a few seconds and try again."

function isRateLimit(status, msg) {
  return status === 429 || /rate limit/i.test(msg || '')
}
// Groq errors say "Please try again in 25.0125s" — pull out the seconds.
function retryAfterMs(msg) {
  const m = /try again in ([\d.]+)s/i.exec(msg || '')
  return m ? Math.ceil(parseFloat(m[1]) * 1000) : null
}

async function rawCall(body) {
  const devKey = import.meta.env.VITE_GROQ_API_KEY
  if (devKey) {
    const res = await fetch(GROQ_DIRECT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${devKey}` },
      body: JSON.stringify(body),
    })
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) }
  }
  const authHeader = await getAuthHeader()
  if (!authHeader) throw new Error('Not authenticated')
  const res = await fetch('/api/groq', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
    body: JSON.stringify(body),
  })
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) }
}

export async function callGroq(body) {
  // Retry once on a short rate-limit window; otherwise surface a friendly message.
  for (let attempt = 0; attempt < 2; attempt++) {
    const { ok, status, data } = await rawCall(body)
    const errMsg = (!ok || data?.error) ? (data?.error?.message || 'Groq request failed') : ''
    if (!errMsg) return data

    if (isRateLimit(status, errMsg)) {
      const waitMs = retryAfterMs(errMsg)
      if (attempt === 0 && waitMs != null && waitMs <= 8000) {
        await sleep(waitMs + 300)
        continue
      }
      throw new Error(RATE_LIMIT_UI_MSG)
    }
    throw new Error(errMsg)
  }
  throw new Error(RATE_LIMIT_UI_MSG)
}

// Calls the server-side scrape endpoint which fetches the real page content.
// Returns null in dev (no server running), so the caller falls back gracefully.
export async function callScrape(url) {
  if (import.meta.env.VITE_GROQ_API_KEY) return null // dev: no server available

  const authHeader = await getAuthHeader()
  if (!authHeader) throw new Error('Not authenticated')
  const res = await fetch('/api/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
    body: JSON.stringify({ url }),
  })
  return res.json()
}
