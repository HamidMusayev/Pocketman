import { LogoMark } from '../components/Logo'

export function AuthCardHeader() {
  return (
    <div className="auth-logo">
      <div className="auth-logo-mark">
        <LogoMark />
      </div>
      <div className="auth-logo-text">
        pocket<span>man</span>
      </div>
    </div>
  )
}
