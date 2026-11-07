import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react'
import { useAuth } from '../lib/auth-context'

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/dashboard')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al iniciar sesión'
      if (msg.includes('Invalid login')) {
        setError('Correo o contraseña incorrectos. Tras 3 intentos fallidos, tu cuenta se bloqueará por 24 horas.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-primary-950 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-white/10 backdrop-blur-sm">
            <svg viewBox="0 0 24 24" fill="none" className="h-9 w-9 text-white" stroke="currentColor" strokeWidth="2">
              <path d="M3 10h18M5 10v8a2 2 0 002 2h10a2 2 0 002-2v-8M7 6h10a2 2 0 012 2v2H5V8a2 2 0 012-2z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">NEXUS BANK</h1>
          <p className="mt-1 text-sm text-primary-200">Core Financiero y Billetera Digital</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-white p-8 shadow-2xl animate-slide-up">
          <h2 className="mb-1 text-xl font-bold text-neutral-900">Iniciar Sesión</h2>
          <p className="mb-6 text-sm text-neutral-500">Accede a tu cuenta bancaria</p>

          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
              <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label-field">Correo electrónico</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field pl-11"
                  placeholder="tu@email.com"
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="label-field">Contraseña</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pl-11 pr-11"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 transition-colors hover:text-neutral-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Ingresando...
                </>
              ) : (
                'Ingresar'
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-neutral-100 pt-5 text-center">
            <p className="text-sm text-neutral-500">
              ¿No tienes cuenta?{' '}
              <Link to="/register" className="font-semibold text-primary-600 hover:text-primary-700">
                Regístrate aquí
              </Link>
            </p>
          </div>
        </div>

        {/* Security note */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-primary-200">
          <ShieldCheck size={14} />
          <span>Conexión segura cifrada de extremo a extremo</span>
        </div>
      </div>
    </div>
  )
}
