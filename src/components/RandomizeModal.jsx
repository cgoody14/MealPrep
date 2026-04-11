import { useState } from 'react'
import Stars from './Stars'
import { weightedRandom } from '../utils/scoring'

export default function RandomizeModal({ meals, onAdd, onClose }) {
  const [countInput, setCountInput] = useState('5')
  const [cooldown, setCooldown] = useState(1)
  const [results, setResults] = useState([])
  const [generated, setGenerated] = useState(false)
  const [error, setError] = useState('')
  const [countError, setCountError] = useState('')
  const [addedIds, setAddedIds] = useState(new Set())
  const [addingId, setAddingId] = useState(null)
  const [addingAll, setAddingAll] = useState(false)

  const handleRandomize = () => {
    const count = parseInt(countInput, 10) || 0
    if (count === 0) {
      setCountError('Enter a number of meals to generate')
      return
    }
    setCountError('')
    setError('')
    const cooldownDays = cooldown * 7
    const selected = weightedRandom(meals, count, cooldownDays)
    if (selected.length === 0) {
      setError('No eligible meals found. Try reducing the cooldown.')
      return
    }
    setResults(selected)
    setGenerated(true)
    setAddedIds(new Set())
  }

  const handleAddOne = async (meal) => {
    setAddingId(meal.id)
    try {
      await onAdd(meal.id)
      setAddedIds(prev => new Set([...prev, meal.id]))
    } finally {
      setAddingId(null)
    }
  }

  const handleAddAll = async () => {
    setAddingAll(true)
    try {
      for (const meal of results) {
        if (!addedIds.has(meal.id)) {
          await onAdd(meal.id)
        }
      }
      setAddedIds(new Set(results.map(m => m.id)))
    } finally {
      setAddingAll(false)
    }
  }

  // Pass count of added meals back to parent on any close action
  const handleClose = () => onClose(addedIds.size)

  const allAdded = results.length > 0 && results.every(m => addedIds.has(m.id))

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal modal-rand slide-up" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={handleClose}>✕</button>
        <h2 className="modal-title">🎲 Randomize For Me</h2>

        <div className="form-group">
          <label className="form-label">How many meals?</label>
          <input
            className="form-input"
            type="text"
            inputMode="numeric"
            value={countInput}
            onChange={e => {
              const raw = e.target.value.replace(/[^0-9]/g, '')
              setCountInput(raw)
            }}
            onBlur={e => {
              if (e.target.value === '' || e.target.value === '0') setCountInput('0')
            }}
            placeholder="0"
          />
          {countError && <div className="form-error" style={{ marginTop: 6 }}>{countError}</div>}
        </div>

        <div className="form-group">
          <label className="form-label">
            {cooldown === 0
              ? 'No cooldown — all meals eligible'
              : `Skip meals made in the last ${cooldown} week${cooldown === 1 ? '' : 's'}`}
          </label>
          <input
            className="range-input"
            type="range"
            min="0"
            max="13"
            value={cooldown}
            onChange={e => setCooldown(Number(e.target.value))}
          />
          <div className="range-labels">
            <span>0 weeks</span>
            <span>13 weeks</span>
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="form-footer">
          <button className="btn btn-ghost" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleRandomize}>
            Randomize
          </button>
        </div>

        {generated && results.length > 0 && (
          <div className="rand-results">
            <div className="rand-results-title">{results.length} meal{results.length !== 1 ? 's' : ''} suggested</div>
            {results.map(meal => (
              <div key={meal.id} className="rand-result-card">
                <div className="rand-result-info">
                  <div className="rand-result-name">{meal.name}</div>
                  <div className="rand-result-meta">
                    <Stars rating={meal.rating} size="sm" />
                    {meal.cook_time && <span className="rand-result-cook">⏱ {meal.cook_time}</span>}
                  </div>
                  {meal.tags?.length > 0 && (
                    <div className="tag-row" style={{ marginTop: 4 }}>
                      {meal.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="tag">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  className={`btn btn-sm ${addedIds.has(meal.id) ? 'btn-secondary' : 'btn-primary'}`}
                  onClick={() => handleAddOne(meal)}
                  disabled={addedIds.has(meal.id) || addingId === meal.id}
                >
                  {addedIds.has(meal.id) ? '✓ Added' : addingId === meal.id ? '…' : '+ Week'}
                </button>
              </div>
            ))}
            <button
              className="btn btn-primary btn-full"
              onClick={handleAddAll}
              disabled={addingAll || allAdded}
              style={{ marginTop: 14 }}
            >
              {addingAll ? 'Adding…' : allAdded ? '✓ All Added to This Week' : 'Add All to This Week'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
