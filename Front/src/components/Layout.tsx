import { Outlet } from 'react-router-dom'
import { PeriodProvider } from '../context/PeriodContext'
import { useSettings } from '../hooks/useSettings'
import { themeVars } from '../lib/theme'
import { PeriodControls } from './PeriodControls'
import { SummaryCards } from './SummaryCards'
import { TopBar } from './TopBar'
import './shell.css'

export function Layout() {
  const { data: settings } = useSettings()
  const style = themeVars(settings?.accent_color ?? '#FCD535')

  return (
    <PeriodProvider>
      <div style={style}>
        <TopBar />
        <PeriodControls />
        <div className="page-container">
          <SummaryCards />
          <Outlet />
        </div>
      </div>
    </PeriodProvider>
  )
}
