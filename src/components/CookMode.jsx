import { useState, useEffect, useRef } from 'react'

function parseSteps(instructions) {
  return (instructions || '')
    .split(/ \| |\n/)
    .map(s => s.replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean)
}

function renderStepText(text) {
  const parts = text.split(/(If desired[,.]?|[Oo]ptional[,:]?)/g)
  return parts.map((part, i) =>
    /^(If desired[,.]?|[Oo]ptional[,:]?)$/.test(part)
      ? <em key={i} className="cook-step-optional">{part}</em>
      : part
  )
}

// Detect time mentions in a step (e.g. "25 minutes", "10 min", "1 hour", "30 seconds")
function detectTimer(text) {
  const match = text.match(/(\d+)\s*(hour|hr|minute|min|second|sec)s?/i)
  if (!match) return null
  const val = parseInt(match[1])
  const unit = match[2].toLowerCase()
  if (unit.startsWith('hour') || unit === 'hr') return val * 3600
  if (unit.startsWith('min')) return val * 60
  if (unit.startsWith('sec')) return val
  return null
}

function formatTime(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function StepTimer({ seconds }) {
  const [remaining, setRemaining] = useState(null) // null = not started
  const [running, setRunning] = useState(false)
  const intervalRef = useRef(null)

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  const start = () => {
    if (remaining === null) setRemaining(seconds)
    setRunning(true)
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current)
          setRunning(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const pause = () => {
    clearInterval(intervalRef.current)
    setRunning(false)
  }

  const reset = () => {
    clearInterval(intervalRef.current)
    setRunning(false)
    setRemaining(seconds)
  }

  const done = remaining === 0
  const display = remaining !== null ? remaining : seconds

  return (
    <div className={`cook-timer ${done ? 'cook-timer-done' : ''}`}>
      <span className="cook-timer-icon">⏱</span>
      <span className="cook-timer-time">{formatTime(display)}</span>
      {!running && !done && (
        <button className="cook-timer-btn" onClick={start}>
          {remaining !== null ? 'Resume' : 'Start'}
        </button>
      )}
      {running && (
        <button className="cook-timer-btn" onClick={pause}>Pause</button>
      )}
      {remaining !== null && !running && (
        <button className="cook-timer-btn cook-timer-reset" onClick={reset}>↺</button>
      )}
      {done && <span className="cook-timer-done-label">Done!</span>}
    </div>
  )
}

export default function CookMode({ meal, scaledIngredients, scaledServings, originalServings, onClose }) {
  const steps = parseSteps(meal.instructions)
  const [currentStep, setCurrentStep] = useState(0)
  const [checkedIngs, setCheckedIngs] = useState(new Set())
  const [showIngs, setShowIngs] = useState(false)
  const [darkBg, setDarkBg] = useState(true)
  const wakeLockRef = useRef(null)

  // Request wake lock to prevent screen sleep
  useEffect(() => {
    if ('wakeLock' in navigator) {
      navigator.wakeLock.request('screen')
        .then(lock => { wakeLockRef.current = lock })
        .catch(() => {}) // wakeLock may be denied
    }
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {})
        wakeLockRef.current = null
      }
    }
  }, [])

  // Re-acquire wake lock if tab becomes visible again
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && 'wakeLock' in navigator && !wakeLockRef.current) {
        navigator.wakeLock.request('screen')
          .then(lock => { wakeLockRef.current = lock })
          .catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  const totalSteps = steps.length
  const step = steps[currentStep] || ''
  const timerSecs = detectTimer(step)
  const isOptional = /If desired|[Oo]ptional/.test(step)
  const progress = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0
  const ingredients = scaledIngredients || meal.ingredients || []

  const toggleIng = (ing) => {
    setCheckedIngs(prev => {
      const next = new Set(prev)
      if (next.has(ing)) next.delete(ing); else next.add(ing)
      return next
    })
  }

  return (
    <div className={`cook-overlay ${darkBg ? 'cook-dark' : 'cook-light'}`}>
      {/* Top bar */}
      <div className="cook-topbar">
        <button className="cook-close" onClick={onClose}>✕ Exit</button>
        <div className="cook-topbar-center">
          <span className="cook-meal-name">{meal.name}</span>
          {scaledServings && originalServings && scaledServings !== originalServings && (
            <span className="cook-scaled-note">Scaled to {scaledServings} servings</span>
          )}
        </div>
        <div className="cook-topbar-right">
          <button
            className="cook-ing-toggle"
            onClick={() => setShowIngs(v => !v)}
          >
            🧂 {showIngs ? 'Hide' : 'Ingredients'}
          </button>
          <button
            className="cook-theme-toggle"
            onClick={() => setDarkBg(v => !v)}
            title="Toggle background"
          >
            {darkBg ? '☀️' : '🌙'}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="cook-progress-track">
        <div className="cook-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {totalSteps === 0 ? (
        <div className="cook-no-steps">No instructions saved for this recipe.</div>
      ) : (
        <div className="cook-body">
          {/* Ingredients panel */}
          {showIngs && (
            <div className="cook-ing-panel">
              <div className="cook-ing-title">Ingredients</div>
              <ul className="cook-ing-list">
                {ingredients.map((ing, i) => (
                  <li
                    key={i}
                    className={`cook-ing-item ${checkedIngs.has(ing) ? 'cook-ing-checked' : ''}`}
                    onClick={() => toggleIng(ing)}
                  >
                    <span className="cook-ing-check">{checkedIngs.has(ing) ? '✓' : ''}</span>
                    <span className="cook-ing-name">{ing}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Step area */}
          <div className="cook-step-area">
            <div className="cook-step-counter">
              Step {currentStep + 1} of {totalSteps}
            </div>

            {isOptional && (
              <div className="cook-optional-badge">Optional</div>
            )}

            <div className="cook-step-text">
              {renderStepText(step)}
            </div>

            {timerSecs && (
              <StepTimer key={`${currentStep}-${timerSecs}`} seconds={timerSecs} />
            )}

            <div className="cook-nav">
              <button
                className="cook-nav-btn"
                onClick={() => setCurrentStep(s => Math.max(0, s - 1))}
                disabled={currentStep === 0}
              >
                ← Previous
              </button>
              {currentStep < totalSteps - 1 ? (
                <button
                  className="cook-nav-btn cook-nav-next"
                  onClick={() => setCurrentStep(s => s + 1)}
                >
                  Next →
                </button>
              ) : (
                <button className="cook-nav-btn cook-nav-done" onClick={onClose}>
                  ✓ Done!
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
