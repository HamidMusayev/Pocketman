import { useEffect, useRef, useState } from 'react'

const VIDEO_SRC = '/intro/pocketman-intro.mp4'
const POSTER_SRC = '/intro/poster.jpg'
const THUMB_SRC = '/intro/thumb.jpg'

const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.6-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
  </svg>
)

/** "Watch the intro" button for the login/register screen. The video (a short
 * walkthrough recorded on demo data) only loads once the visitor opens it. */
export function IntroVideo() {
  const [open, setOpen] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    closeRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button type="button" className="auth-intro" onClick={() => setOpen(true)}>
        <span className="auth-intro-thumb">
          <img src={THUMB_SRC} alt="" width={96} height={54} />
          <span className="auth-intro-play">
            <PlayIcon />
          </span>
        </span>
        <span className="auth-intro-text">
          <strong>Watch the intro</strong>
          <span>A one-minute tour of Pocketman</span>
        </span>
      </button>

      {open && (
        <div className="auth-video-overlay" onClick={() => setOpen(false)}>
          <div
            className="auth-video-card"
            role="dialog"
            aria-modal="true"
            aria-label="Pocketman intro video"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              ref={closeRef}
              type="button"
              className="auth-video-close"
              onClick={() => setOpen(false)}
              aria-label="Close video"
            >
              ×
            </button>
            <video src={VIDEO_SRC} poster={POSTER_SRC} controls autoPlay muted playsInline preload="auto" />
          </div>
        </div>
      )}
    </>
  )
}
