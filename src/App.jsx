import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabase'
import Sidebar from './components/Sidebar'
import Rolodex from './pages/Rolodex'
import ThisWeek from './pages/ThisWeek'
import Planner from './pages/Planner'
import Shopping from './pages/Shopping'
import { useMeals } from './hooks/useMeals'
import { useWeekMeals } from './hooks/useWeekMeals'

function AuthPage() {
  const [mode, setMode] = useState('login') // login | signup
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setInfo('')
    try {
      if (mode === 'login') {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
        if (authError) throw authError
      } else {
        const { error: authError } = await supabase.auth.signUp({ email, password })
        if (authError) throw authError
        setInfo('Check your email to confirm your account, then log in.')
        setMode('login')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-brand-icon">🍽️</span>
          <h1 className="auth-title">Mise en Place</h1>
          <p className="auth-subtitle">Your personal meal journal & planner</p>
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
          {error && <div className="form-error">{error}</div>}
          {info && <div className="form-info">{info}</div>}
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="auth-toggle">
          {mode === 'login' ? (
            <>Don't have an account? <button className="link-btn" onClick={() => { setMode('signup'); setError(''); setInfo('') }}>Sign up</button></>
          ) : (
            <>Already have an account? <button className="link-btn" onClick={() => { setMode('login'); setError(''); setInfo('') }}>Sign in</button></>
          )}
        </div>
      </div>
    </div>
  )
}

function AppShell() {
  const { meals, loading: mealsLoading, addMeal, updateMeal, deleteMeal, markMadeToday } = useMeals()
  const { weekMeals, loading: weekLoading, addToWeek, removeFromWeek, clearWeek } = useWeekMeals()

  const handleMarkMadeShared = async (id) => {
    return markMadeToday(id)
  }

  return (
    <div className="app-layout">
      <Sidebar mealCount={meals.length} weekCount={weekMeals.length} />
      <main className="main-content">
        <Routes>
          <Route
            path="/"
            element={
              mealsLoading ? (
                <div className="page"><div className="spinner-wrap"><div className="spinner" /></div></div>
              ) : (
                <Rolodex
                  meals={meals}
                  addMeal={addMeal}
                  updateMeal={updateMeal}
                  deleteMeal={deleteMeal}
                  markMadeToday={handleMarkMadeShared}
                  weekMeals={weekMeals}
                  addToWeek={addToWeek}
                  removeFromWeek={removeFromWeek}
                />
              )
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
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
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

  return session ? <AppShell /> : <AuthPage />
}
