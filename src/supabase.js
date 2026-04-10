import { createClient } from '@supabase/supabase-js'

console.log('[supabase] connecting to:', import.meta.env.VITE_SUPABASE_URL)

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    db: { schema: 'public' },
    auth: { persistSession: true }
  }
)
