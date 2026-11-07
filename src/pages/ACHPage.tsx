import { useEffect, useState, useCallback } from 'react'
import {
  ArrowUpRight,
  Clock,
  CheckCircle,
  XCircle,
  Crown,
  Play,
} from 'lucide-react'
import { Account, ACHTransfer, fetchAccounts, fetchACHTransfers, achTransfer, processACHBatch } from '../lib/api'
import { formatCOP, parseCOPToCents, formatDate } from '../lib/format'
import { LoadingSpinner, Toast, Badge, EmptyState } from '../components/ui'
import { useAuth } from '../lib/auth-context'

const banks = [
  { code: '001', name: 'Banco de Bogotá' },
  { code: '002', name: 'Banco de Occidente' },
  { code: '007', name: 'Bancolombia' },
  { code: '008', name: 'BBVA Colombia' },
  { code: '009', name: 'Banco AV Villas' },
  { code: '012', name: 'Banco GNB Sudameris' },
  { code: '013', name: 'BBVA Colombia' },
  { code: '014', name: 'Banco Davivienda' },
  { code: '019', name: 'Banco Citibank' },
  { code: '023', name: 'Banco BBVA' },
  { code: '031', name: 'BANCOLOMBIA' },
  { code: '032', name: 'Banco de Occidente' },
  { code: '040', name: 'Banco Agrario' },
  { code: '051', name: 'Banco Caja Social' },
  { code: '052', name: 'Banco AV Villas' },
  { code: '059', name: 'Banco Pichincha' },
  { code: '060', name: 'Banco Itaú' },
  { code: '061', name: 'Banco Falabella' },
  { code: '062', name: 'Banco Itaú' },
  { code: '066', name: 'Banco Santander' },
  { code: '239', name: 'Banco Coopcentral' },
  { code: '240', name: 'Banco Cooperativo Coopcentral' },
]

