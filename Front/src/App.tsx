import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginRoute, ProtectedRoute, RootRedirect, SetupRoute } from './auth/guards'
import { Login } from './auth/Login'
import { Setup } from './auth/Setup'
import { Layout } from './components/Layout'
import { Accounts } from './pages/Accounts'
import { Budget } from './pages/Budget'
import { Charts } from './pages/Charts'
import { Overview } from './pages/Overview'
import { SettingsPage } from './pages/Settings'

function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route
        path="/setup"
        element={
          <SetupRoute>
            <Setup />
          </SetupRoute>
        }
      />
      <Route
        path="/login"
        element={
          <LoginRoute>
            <Login />
          </LoginRoute>
        }
      />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/overview" element={<Overview />} />
        <Route path="/charts" element={<Charts />} />
        <Route path="/budget" element={<Budget />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/settings" element={<SettingsPage />} />
        {/* old addresses from before Budget absorbed these two tabs */}
        <Route path="/categories" element={<Navigate to="/budget" replace />} />
        <Route path="/recurring" element={<Navigate to="/budget" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
