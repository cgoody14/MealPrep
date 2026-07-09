import { useState, useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { supabase } from './supabase'
import Sidebar from './components/Sidebar'
import HouseholdModal from './components/HouseholdModal'
import OnboardingModal from './components/OnboardingModal'
import InstallGuideModal from './components/InstallGuideModal'
import UpgradePrompt from './components/UpgradePrompt'
import Rolodex from './pages/Rolodex'
import ThisWeek from './pages/ThisWeek'
import Planner from './pages/Planner'
import Shopping from './pages/Shopping'
import Faqs from './pages/Faqs'
import { useMeals } from './hooks/useMeals'
import { useWeekMeals } from './hooks/useWeekMeals'
import { useHousehold } from './hooks/useHousehold'
import { usePullToRefresh } from './hooks/usePullToRefresh'

function ResetPasswordPage({ onDone }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirm) { setError("Passwords don't match."); return }
    setLoading(true)
    setError('')
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) throw err
      setSuccess(true)
      setTimeout(() => onDone(), 1500)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <img src="/logo.png" alt="" className="auth-brand-logo" onError={e => { e.currentTarget.style.display = 'none' }} />
          <h1 className="auth-title">Rouxlo</h1>
          <p className="auth-subtitle">Set a new password</p>
        </div>
        {success ? (
          <div className="form-info auth-info-box">Password updated! Signing you in…</div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label">New Password</label>
              <div className="password-input-wrap">
                <input
                  className="form-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  autoFocus
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(v => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                {showPassword
                    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M1 1l22 22"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/></svg>
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <div className="password-input-wrap">
                <input
                  className="form-input"
                  type={showPassword ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
            </div>
            {error && <div className="form-error">{error}</div>}
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Saving…' : 'Set New Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function AuthPage() {
  const [mode, setMode] = useState('login') // login | signup | forgot
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)

  const switchMode = (next) => { setMode(next); setError(''); setInfo(''); setShowPassword(false) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setInfo('')
    try {
      if (mode === 'login') {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
        if (authError) throw authError
      } else if (mode === 'signup') {
        const { error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: import.meta.env.VITE_APP_URL || 'https://rouxlo.com' }
        })
        if (authError) throw authError

        // Notify owner — fire and forget, never blocks signup
        supabase.functions.invoke('notify-signup', { body: { email } }).catch(() => {})

        // Save flags so the welcome screen appears after first sign-in
        localStorage.setItem('new_account', '1')
        if (inviteCode.trim()) {
          localStorage.setItem('pending_invite', inviteCode.trim().toUpperCase())
        }

        // If email confirmation is disabled in Supabase, sign in immediately
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (!signInError) return // onAuthStateChange handles the rest

        // Email confirmation is required — tell the user
        setInfo('Almost there! Check your email for a confirmation link, then come back and sign in.')
        setMode('login')
      } else if (mode === 'forgot') {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: import.meta.env.VITE_APP_URL || 'https://rouxlo.com'
        })
        if (err) throw err
        setInfo('Check your email for a password reset link.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (mode === 'forgot') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-brand">
            <img src="/logo.png" alt="" className="auth-brand-logo" onError={e => { e.currentTarget.style.display = 'none' }} />
            <h1 className="auth-title">Rouxlo</h1>
            <p className="auth-subtitle">Reset your password</p>
          </div>
          {info ? (
            <div className="auth-forgot-sent">
              <div className="auth-info-box">{info}</div>
              <button type="button" className="auth-link" onClick={() => switchMode('login')}>
                ← Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="auth-form">
              <p className="auth-forgot-hint">Enter your email and we'll send you a link to reset your password.</p>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  className="form-input"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                />
              </div>
              {error && <div className="form-error">{error}</div>}
              <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
              <button type="button" className="auth-link" onClick={() => switchMode('login')}>
                ← Back to Sign In
              </button>
            </form>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <img src="/logo.png" alt="" className="auth-brand-logo" onError={e => { e.currentTarget.style.display = 'none' }} />
          <h1 className="auth-title">Rouxlo</h1>
          <p className="auth-subtitle">Your personal meal journal &amp; planner</p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => switchMode('login')}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => switchMode('signup')}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="password-input-wrap">
              <input
                className="form-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(v => !v)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword
                    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M1 1l22 22"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/></svg>
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
              </button>
            </div>
          </div>
          {mode === 'signup' && (
            <div className="form-group">
              <label className="form-label auth-optional-label">
                Household invite code
                <span className="auth-optional-badge">optional</span>
              </label>
              <input
                className="form-input auth-invite-input"
                type="text"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="e.g. CEA326"
                maxLength={6}
                spellCheck={false}
                autoComplete="off"
              />
              <span className="auth-field-hint">Got a code from a partner or family member? Add it here to share their meal library automatically.</span>
            </div>
          )}
          {error && <div className="form-error">{error}</div>}
          {info && <div className="form-info">{info}</div>}
          {mode === 'login' && (
            <label className="auth-remember">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
              />
              <span>Remember me</span>
            </label>
          )}
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
          {mode === 'login' && (
            <button type="button" className="auth-link" onClick={() => switchMode('forgot')}>
              Forgot password?
            </button>
          )}
        </form>
      </div>
    </div>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    document.querySelector('.main-content')?.scrollTo(0, 0)
  }, [pathname])
  return null
}

function AppShell() {
  const { meals, loading: mealsLoading, addMeal, updateMeal, deleteMeal, markMadeToday, fetchMeals } = useMeals()
  const { weekMeals, loading: weekLoading, addToWeek, removeFromWeek, clearWeek, fetchWeekMeals, updateDayOfWeek, updateServingsOverride } = useWeekMeals()
  const { household, members, currentUserId, loading: householdLoading, joinHousehold, leaveHousehold, updateDisplayName, removeMember, fetchHousehold } = useHousehold()
  const [showSettings, setShowSettings] = useState(false)
  const [upgradeReason, setUpgradeReason] = useState(null)
  const [upgradeToast, setUpgradeToast] = useState(null) // 'success' | 'canceled' | null

  // Handle the return trip from Stripe Checkout. ?upgrade=success means the
  // subscription was created — poll fetchHousehold a couple times so the tier
  // badge flips as soon as the webhook lands.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const status = params.get('upgrade')
    if (status !== 'success' && status !== 'canceled') return

    setUpgradeToast(status)
    setShowSettings(true)

    // Clean the URL without a full nav
    params.delete('upgrade')
    const clean = window.location.pathname + (params.toString() ? '?' + params.toString() : '')
    window.history.replaceState({}, '', clean)

    if (status === 'success') {
      let tries = 0
      const iv = setInterval(async () => {
        tries += 1
        await fetchHousehold()
        if (tries >= 4) clearInterval(iv)
      }, 1500)
    }

    const toastTimer = setTimeout(() => setUpgradeToast(null), 6000)
    return () => clearTimeout(toastTimer)
  }, [fetchHousehold])

  // Wrap addMeal so tier gates trigger the upgrade modal instead of
  // surfacing a raw error to the recipe-import flow.
  const gatedAddMeal = async (meal) => {
    try {
      return await addMeal(meal)
    } catch (err) {
      if (err?.code === 'RECIPE_LIMIT_REACHED') {
        setUpgradeReason('recipe_limit')
      }
      throw err
    }
  }
  const [showOnboarding, setShowOnboarding] = useState(() => !!localStorage.getItem('new_account'))
  const [showInstallGuide, setShowInstallGuide] = useState(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    return !isStandalone && localStorage.getItem('pwa-guide-dismissed') !== '1'
  })
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark')
  const [refreshing, setRefreshing] = useState(false)
  const mainRef = useRef(null)

  const toggleDark = () => {
    const next = !isDark
    setIsDark(next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
    document.documentElement.setAttribute('data-theme', next ? 'dark' : '')
  }

  const handleRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await Promise.all([fetchMeals(), fetchWeekMeals()])
    } finally {
      setRefreshing(false)
    }
  }

  const { isPulling } = usePullToRefresh(mainRef, handleRefresh)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  // After any household membership change, immediately refresh the combined
  // meal library and week plan for the user performing the action.
  const handleJoinHousehold = async (code) => {
    try {
      await joinHousehold(code)
      await Promise.all([fetchMeals(), fetchWeekMeals()])
    } catch (err) {
      if (err?.code === 'HOUSEHOLD_JOIN_BLOCKED') {
        setUpgradeReason('household_join')
      }
      throw err
    }
  }

  const handleLeaveHousehold = async () => {
    await leaveHousehold()
    await Promise.all([fetchMeals(), fetchWeekMeals()])
  }

  const handleRemoveMember = async (userId) => {
    await removeMember(userId)
    await Promise.all([fetchMeals(), fetchWeekMeals()])
  }

  const handleMarkMadeShared = async (id) => {
    return markMadeToday(id)
  }

  return (
    <div className="app-layout">
      <ScrollToTop />
      <Sidebar
        mealCount={meals.length}
        weekCount={weekMeals.length}
      />
      <div className="top-right-actions">
        <button
          className={`top-right-btn${refreshing ? ' is-refreshing' : ''}`}
          onClick={handleRefresh}
          disabled={refreshing}
          aria-label="Refresh"
          title="Refresh"
        >
          <span aria-hidden="true">↻</span>
        </button>
        <button
          className="top-right-btn"
          onClick={() => setShowSettings(true)}
          aria-label="Settings"
          title="Settings"
        >
          <span aria-hidden="true">⚙</span>
        </button>
      </div>
      <main className="main-content" ref={mainRef}>
        {(isPulling || refreshing) && (
          <div className="pull-indicator">
            <div className="spinner spinner-sm" />
          </div>
        )}
        <Routes>
          <Route
            path="/"
            element={
              <Rolodex
                meals={meals}
                loading={mealsLoading}
                addMeal={gatedAddMeal}
                updateMeal={updateMeal}
                deleteMeal={deleteMeal}
                markMadeToday={handleMarkMadeShared}
                weekMeals={weekMeals}
                addToWeek={addToWeek}
                removeFromWeek={removeFromWeek}
              />
            }
          />
          <Route
            path="/week"
            element={
              <ThisWeek
                meals={meals}
                weekMeals={weekMeals}
                loading={weekLoading}
                addToWeek={addToWeek}
                removeFromWeek={removeFromWeek}
                clearWeek={clearWeek}
                markMadeToday={handleMarkMadeShared}
                updateDayOfWeek={updateDayOfWeek}
                updateMeal={updateMeal}
              />
            }
          />
          <Route
            path="/randomizer"
            element={
              <Planner
                meals={meals}
                addToWeek={addToWeek}
                weekMeals={weekMeals}
              />
            }
          />
          <Route
            path="/shopping"
            element={
              <Shopping
                weekMeals={weekMeals}
                loading={weekLoading}
                clearWeek={clearWeek}
              />
            }
          />
          <Route path="/faqs" element={<Faqs />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {showOnboarding && !householdLoading && (
        <OnboardingModal
          household={household}
          onJoin={handleJoinHousehold}
          onDone={() => setShowOnboarding(false)}
        />
      )}

      {showInstallGuide && !showOnboarding && (
        <InstallGuideModal onClose={() => setShowInstallGuide(false)} />
      )}

      {upgradeReason && (
        <UpgradePrompt reason={upgradeReason} onClose={() => setUpgradeReason(null)} />
      )}

      {upgradeToast && (
        <div className={`upgrade-toast upgrade-toast-${upgradeToast}`} role="status">
          {upgradeToast === 'success'
            ? '✓ Payment received — your plan is upgrading.'
            : 'Checkout canceled — no changes.'}
          <button className="upgrade-toast-close" onClick={() => setUpgradeToast(null)} aria-label="Dismiss">✕</button>
        </div>
      )}

      {showSettings && (
        <HouseholdModal
          household={household}
          members={members}
          currentUserId={currentUserId}
          onJoin={handleJoinHousehold}
          onLeave={handleLeaveHousehold}
          onRemoveMember={handleRemoveMember}
          onUpdateDisplayName={updateDisplayName}
          onClose={() => setShowSettings(false)}
          onSignOut={handleSignOut}
          onUpgrade={() => setUpgradeReason('manual_upgrade')}
          isDark={isDark}
          onToggleDark={toggleDark}
        />
      )}
    </div>
  )
}

// Read the Supabase session from localStorage synchronously so returning
// users skip the loading spinner entirely. getSession() still runs to verify.
function readCachedSession() {
  if (sessionStorage.getItem('pwd_recovery')) return undefined
  try {
    const key = Object.keys(localStorage).find(
      k => k.startsWith('sb-') && k.endsWith('-auth-token')
    )
    if (!key) return undefined
    const parsed = JSON.parse(localStorage.getItem(key) || 'null')
    if (parsed?.access_token) return parsed
  } catch { /* ignore */ }
  return undefined
}

export default function App() {
  const [session, setSession] = useState(() => readCachedSession())
  const [isResetting, setIsResetting] = useState(() => !!sessionStorage.getItem('pwd_recovery'))

  const enterReset = () => { sessionStorage.setItem('pwd_recovery', '1'); setIsResetting(true) }
  const exitReset  = () => { sessionStorage.removeItem('pwd_recovery'); setIsResetting(false) }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        enterReset()
      } else {
        setSession(session)
        if (event === 'USER_UPDATED') {
          exitReset()
        }
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    )
  }

  if (isResetting) {
    return <ResetPasswordPage onDone={exitReset} />
  }

  return session ? <AppShell /> : <AuthPage />
}
