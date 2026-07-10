import { Outlet } from 'react-router-dom'
import { useSettings } from '../hooks/useSettings'
import { themeVars } from '../lib/density'
import { TopBar } from './TopBar'
import './shell.css'

export function SettingsLayout() {
  const { data: settings } = useSettings()
  const style = themeVars(settings?.accent_color ?? '#FCD535')

  return (
    <div style={style}>
      <TopBar />
      <div className="page-container">
        <Outlet />
      </div>
    </div>
  )
}
