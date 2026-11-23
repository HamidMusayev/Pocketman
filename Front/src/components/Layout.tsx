import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { PeriodProvider } from '../context/PeriodContext'
import { useCatchUp } from '../hooks/useRecurring'
import { useSettings } from '../hooks/useSettings'
import { themeVars } from '../lib/theme'
import { InstallPrompt } from './InstallPrompt'
import { TopBar } from './TopBar'
import './shell.css'

export function Layout() {
  const { data: settings } = useSettings()
  const style = themeVars(settings?.accent_color ?? '#FCD535')

  // Recurring payments that came due since the last visit show up as pending
  // on Overview without anyone having to press "Catch up".
  const { mutate: catchUp } = useCatchUp()
  useEffect(() => {
    catchUp()
  }, [catchUp])

  return (
    <PeriodProvider>
      <div style={style} className="app-shell">
        <TopBar />
        <main className="page-container">
          <Outlet />
        </main>
        <InstallPrompt />
      </div>
    </PeriodProvider>
  )
}
