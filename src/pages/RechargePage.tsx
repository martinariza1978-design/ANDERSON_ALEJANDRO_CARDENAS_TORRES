import { useEffect, useState, useCallback } from 'react'
import { Smartphone } from 'lucide-react'
import { Account, fetchAccounts, recharge } from '../lib/api'
import { formatCOP, parseCOPToCents } from '../lib/format'
import { LoadingSpinner, Toast } from '../components/ui'

const quickAmounts = [
  { label: '$1,000', cents: 100000 },
  { label: '$2,000', cents: 200000 },
  { label: '$5,000', cents: 500000 },
  { label: '$10,000', cents: 1000000 },
  { label: '$20,000', cents: 2000000 },
  { label: '$50,000', cents: 5000000 },
]

export function RechargePage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [accountId, setAccountId] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const loadAccounts = useCallback(async () => {
    try {
      const data = await fetchAccounts()
      setAccounts(data)
      if (data.length > 0 && !accountId) setAccountId(data[0].id)
    } catch (err) {
      console.error('Accounts load error:', err)
    } finally {
      setLoading(false)
    }
  }, [accountId])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cents = parseCOPToCents(amount)
    if (cents <= 0) {
      setToast({ type: 'error', message: 'Ingresa un monto válido' })
      return
    }
    if (phoneNumber.length !== 10) {
      setToast({ type: 'error', message: 'El número de teléfono debe tener 10 dígitos' })
      return
    }
    setSubmitting(true)
    setToast(null)
    try {
      const result = await recharge(accountId, phoneNumber, cents)
      if (result.status === 'success') {
        setToast({ type: 'success', message: `Recarga exitosa a ${phoneNumber}. Nuevo saldo: ${formatCOP(result.new_balance)}` })
        setAmount('')
        setPhoneNumber('')
        await loadAccounts()
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al recargar'
      setToast({ type: 'error', message: msg })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size={32} />
      </div>
    )
  }

  const selectedAccount = accounts.find((a) => a.id === accountId)
  const cents = parseCOPToCents(amount)

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Recarga Móvil</h1>
        <p className="text-sm text-neutral-500">Recarga saldo a cualquier teléfono</p>
      </div>

      {accounts.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-neutral-500">Necesitas crear una cuenta primero.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card space-y-5 p-6">
          <div>
            <label className="label-field">Cuenta de cargo</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="input-field"
              required
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.account_number} — {formatCOP(acc.balance)}
                </option>
              ))}
            </select>
            {selectedAccount && (
              <p className="mt-1.5 text-xs text-neutral-400">
                Saldo disponible: {formatCOP(selectedAccount.balance)}
              </p>
            )}
          </div>

          <div>
            <label className="label-field">Número de teléfono</label>
            <div className="relative">
              <Smartphone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, ''))}
                className="input-field pl-11"
                placeholder="3001234567"
                maxLength={10}
                required
              />
            </div>
            <p className="mt-1.5 text-xs text-neutral-400">10 dígitos sin espacios</p>
          </div>

          <div>
            <label className="label-field">Monto de recarga (COP)</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-neutral-400">$</span>
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input-field pl-8"
                placeholder="0"
                required
              />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {quickAmounts.map((qa) => (
                <button
                  key={qa.cents}
                  type="button"
                  onClick={() => setAmount(String(qa.cents / 100))}
                  className={`rounded-lg border px-2 py-2 text-xs font-medium transition-all ${
                    cents === qa.cents
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-neutral-200 text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50'
                  }`}
                >
                  {qa.label}
                </button>
              ))}
            </div>
            {cents > 0 && selectedAccount && cents > selectedAccount.balance && (
              <p className="mt-2 text-xs text-danger-600">Saldo insuficiente</p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || cents <= 0 || phoneNumber.length !== 10}
            className="btn-primary w-full"
          >
            {submitting ? (
              <>
                <LoadingSpinner size={16} />
                Procesando...
              </>
            ) : (
              <>
                <Smartphone size={18} />
                Recargar {cents > 0 ? formatCOP(cents) : ''}
              </>
            )}
          </button>
        </form>
      )}
    </div>
  )
}
