import { useEffect, useState, useCallback } from 'react'
import { ArrowLeftRight, Search, AlertCircle, CheckCircle } from 'lucide-react'
import { Account, fetchAccounts, transfer, searchAccountByNumber } from '../lib/api'
import { formatCOP, parseCOPToCents } from '../lib/format'
import { LoadingSpinner, Toast } from '../components/ui'

export function TransferPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [sourceId, setSourceId] = useState('')
  const [targetAccountNumber, setTargetAccountNumber] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [searching, setSearching] = useState(false)
  const [targetInfo, setTargetInfo] = useState<{
    found: boolean
    account_id?: string
    owner_name?: string
    type?: string
  } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const loadAccounts = useCallback(async () => {
    try {
      const data = await fetchAccounts()
      setAccounts(data)
      if (data.length > 0 && !sourceId) setSourceId(data[0].id)
    } catch (err) {
      console.error('Accounts load error:', err)
    } finally {
      setLoading(false)
    }
  }, [sourceId])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  const handleSearch = async () => {
    if (targetAccountNumber.length < 6) return
    setSearching(true)
    setTargetInfo(null)
    try {
      const result = await searchAccountByNumber(targetAccountNumber)
      setTargetInfo(result)
    } catch {
      setTargetInfo({ found: false })
    } finally {
      setSearching(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sourceId || !targetInfo?.found || !targetInfo.account_id) return
    const cents = parseCOPToCents(amount)
    if (cents <= 0) {
      setToast({ type: 'error', message: 'Ingresa un monto válido' })
      return
    }
    setSubmitting(true)
    setToast(null)
    try {
      const result = await transfer(sourceId, targetInfo.account_id, cents, description)
      if (result.status === 'success') {
        setToast({ type: 'success', message: `Transferencia exitosa. Nuevo saldo: ${formatCOP(result.new_balance)}` })
        setAmount('')
        setDescription('')
        setTargetAccountNumber('')
        setTargetInfo(null)
        await loadAccounts()
      } else if (result.status === 'duplicate') {
        setToast({ type: 'error', message: 'Esta transferencia ya fue procesada anteriormente' })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error en la transferencia'
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

  const selectedAccount = accounts.find((a) => a.id === sourceId)
  const cents = parseCOPToCents(amount)

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Transferencia Interna</h1>
        <p className="text-sm text-neutral-500">Envía dinero a otra cuenta NEXUS BANK</p>
      </div>

      {accounts.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-neutral-500">Necesitas crear una cuenta primero.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card space-y-5 p-6">
          {/* Source account */}
          <div>
            <label className="label-field">Cuenta origen</label>
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
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

          {/* Target account */}
          <div>
            <label className="label-field">Cuenta destino (número)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={targetAccountNumber}
                onChange={(e) => {
                  setTargetAccountNumber(e.target.value.replace(/[^0-9]/g, ''))
                  setTargetInfo(null)
                }}
                className="input-field"
                placeholder="12 dígitos"
                maxLength={12}
                required
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={searching || targetAccountNumber.length < 6}
                className="btn-secondary flex-shrink-0"
              >
                {searching ? <LoadingSpinner size={16} /> : <Search size={18} />}
                Buscar
              </button>
            </div>
            {targetInfo && targetInfo.found && (
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-accent-50 px-3 py-2 text-sm text-accent-700">
                <CheckCircle size={16} />
                <span>{targetInfo.owner_name} — Cuenta encontrada</span>
              </div>
            )}
            {targetInfo && !targetInfo.found && (
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
                <AlertCircle size={16} />
                <span>Cuenta no encontrada</span>
              </div>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="label-field">Monto (COP)</label>
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
            {cents > 0 && selectedAccount && (
              <p className={`mt-1.5 text-xs ${cents > selectedAccount.balance ? 'text-danger-600' : 'text-neutral-400'}`}>
                {cents > selectedAccount.balance
                  ? 'Saldo insuficiente'
                  : `Se transferirán ${formatCOP(cents)}`}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="label-field">Descripción (opcional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-field"
              placeholder="Concepto de la transferencia"
              maxLength={100}
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !targetInfo?.found || cents <= 0}
            className="btn-primary w-full"
          >
            {submitting ? (
              <>
                <LoadingSpinner size={16} />
                Procesando...
              </>
            ) : (
              <>
                <ArrowLeftRight size={18} />
                Transferir {cents > 0 ? formatCOP(cents) : ''}
              </>
            )}
          </button>
        </form>
      )}
    </div>
  )
}
