import { ReactNode, useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import {
  LayoutDashboard,
  ArrowLeftRight,
  Building2,
  Receipt,
  Smartphone,
  Wallet,
  ScrollText,
  LogOut,
  Menu,
  X,
  Crown,
  Lock,
} from 'lucide-react'
import { useAuth } from '../lib/auth-context'
import { Badge } from './ui'

const navItems = [
  { path: '/dashboard', label: 'Resumen', icon: LayoutDashboard },
  { path: '/accounts', label: 'Cuentas', icon: Wallet },
  { path: '/transfer', label: 'Transferencias', icon: ArrowLeftRight },
  { path: '/withdraw', label: 'Retiros', icon: Building2 },
  { path: '/pay', label: 'Pagos', icon: Receipt },
  { path: '/recharge', label: 'Recargas', icon: Smartphone },
  { path: '/ach', label: 'ACH Interbancario', icon: ArrowLeftRight },
  { path: '/audit', label: 'Auditoría', icon: ScrollText },
]

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, profile, signOut, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-800 text-white shadow-lg">
            <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" stroke="currentColor" strokeWidth="2">
              <path d="M3 10h18M5 10v8a2 2 0 002 2h10a2 2 0 002-2v-8M7 6h10a2 2 0 012 2v2H5V8a2 2 0 012-2z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-200 border-t-primary-800" />
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const isLocked = profile?.status === 'locked' && (profile?.locked_until === null || new Date(profile.locked_until) > new Date())

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-neutral-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-neutral-200 bg-white transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-800 text-white shadow-md">
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="2">
                <path d="M3 10h18M5 10v8a2 2 0 002 2h10a2 2 0 002-2v-8M7 6h10a2 2 0 012 2v2H5V8a2 2 0 012-2z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-bold text-primary-800">NEXUS BANK</div>
              <div className="text-[10px] text-neutral-400">Core Financiero</div>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        {/* User info */}
        <div className="border-b border-neutral-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
              {profile?.full_name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-neutral-800">
                {profile?.full_name || 'Usuario'}
              </div>
              <div className="flex items-center gap-1.5">
                {profile?.category === 'vip' ? (
                  <Badge color="warning">
                    <Crown size={10} className="mr-1" />
                    VIP
                  </Badge>
                ) : (
                  <Badge color="neutral">Estándar</Badge>
                )}
                {isLocked && (
                  <Badge color="danger">
                    <Lock size={10} className="mr-1" />
                    Bloqueada
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = location.pathname === item.path
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path)
                    setSidebarOpen(false)
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
                    active
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                  }`}
                >
                  <Icon size={18} className={active ? 'text-primary-600' : 'text-neutral-400'} />
                  {item.label}
                </button>
              )
            })}
          </div>
        </nav>

        {/* Sign out */}
        <div className="border-t border-neutral-100 p-3">
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-danger-600 transition-all hover:bg-danger-50"
          >
            <LogOut size={18} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar (mobile) */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-neutral-200 bg-white/80 px-4 py-3 backdrop-blur-md lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100">
            <Menu size={22} />
          </button>
          <span className="text-sm font-bold text-primary-800">NEXUS BANK</span>
          <div className="w-10" />
        </div>

        {/* Page content */}
        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {isLocked && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-danger-200 bg-danger-50 px-5 py-4 text-sm text-danger-700">
              <Lock size={20} className="flex-shrink-0" />
              <div>
                <strong>Cuenta bloqueada.</strong> Tu cuenta ha sido bloqueada por 3 intentos fallidos de inicio de sesión.
                {profile?.locked_until && (
                  <> Se desbloqueará el {new Date(profile.locked_until).toLocaleString('es-CO')}.</>
                )}
              </div>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  )
}
