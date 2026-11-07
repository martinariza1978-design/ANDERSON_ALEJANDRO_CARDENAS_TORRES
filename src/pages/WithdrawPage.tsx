import { useEffect, useState, useCallback } from 'react'
import { Building2, AlertCircle } from 'lucide-react'
import { Account, fetchAccounts, withdraw } from '../lib/api'
import { formatCOP, parseCOPToCents } from '../lib/format'
import { LoadingSpinner, Toast } from '../components/ui'

const DAILY_LIMIT = 200000000 // $2,000,000 COP in centavos

export function WithdrawPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [accountId, setAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
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
    setSubmitting(true)
    setToast(null)
    try {
      const result = await withdraw(accountId, cents, description || 'Retiro de cajero')
      if (result.status === 'success') {
        setToast({ type: 'success', message: `Retiro exitoso. Nuevo saldo: ${formatCOP(result.new_balance)}` })
        setAmount('')
        setDescription('')
        await loadAccounts()
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error en el retiro'
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
  const remainingDaily = selectedAccount
    ? DAILY_LIMIT - selectedAccount.daily_withdrawal_total
    : DAILY_LIMIT

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Retiro de Efectivo</h1>
        <p className="text-sm text-neutral-500">Retira dinero de tu cuenta</p>
      </div>

      {accounts.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-neutral-500">Necesitas crear una cuenta primero.</p>
        </div>
      ) : (
        <>
          {/* Daily limit info */}
          <div className="card flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning-50 text-warning-600">
              <AlertCircle size={20} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-neutral-700">Límite diario de retiro</p>
              <p className="text-xs text-neutral-500">
                Disponible hoy: <span className="font-semibold text-neutral-700">{formatCOP(remainingDaily)}</span> de {formatCOP(DAILY_LIMIT)}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="card space-y-5 p-6">
            <div>
              <label className="label-field">Cuenta</label>
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
              <label className="label-field">Monto a retirar (COP)</label>
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
              {cents > 0 && (
                <p className={`mt-1.5 text-xs ${
                  selectedAccount && cents > selectedAccount.balance
                    ? 'text-danger-600'
                    : cents > remainingDaily
                    ? 'text-danger-600'
                    : 'text-neutral-400'
                }`}>
                  {selectedAccount && cents > selectedAccount.balance
                    ? 'Saldo insuficiente'
                    : cents > remainingDaily
                    ? 'Excede el límite diario disponible'
                    : `Retirarás ${formatCOP(cents)}`}
                </p>
              )}
            </div>

            <div>
              <label className="label-field">Descripción (opcional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input-field"
                placeholder="Retiro de cajero automático"
                maxLength={100}
              />
            </div>

            <button
              type="submit"
              disabled={submitting || cents <= 0}
              className="btn-primary w-full"
            >
              {submitting ? (
                <>
                  <LoadingSpinner size={16} />
                  Procesando...
                </>
              ) : (
                <>
                  <Building2 size={18} />
                  Retirar {cents > 0 ? formatCOP(cents) : ''}
                </>
              )}
            </button>
          </form>
        </>
      )}
    </div>
  )
}
