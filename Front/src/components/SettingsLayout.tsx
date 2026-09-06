import { Outlet } from 'react-router-dom'
import { useSettings } from '../hooks/useSettings'
import { themeVars, useDensity } from '../lib/density'
import { TopBar } from './TopBar'
import './shell.css'

export function SettingsLayout() {
  const { data: settings } = useSettings()
  const [density] = useDensity()
  const style = themeVars(settings?.accent_color ?? '#FCD535', density)

  return (
    <div style={style}>
      <TopBar />
      <div className="page-container">
        <Outlet />
      </div>
    </div>
  )
}
