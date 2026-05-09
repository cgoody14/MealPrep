import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Validate Supabase session from Authorization header
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

  // Proxy request to Groq
  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify(req.body),
    })
    const data = await groqRes.json()
    return res.status(groqRes.status).json(data)
  } catch (err) {
    return res.status(502).json({ error: 'Failed to reach Groq API' })
  }
}
