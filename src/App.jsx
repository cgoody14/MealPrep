import { useState, useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { supabase } from './supabase'
import Sidebar from './components/Sidebar'
import HouseholdModal from './components/HouseholdModal'
import OnboardingModal from './components/OnboardingModal'
import Rolodex from './pages/Rolodex'
import ThisWeek from './pages/ThisWeek'
import Planner from './pages/Planner'
import Shopping from './pages/Shopping'
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
          <h1 className="auth-title">Mise en Place</h1>
          <p className="auth-subtitle">Set a new password</p>
        </div>
        {success ? (
          <div className="form-info auth-info-box">Password updated! Signing you in…</div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input
                className="form-input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input
                className="form-input"
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
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

  const switchMode = (next) => { setMode(next); setError(''); setInfo('') }

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
          options: { emailRedirectTo: 'https://meal-prep-lac.vercel.app/' }
        })
        if (authError) throw authError

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
          redirectTo: 'https://meal-prep-lac.vercel.app/'
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
            <h1 className="auth-title">Mise en Place</h1>
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
          <h1 className="auth-title">Mise en Place</h1>
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
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
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
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function AppShell() {
  const { meals, loading: mealsLoading, addMeal, updateMeal, deleteMeal, markMadeToday, fetchMeals } = useMeals()
  const { weekMeals, loading: weekLoading, addToWeek, removeFromWeek, clearWeek, fetchWeekMeals } = useWeekMeals()
  const { household, members, currentUserId, loading: householdLoading, joinHousehold, leaveHousehold, updateDisplayName } = useHousehold()
  const [showSettings, setShowSettings] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(() => !!localStorage.getItem('new_account'))
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

  const handleMarkMadeShared = async (id) => {
    return markMadeToday(id)
  }

  return (
    <div className="app-layout">
      <ScrollToTop />
      <Sidebar
        mealCount={meals.length}
        weekCount={weekMeals.length}
        onOpenSettings={() => setShowSettings(true)}
      />
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
                addMeal={addMeal}
                updateMeal={updateMeal}
                deleteMeal={deleteMeal}
                markMadeToday={handleMarkMadeShared}
                weekMeals={weekMeals}
                addToWeek={addToWeek}
                removeFromWeek={removeFromWeek}
                onRefresh={handleRefresh}
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
                onRefresh={handleRefresh}
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
                onRefresh={handleRefresh}
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
                onRefresh={handleRefresh}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {showOnboarding && !householdLoading && (
        <OnboardingModal
          household={household}
          onJoin={joinHousehold}
          onDone={() => setShowOnboarding(false)}
        />
      )}

      {showSettings && (
        <HouseholdModal
          household={household}
          members={members}
          currentUserId={currentUserId}
          onJoin={joinHousehold}
          onLeave={leaveHousehold}
          onUpdateDisplayName={updateDisplayName}
          onClose={() => setShowSettings(false)}
          onSignOut={handleSignOut}
          isDark={isDark}
          onToggleDark={toggleDark}
        />
      )}
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = loading
  const [isResetting, setIsResetting] = useState(() => !!sessionStorage.getItem('pwd_recovery'))

  const enterReset = () => { sessionStorage.setItem('pwd_recovery', '1'); setIsResetting(true) }
  const exitReset  = () => { sessionStorage.removeItem('pwd_recovery'); setIsResetting(false) }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
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
