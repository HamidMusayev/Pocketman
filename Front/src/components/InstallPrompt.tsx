import { useState } from 'react'
import { useInstallDismissed, useInstallMode } from '../hooks/useInstall'
import { dismissInstall, promptInstall, type InstallMode } from '../lib/install'
import { LogoMark } from './Logo'
import { Modal } from './Modal'
import './install.css'

/** The iOS Share icon (square with an arrow up), so the steps match what
 * the user sees in Safari's toolbar. */
function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
    </svg>
  )
}

/** Step-by-step for browsers that have no install prompt we can trigger. */
export function InstallStepsModal({ mode, onClose }: { mode: InstallMode; onClose: () => void }) {
  return (
    <Modal title="Add to home screen" onClose={onClose}>
      {mode === 'ios' ? (
        <ol className="install-steps">
          <li>
            Tap the <strong>Share</strong> button <span className="install-share"><ShareIcon /></span> in Safari's toolbar.
          </li>
          <li>
            Scroll down and choose <strong>Add to Home Screen</strong>.
          </li>
          <li>
            Tap <strong>Add</strong>. Pocketman opens from your home screen like an app.
          </li>
        </ol>
      ) : (
        <ol className="install-steps">
          <li>Open your browser's menu (⋮ or ⋯).</li>
          <li>
            Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.
          </li>
          <li>
            On iPhone or iPad, open Pocketman in <strong>Safari</strong> and use Share → Add to Home Screen.
          </li>
        </ol>
      )}
      <div className="modal-actions">
        <button className="pm-btn pm-btn-primary" onClick={onClose}>
          Got it
        </button>
      </div>
    </Modal>
  )
}

/** Bottom banner asking "Add Pocketman to your home screen?". Shows only when
 * the app isn't installed yet, an install path exists (native prompt or iOS
 * Safari), and the user hasn't said "Not now" before on this device. */
export function InstallPrompt() {
  const mode = useInstallMode()
  const dismissed = useInstallDismissed()
  const [showSteps, setShowSteps] = useState(false)

  if (showSteps) {
    return (
      <InstallStepsModal
        mode={mode}
        onClose={() => {
          setShowSteps(false)
          dismissInstall() // they've seen how; don't keep asking
        }}
      />
    )
  }
  if (dismissed || (mode !== 'native' && mode !== 'ios')) return null

  return (
    <div className="install-banner" role="dialog" aria-label="Add to home screen">
      <span className="install-banner-logo" aria-hidden="true">
        <LogoMark size={20} />
      </span>
      <span className="install-banner-text">
        <strong>Add Pocketman to your home screen?</strong>
        <span>Opens full screen, one tap away.</span>
      </span>
      <span className="install-banner-actions">
        <button className="pm-btn pm-btn-ghost-elev pm-btn-sm" onClick={dismissInstall}>
          Not now
        </button>
        <button
          className="pm-btn pm-btn-primary pm-btn-sm"
          onClick={async () => {
            if (mode === 'ios') return setShowSteps(true)
            const accepted = await promptInstall()
            if (!accepted) dismissInstall()
          }}
        >
          {mode === 'ios' ? 'Show me' : 'Add'}
        </button>
      </span>
    </div>
  )
}
