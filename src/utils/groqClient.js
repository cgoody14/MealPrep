import { supabase } from '../supabase'

const GROQ_DIRECT = 'https://api.groq.com/openai/v1/chat/completions'

// In local dev VITE_GROQ_API_KEY may still be set in .env.local — call Groq
// directly so developers don't need `vercel dev` running.  In production the
// key is server-only (GROQ_API_KEY), so the browser always uses the proxy.
async function getAuthHeader() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? `Bearer ${session.access_token}` : null
}

export async function callGroq(body) {
  // ── Development shortcut ────────────────────────────────────────────────────
  const devKey = import.meta.env.VITE_GROQ_API_KEY
  if (devKey) {
    const res = await fetch(GROQ_DIRECT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${devKey}` },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error.message)
    return data
  }

  // ── Production: authenticated server proxy ──────────────────────────────────
  const authHeader = await getAuthHeader()
  if (!authHeader) throw new Error('Not authenticated')
  const res = await fetch('/api/groq', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error?.message || 'Groq request failed')
  return data
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
