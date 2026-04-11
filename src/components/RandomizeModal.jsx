import { useState } from 'react'
import { weightedRandom } from '../utils/scoring'

export default function RandomizeModal({ meals, onAdd, onClose }) {
  const [count, setCount] = useState(5)
  const [cooldown, setCooldown] = useState(7)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleRandomize = async () => {
    setLoading(true)
    setError('')
    try {
      const selected = weightedRandom(meals, count, cooldown)
      if (selected.length === 0) {
        setError('No eligible meals found. Try reducing the cooldown.')
        setLoading(false)
        return
      }
      for (const meal of selected) {
        await onAdd(meal.id)
      }
      onClose(selected.length)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-sm slide-up" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2 className="modal-title">🎲 Randomize For Me</h2>

        <div className="form-group">
          <label className="form-label">How many meals?</label>
          <input
            className="form-input"
            type="number"
            min="1"
            max="10"
            value={count}
            onChange={e => setCount(Number(e.target.value))}
          />
        </div>

        <div className="form-group">
          <label className="form-label">
            Skip meals made in the last <strong>{cooldown} days</strong>
          </label>
          <input
            className="range-input"
            type="range"
            min="0"
            max="90"
            value={cooldown}
            onChange={e => setCooldown(Number(e.target.value))}
          />
          <div className="range-labels">
            <span>0 days</span>
            <span>90 days</span>
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="form-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleRandomize} disabled={loading}>
            {loading ? 'Adding…' : 'Randomize'}
          </button>
        </div>
      </div>
    </div>
  )
}