export function ACHPage() {
  const { profile } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [achTransfers, setAchTransfers] = useState<ACHTransfer[]>([])
  const [loading, setLoading] = useState(true)
  const [accountId, setAccountId] = useState('')
  const [bankCode, setBankCode] = useState('')
  const [targetAccount, setTargetAccount] = useState('')
  const [targetOwner, setTargetOwner] = useState('')
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [accs, achs] = await Promise.all([fetchAccounts(), fetchACHTransfers()])
      setAccounts(accs)
      setAchTransfers(achs)
      if (accs.length > 0 && !accountId) setAccountId(accs[0].id)
    } catch (err) {
      console.error('ACH data load error:', err)
    } finally {
      setLoading(false)
    }
  }, [accountId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const isVIP = profile?.category === 'vip'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cents = parseCOPToCents(amount)
    if (cents <= 0) {
      setToast({ type: 'error', message: 'Ingresa un monto válido' })
      return
    }
    const selectedBank = banks.find((b) => b.code === bankCode)
    if (!selectedBank) {
      setToast({ type: 'error', message: 'Selecciona un banco destino' })
      return
    }
    setSubmitting(true)
    setToast(null)
    try {
      const result = await achTransfer(
        accountId,
        selectedBank.code,
        selectedBank.name,
        targetAccount,
        targetOwner,
        cents,
      )
      if (result.status === 'success') {
        const commissionMsg = isVIP ? ' (Sin comisión - VIP)' : ` Comisión: ${formatCOP(result.commission)}`
        setToast({ type: 'success', message: `ACH enviado. Nuevo saldo: ${formatCOP(result.new_balance)}.${commissionMsg}` })
        setAmount('')
        setTargetAccount('')
        setTargetOwner('')
        setBankCode('')
        await loadData()
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error en transferencia ACH'
      setToast({ type: 'error', message: msg })
    } finally {
      setSubmitting(false)
    }
  }

  const handleProcessBatch = async () => {
    setProcessing(true)
    setToast(null)
    try {
      const result = await processACHBatch()
      setToast({
        type: 'success',
        message: `Lote procesado: ${result.processed} transferencias completadas, ${result.failed} fallidas.`,
      })
      await loadData()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al procesar lote'
      setToast({ type: 'error', message: msg })
    } finally {
      setProcessing(false)
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
  const estimatedCommission = isVIP ? 0 : Math.max(Math.ceil(cents * 0.01), 400000)

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Transferencia ACH Interbancaria</h1>
        <p className="text-sm text-neutral-500">Envía dinero a otros bancos en Colombia</p>
      </div>

      {/* VIP notice */}
      {isVIP && (
        <div className="card flex items-center gap-3 border-warning-200 bg-warning-50 p-4">
          <Crown size={20} className="text-warning-600" />
          <div>
            <p className="text-sm font-medium text-warning-800">Cliente VIP</p>
            <p className="text-xs text-warning-700">Estás exento de comisiones ACH</p>
          </div>
        </div>
      )}

      {/* Commission info */}
      {!isVIP && (
        <div className="card flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500">
            <ArrowUpRight size={20} />
          </div>
          <div className="flex-1 text-sm">
            <p className="font-medium text-neutral-700">Comisión ACH: 1% (mín. $4,000 COP)</p>
            <p className="text-xs text-neutral-500">
              {cents > 0
                ? `Comisión estimada: ${formatCOP(estimatedCommission)} — Total a debitar: ${formatCOP(cents + estimatedCommission)}`
                : 'Los clientes VIP están exentos de comisión'}
            </p>
          </div>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-neutral-500">Necesitas crear una cuenta primero.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card space-y-5 p-6">
          <div>
            <label className="label-field">Cuenta origen</label>
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
            <label className="label-field">Banco destino</label>
            <select
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
              className="input-field"
              required
            >
              <option value="">Selecciona un banco</option>
              {banks.map((bank) => (
                <option key={bank.code} value={bank.code}>
                  {bank.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label-field">Cuenta destino</label>
            <input
              type="text"
              value={targetAccount}
              onChange={(e) => setTargetAccount(e.target.value.replace(/[^0-9]/g, ''))}
              className="input-field"
              placeholder="Número de cuenta del beneficiario"
              required
              maxLength={20}
            />
          </div>

          <div>
            <label className="label-field">Nombre del beneficiario</label>
            <input
              type="text"
              value={targetOwner}
              onChange={(e) => setTargetOwner(e.target.value)}
              className="input-field"
              placeholder="Nombre completo del titular"
              required
              maxLength={80}
            />
          </div>

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
              <p className={`mt-1.5 text-xs ${
                cents + estimatedCommission > selectedAccount.balance ? 'text-danger-600' : 'text-neutral-400'
              }`}>
                {cents + estimatedCommission > selectedAccount.balance
                  ? 'Saldo insuficiente (incluyendo comisión)'
                  : `Total a debitar: ${formatCOP(cents + estimatedCommission)}`}
              </p>
            )}
          </div>

          <div className="rounded-xl bg-neutral-50 p-3.5 text-xs text-neutral-500">
            <p>
              Las transferencias ACH se procesan en lote a las 11:00 PM. Puedes procesar el lote
              manualmente para efectos de demostración.
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting || cents <= 0 || !bankCode || !targetAccount || !targetOwner}
            className="btn-primary w-full"
          >
            {submitting ? (
              <>
                <LoadingSpinner size={16} />
                Enviando ACH...
              </>
            ) : (
              <>
                <ArrowUpRight size={18} />
                Enviar transferencia ACH
              </>
            )}
          </button>
        </form>
      )}

      {/* Pending ACH transfers */}
      {achTransfers.length > 0 && (
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-700">Transferencias ACH</h2>
            {achTransfers.some((t) => t.status === 'pending') && (
              <button
                onClick={handleProcessBatch}
                disabled={processing}
                className="btn-secondary"
              >
                {processing ? (
                  <LoadingSpinner size={14} />
                ) : (
                  <Play size={14} />
                )}
                Procesar lote
              </button>
            )}
          </div>
          <div className="space-y-2">
            {achTransfers.map((ach) => (
              <div
                key={ach.id}
                className="flex items-center gap-3 rounded-xl border border-neutral-100 p-3.5"
              >
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                    ach.status === 'processed'
                      ? 'bg-accent-50 text-accent-600'
                      : ach.status === 'pending'
                      ? 'bg-warning-50 text-warning-600'
                      : 'bg-danger-50 text-danger-600'
                  }`}
                >
                  {ach.status === 'processed' ? (
                    <CheckCircle size={16} />
                  ) : ach.status === 'pending' ? (
                    <Clock size={16} />
                  ) : (
                    <XCircle size={16} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-neutral-800">
                    {ach.target_bank_name} — {ach.target_account_number}
                  </div>
                  <div className="text-xs text-neutral-400">
                    {ach.target_owner_name} · {formatDate(ach.created_at)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-neutral-900">{formatCOP(ach.amount)}</div>
                  <div className="text-xs">
                    {ach.status === 'processed' ? (
                      <Badge color="success">Procesada</Badge>
                    ) : ach.status === 'pending' ? (
                      <Badge color="warning">Pendiente</Badge>
                    ) : (
                      <Badge color="danger">Fallida</Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
