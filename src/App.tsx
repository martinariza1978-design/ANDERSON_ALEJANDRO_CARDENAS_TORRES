import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth-context'
import { FullPageLoader } from './components/ui'
import { AppLayout } from './components/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { DashboardPage } from './pages/DashboardPage'
import { AccountsPage } from './pages/AccountsPage'
import { TransferPage } from './pages/TransferPage'
import { WithdrawPage } from './pages/WithdrawPage'
import { PayPage } from './pages/PayPage'
import { RechargePage } from './pages/RechargePage'
import { ACHPage } from './pages/ACHPage'
import { AuditPage } from './pages/AuditPage'

function ProtectedRoutes() {
  const { user, loading } = useAuth()

  if (loading) return <FullPageLoader />
  if (!user) return <Navigate to="/login" replace />

  return (
    <AppLayout>
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/transfer" element={<TransferPage />} />
        <Route path="/withdraw" element={<WithdrawPage />} />
        <Route path="/pay" element={<PayPage />} />
        <Route path="/recharge" element={<RechargePage />} />
        <Route path="/ach" element={<ACHPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AppLayout>
  )
}

function AppRoutes() {
  const { loading } = useAuth()

  if (loading) return <FullPageLoader />

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/*" element={<ProtectedRoutes />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
