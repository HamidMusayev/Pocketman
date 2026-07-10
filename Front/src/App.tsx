import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginRoute, ProtectedRoute, RootRedirect, SetupRoute } from './auth/guards'
import { Login } from './auth/Login'
import { Setup } from './auth/Setup'
import { Layout } from './components/Layout'
import { SettingsLayout } from './components/SettingsLayout'
import { Overview } from './pages/Overview'
import { Recurring } from './pages/Recurring'
import { Charts } from './pages/Charts'
import { Categories } from './pages/Categories'
import { Accounts } from './pages/Accounts'
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
        <Route path="/recurring" element={<Recurring />} />
        <Route path="/charts" element={<Charts />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/accounts" element={<Accounts />} />
      </Route>

      <Route
        element={
          <ProtectedRoute>
            <SettingsLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
