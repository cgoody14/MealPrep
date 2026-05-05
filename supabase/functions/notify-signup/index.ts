import "jsr:@supabase/functions-js/edge-runtime.d.ts"

// Required secrets (Supabase Dashboard → Edge Functions → notify-signup → Secrets):
//   OWNER_EMAIL    — address that receives new-signup notifications
//   RESEND_API_KEY — your Resend API key (from resend.com)
//   FROM_EMAIL     — sender address; must be a Resend-verified domain OR onboarding@resend.dev
//                    Gmail and other free addresses are NOT supported by Resend as senders.

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const ownerEmail = Deno.env.get('OWNER_EMAIL')
  const resendKey  = Deno.env.get('RESEND_API_KEY')
  const fromEmail  = Deno.env.get('FROM_EMAIL') || 'onboarding@resend.dev'

  if (!ownerEmail || !resendKey) {
    console.error('[notify-signup] Missing secrets — set OWNER_EMAIL and RESEND_API_KEY in Supabase dashboard')
    return new Response('Not configured', { status: 500 })
  }

  let userEmail = 'unknown'
  try {
    const body = await req.json()
    userEmail = body?.email || 'unknown'
  } catch {
    console.warn('[notify-signup] Could not parse request body, proceeding with unknown email')
  }

  const time = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
  console.log(`[notify-signup] New signup from: ${userEmail} at ${time} ET`)

  let res: Response
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Mise en Place <${fromEmail}>`,
        to: ownerEmail,
        subject: '🍽️ New user signed up',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#FAF7F2;border-radius:12px;">
            <h2 style="color:#B85C2C;margin:0 0 16px;">New Sign-Up</h2>
            <p style="margin:0 0 8px;color:#3D2B1F;font-size:15px;">
              A new user just created an account on <strong>Mise en Place</strong>.
            </p>
            <table style="margin:20px 0;background:#fff;border-radius:8px;padding:16px 20px;width:100%;border:1px solid #e8e0d8;">
              <tr>
                <td style="color:#6B5344;font-size:13px;padding:4px 0;">Email</td>
                <td style="color:#1a1a1a;font-size:14px;font-weight:600;padding:4px 0;">${userEmail}</td>
              </tr>
              <tr>
                <td style="color:#6B5344;font-size:13px;padding:4px 0;">Time</td>
                <td style="color:#1a1a1a;font-size:14px;padding:4px 0;">${time} ET</td>
              </tr>
            </table>
            <p style="color:#9E8880;font-size:12px;margin:0;">Mise en Place · Automated notification</p>
          </div>
        `,
      }),
    })
  } catch (fetchErr) {
    console.error('[notify-signup] Network error calling Resend:', (fetchErr as Error)?.message)
    return new Response('Email failed', { status: 500 })
  }

  if (!res.ok) {
    const errBody = await res.text()
    console.error(`[notify-signup] Resend returned ${res.status}: ${errBody}`)
    return new Response('Email failed', { status: 500 })
  }

  const result = await res.json().catch(() => ({}))
  console.log(`[notify-signup] Email sent successfully, Resend id: ${result?.id}`)
  return new Response('OK', { status: 200 })
})
