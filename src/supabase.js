import { createClient } from '@supabase/supabase-js'

const authStorage = {
  getItem: (key) => {
    if (localStorage.getItem('remember_me') === 'false') {
      return sessionStorage.getItem(key)
    }
    return localStorage.getItem(key)
  },
  setItem: (key, value) => {
    if (localStorage.getItem('remember_me') === 'false') {
      sessionStorage.setItem(key, value)
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, value)
    }
  },
  removeItem: (key) => {
    localStorage.removeItem(key)
    sessionStorage.removeItem(key)
  }
}

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    db: { schema: 'public' },
    auth: { persistSession: true, storage: authStorage }
  }
)
