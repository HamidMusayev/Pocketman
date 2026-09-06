import { Outlet } from 'react-router-dom'
import { PeriodProvider } from '../context/PeriodContext'
import { useSettings } from '../hooks/useSettings'
import { themeVars, useDensity } from '../lib/density'
import { PeriodControls } from './PeriodControls'
import { SummaryCards } from './SummaryCards'
import { TopBar } from './TopBar'
import './shell.css'

export function Layout() {
  const { data: settings } = useSettings()
  const [density] = useDensity()
  const style = themeVars(settings?.accent_color ?? '#FCD535', density)

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
