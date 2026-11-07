import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Mail, Lock, User, Phone, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'
import { useAuth } from '../lib/auth-context'

export function RegisterPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const passwordChecks = [
    { label: 'Mínimo 6 caracteres', valid: password.length >= 6 },
    { label: 'Una mayúscula', valid: /[A-Z]/.test(password) },
    { label: 'Un número', valid: /\d/.test(password) },
  ]

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setLoading(true)
    try {
      await signUp(email, password, fullName, phone)
      navigate('/dashboard')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al registrar'
      if (msg.includes('already registered') || msg.includes('already exists')) {
        setError('Este correo ya está registrado. Intenta iniciar sesión.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-primary-950 px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-white/10 backdrop-blur-sm">
            <svg viewBox="0 0 24 24" fill="none" className="h-9 w-9 text-white" stroke="currentColor" strokeWidth="2">
              <path d="M3 10h18M5 10v8a2 2 0 002 2h10a2 2 0 002-2v-8M7 6h10a2 2 0 012 2v2H5V8a2 2 0 012-2z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">NEXUS BANK</h1>
          <p className="mt-1 text-sm text-primary-200">Crea tu cuenta en minutos</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-white p-8 shadow-2xl animate-slide-up">
          <h2 className="mb-1 text-xl font-bold text-neutral-900">Crear Cuenta</h2>
          <p className="mb-6 text-sm text-neutral-500">Completa tus datos para registrarte</p>

          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
              <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label-field">Nombre completo</label>
              <div className="relative">
                <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input-field pl-11"
                  placeholder="Juan Pérez"
                  autoComplete="name"
                />
              </div>
            </div>

            <div>
              <label className="label-field">Teléfono (opcional)</label>
              <div className="relative">
                <Phone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input-field pl-11"
                  placeholder="3001234567"
                  autoComplete="tel"
                />
              </div>
            </div>

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
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 transition-colors hover:text-neutral-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {password && (
                <div className="mt-2 space-y-1">
                  {passwordChecks.map((check) => (
                    <div key={check.label} className="flex items-center gap-1.5 text-xs">
                      <CheckCircle
                        size={12}
                        className={check.valid ? 'text-accent-500' : 'text-neutral-300'}
                      />
                      <span className={check.valid ? 'text-accent-600' : 'text-neutral-400'}>
                        {check.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="label-field">Confirmar contraseña</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-field pl-11"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Registrando...
                </>
              ) : (
                'Crear cuenta'
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-neutral-100 pt-5 text-center">
            <p className="text-sm text-neutral-500">
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" className="font-semibold text-primary-600 hover:text-primary-700">
                Inicia sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
