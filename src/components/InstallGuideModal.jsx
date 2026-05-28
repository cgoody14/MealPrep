import { useState } from 'react'

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
const isAndroid = /android/i.test(navigator.userAgent)

const STEPS = isIOS ? [
  { num: '1', text: 'Open this page in Safari (not Chrome or another browser)' },
  { num: '2', text: <>Tap the <strong>Share</strong> button <span className="install-icon">⎋</span> at the bottom of the screen</> },
  { num: '3', text: <>Scroll down and tap <strong>"Add to Home Screen"</strong></> },
  { num: '4', text: <>Tap <strong>"Add"</strong> in the top right</> },
] : isAndroid ? [
  { num: '1', text: <>Tap the <strong>menu ⋮</strong> in the top right of Chrome</> },
  { num: '2', text: <>Tap <strong>"Add to Home Screen"</strong> or <strong>"Install app"</strong></> },
  { num: '3', text: <>Tap <strong>"Add"</strong> to confirm</> },
] : [
  { num: '1', text: 'Open this page on your phone in Safari (iOS) or Chrome (Android)' },
  { num: '2', text: <>Use the browser menu to tap <strong>"Add to Home Screen"</strong></> },
  { num: '3', text: <>Tap <strong>"Add"</strong> to confirm</> },
]

export default function InstallGuideModal({ onClose }) {
  const [dontShow, setDontShow] = useState(false)

  const handleClose = () => {
    if (dontShow) localStorage.setItem('pwa-guide-dismissed', '1')
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal modal-install slide-up" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={handleClose}>✕</button>

        <div className="install-header">
          <div className="install-app-icon">🍽️</div>
          <h2 className="install-title">Add to Home Screen</h2>
          <p className="install-subtitle">
            Get one-tap access to Rouxlo — no App Store required.
          </p>
        </div>

        <ol className="install-steps">
          {STEPS.map((step, i) => (
            <li key={i} className="install-step">
              <span className="install-step-num">{step.num}</span>
              <span className="install-step-text">{step.text}</span>
            </li>
          ))}
        </ol>

        <label className="install-dont-show">
          <input
            type="checkbox"
            checked={dontShow}
            onChange={e => setDontShow(e.target.checked)}
          />
          Don't show me again
        </label>

        <button className="btn btn-primary btn-full" onClick={handleClose}>
          Got it
        </button>
      </div>
    </div>
  )
}
