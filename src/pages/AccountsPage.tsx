import { useEffect, useState, useCallback } from 'react'
import {
  PiggyBank,
  Landmark,
  Wallet,
  Plus,
  CheckCircle,
  Copy,
  ArrowLeftRight,
} from 'lucide-react'
import { Account, fetchAccounts, createAccount } from '../lib/api'
import { formatCOP, formatDate, getAccountTypeLabel, maskAccountNumber } from '../lib/format'
import { useNavigate } from 'react-router-dom'
import { Modal, LoadingSpinner, Badge } from '../components/ui'

const accountTypes = [
  {
    type: 'savings' as const,
    label: 'Cuenta de Ahorros',
    icon: PiggyBank,
    description: 'Cuenta con bono de bienvenida de $100,000 COP y generación de intereses diarios.',
    bonus: '$100,000 COP de bienvenida',
    color: 'bg-accent-50 text-accent-600',
    borderColor: 'border-accent-200',
  },
  {
    type: 'checking' as const,
    label: 'Cuenta Corriente',
    icon: Landmark,
    description: 'Cuenta para transacciones de alto volumen con depósito inicial de $500,000 COP.',
    bonus: '$500,000 COP iniciales',
    color: 'bg-primary-50 text-primary-600',
    borderColor: 'border-primary-200',
  },
  {
    type: 'wallet' as const,
    label: 'Billetera Digital',
    icon: Wallet,
    description: 'Billetera para pagos rápidos, recargas y transferencias con saldo inicial.',
    bonus: '$50,000 COP iniciales',
    color: 'bg-warning-50 text-warning-600',
    borderColor: 'border-warning-200',
  },
]

export function AccountsPage() {
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const loadAccounts = useCallback(async () => {
    try {
      const data = await fetchAccounts()
      setAccounts(data)
    } catch (err) {
      console.error('Accounts load error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  const handleCreate = async (type: 'savings' | 'checking' | 'wallet') => {
    setError('')
    setCreating(true)
    try {
      await createAccount(type)
      await loadAccounts()
      setShowCreateModal(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al crear cuenta'
      setError(msg)
    } finally {
      setCreating(false)
    }
  }

  const handleCopy = (number: string, id: string) => {
    navigator.clipboard.writeText(number)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size={32} />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Mis Cuentas</h1>
          <p className="text-sm text-neutral-500">Gestiona tus productos financieros</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary">
          <Plus size={18} />
          Nueva cuenta
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="card p-10">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
              <Wallet size={28} />
            </div>
            <h3 className="mb-1 text-base font-semibold text-neutral-700">No tienes cuentas</h3>
            <p className="mb-5 max-w-sm text-sm text-neutral-500">
              Crea tu primera cuenta para empezar a usar los servicios de NEXUS BANK.
            </p>
            <button onClick={() => setShowCreateModal(true)} className="btn-primary">
              <Plus size={18} />
              Crear cuenta
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {accounts.map((account) => {
            const typeConfig = accountTypes.find((t) => t.type === account.type)
            const Icon = typeConfig?.icon || Wallet
            return (
              <div
                key={account.id}
                className={`card overflow-hidden border-l-4 ${typeConfig?.borderColor || ''}`}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${typeConfig?.color || ''}`}>
                        <Icon size={22} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-neutral-900">
                          {getAccountTypeLabel(account.type)}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                          <span>No. {account.account_number}</span>
                          <button
                            onClick={() => handleCopy(account.account_number, account.id)}
                            className="text-neutral-400 transition-colors hover:text-primary-600"
                          >
                            {copiedId === account.id ? <CheckCircle size={12} /> : <Copy size={12} />}
                          </button>
                        </div>
                      </div>
                    </div>
                    {account.is_active ? (
                      <Badge color="success">Activa</Badge>
                    ) : (
                      <Badge color="danger">Inactiva</Badge>
                    )}
                  </div>

                  <div className="mt-5">
                    <p className="text-xs text-neutral-400">Saldo disponible</p>
                    <p className="text-2xl font-bold text-neutral-900">{formatCOP(account.balance)}</p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3">
                    <span className="text-xs text-neutral-400">
                      Creada el {formatDate(account.created_at)}
                    </span>
                    <button
                      onClick={() => navigate('/transfer')}
                      className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
                    >
                      <ArrowLeftRight size={14} />
                      Transferir
                    </button>
                  </div>

                  {account.type === 'savings' && (
                    <div className="mt-3 rounded-lg bg-accent-50 px-3 py-2 text-xs text-accent-700">
                      Acumulas intereses diarios (0.5% mensual)
                    </div>
                  )}
                  {account.type === 'savings' && account.daily_withdrawal_total > 0 && (
                    <div className="mt-2 text-xs text-neutral-400">
                      Retirado hoy: {formatCOP(account.daily_withdrawal_total)} / {formatCOP(200000000)}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create account modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Crear nueva cuenta">
        {error && (
          <div className="mb-4 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
            {error}
          </div>
        )}
        <p className="mb-4 text-sm text-neutral-500">
          Elige el tipo de cuenta que deseas abrir. Cada una tiene beneficios distintos.
        </p>
        <div className="space-y-3">
          {accountTypes.map((opt) => {
            const Icon = opt.icon
            return (
              <button
                key={opt.type}
                onClick={() => handleCreate(opt.type)}
                disabled={creating}
                className="group flex w-full items-center gap-4 rounded-xl border border-neutral-200 p-4 text-left transition-all hover:border-primary-300 hover:bg-primary-50/30 disabled:opacity-50"
              >
                <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${opt.color}`}>
                  <Icon size={22} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-neutral-900">{opt.label}</span>
                    {creating && <LoadingSpinner size={14} className="text-primary-600" />}
                  </div>
                  <p className="mt-0.5 text-xs text-neutral-500">{opt.description}</p>
                  <div className="mt-1.5">
                    <span className="text-xs font-medium text-accent-600">{opt.bonus}</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </Modal>
    </div>
  )
}
