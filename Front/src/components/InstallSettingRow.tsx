import { useState } from 'react'
import { useInstallMode } from '../hooks/useInstall'
import { promptInstall } from '../lib/install'
import { Chevron } from '../pages/AccountSecurity'
import { InstallStepsModal } from './InstallPrompt'

/** Settings → App: install Pocketman any time, even after "Not now". */
export function InstallSettingRow() {
  const mode = useInstallMode()
  const [showSteps, setShowSteps] = useState(false)

  if (mode === 'installed') {
    return (
      <div className="set-row">
        <span>
          <span className="set-row-label">Add to home screen</span>
          <span className="set-row-hint">Pocketman is installed on this device</span>
        </span>
        <span className="set-row-hint">✓ Installed</span>
      </div>
    )
  }

  const hint =
    mode === 'native'
      ? 'Install Pocketman as an app on this device'
      : mode === 'ios'
        ? 'Share → Add to Home Screen in Safari'
        : 'How to install from your browser menu'

  return (
    <>
      <button
        className="set-row set-row-btn"
        onClick={() => (mode === 'native' ? void promptInstall() : setShowSteps(true))}
      >
        <span>
          <span className="set-row-label">Add to home screen</span>
          <span className="set-row-hint">{hint}</span>
        </span>
        <Chevron />
      </button>
      {showSteps && <InstallStepsModal mode={mode} onClose={() => setShowSteps(false)} />}
    </>
  )
}
