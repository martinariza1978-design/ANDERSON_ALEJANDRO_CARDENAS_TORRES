import { useEffect, useState, useCallback } from 'react'
import {
  Receipt,
  Zap,
  Droplets,
  Flame,
  Phone,
  Wifi,
  Tv,
  Play,
  Music,
  Film,
  Building,
  Car,
  Smartphone,
  LucideIcon,
} from 'lucide-react'
import { Account, ServiceItem, fetchAccounts, fetchServices, payService } from '../lib/api'
import { formatCOP, parseCOPToCents } from '../lib/format'
import { LoadingSpinner, Toast, Badge } from '../components/ui'

const iconMap: Record<string, LucideIcon> = {
  Zap,
  Droplets,
  Flame,
  Phone,
  Smartphone,
  Wifi,
  Tv,
  Play,
  Music,
  Film,
  Building,
  Car,
  Receipt,
}

const categoryLabels: Record<string, string> = {
  utility: 'Servicios públicos',
  telecom: 'Telecomunicaciones',
  streaming: 'Streaming',
  other: 'Impuestos y otros',
}

export function PayPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [services, setServices] = useState<ServiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [accountId, setAccountId] = useState('')
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null)
  const [reference, setReference] = useState('')
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [accs, svcs] = await Promise.all([fetchAccounts(), fetchServices()])
      setAccounts(accs)
      setServices(svcs)
      if (accs.length > 0 && !accountId) setAccountId(accs[0].id)
    } catch (err) {
      console.error('Data load error:', err)
    } finally {
      setLoading(false)
    }
  }, [accountId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedService || !accountId) return
    const cents = parseCOPToCents(amount)
    if (cents <= 0) {
      setToast({ type: 'error', message: 'Ingresa un monto válido' })
      return
    }
    if (!reference.trim()) {
      setToast({ type: 'error', message: 'Ingresa la referencia del servicio' })
      return
    }
    setSubmitting(true)
    setToast(null)
    try {
      const result = await payService(accountId, selectedService.id, reference, cents)
      if (result.status === 'success') {
        setToast({ type: 'success', message: `Pago de ${selectedService.name} exitoso. Nuevo saldo: ${formatCOP(result.new_balance)}` })
        setAmount('')
        setReference('')
        setSelectedService(null)
        await loadData()
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al pagar'
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

  // Group services by category
  const grouped = services.reduce<Record<string, ServiceItem[]>>((acc, svc) => {
    if (!acc[svc.category]) acc[svc.category] = []
    acc[svc.category].push(svc)
    return acc
  }, {})

  if (accounts.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Pago de Servicios</h1>
          <p className="text-sm text-neutral-500">Necesitas una cuenta para pagar servicios</p>
        </div>
        <div className="card p-8 text-center">
          <p className="text-sm text-neutral-500">Crea una cuenta primero para usar esta función.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Pago de Servicios</h1>
        <p className="text-sm text-neutral-500">Paga tus facturas y suscripciones</p>
      </div>

      {!selectedService ? (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="card p-5">
              <h2 className="mb-3 text-sm font-semibold text-neutral-700">{categoryLabels[category] || category}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((svc) => {
                  const Icon = iconMap[svc.icon] || Receipt
                  return (
                    <button
                      key={svc.id}
                      onClick={() => setSelectedService(svc)}
                      className="group flex items-center gap-3 rounded-xl border border-neutral-100 p-3.5 text-left transition-all hover:border-primary-200 hover:bg-primary-50/30 active:scale-[0.98]"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600 transition-transform group-hover:scale-110">
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-neutral-800">{svc.name}</div>
                        <div className="text-xs text-neutral-400">
                          {formatCOP(svc.min_amount)} - {formatCOP(svc.max_amount)}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card space-y-5 p-6">
          <div className="flex items-center gap-3 border-b border-neutral-100 pb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
              {(() => {
                const Icon = iconMap[selectedService.icon] || Receipt
                return <Icon size={22} />
              })()}
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-neutral-900">{selectedService.name}</h3>
              <Badge color="primary">{categoryLabels[selectedService.category]}</Badge>
            </div>
            <button
              type="button"
              onClick={() => setSelectedService(null)}
              className="text-sm text-neutral-500 hover:text-neutral-700"
            >
              Cambiar
            </button>
          </div>

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
            <label className="label-field">Referencia / Factura</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="input-field"
              placeholder="Número de referencia o contrato"
              required
              maxLength={30}
            />
          </div>

          <div>
            <label className="label-field">
              Monto a pagar (COP)
              <span className="ml-2 text-xs font-normal text-neutral-400">
                Min: {formatCOP(selectedService.min_amount)} — Max: {formatCOP(selectedService.max_amount)}
              </span>
            </label>
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
                cents < selectedService.min_amount || cents > selectedService.max_amount
                  ? 'text-danger-600'
                  : selectedAccount && cents > selectedAccount.balance
                  ? 'text-danger-600'
                  : 'text-neutral-400'
              }`}>
                {cents < selectedService.min_amount
                  ? `El monto mínimo es ${formatCOP(selectedService.min_amount)}`
                  : cents > selectedService.max_amount
                  ? `El monto máximo es ${formatCOP(selectedService.max_amount)}`
                  : selectedAccount && cents > selectedAccount.balance
                  ? 'Saldo insuficiente'
                  : `Pagarás ${formatCOP(cents)}`}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || cents <= 0 || !reference.trim()}
            className="btn-primary w-full"
          >
            {submitting ? (
              <>
                <LoadingSpinner size={16} />
                Procesando pago...
              </>
            ) : (
              <>
                <Receipt size={18} />
                Pagar {cents > 0 ? formatCOP(cents) : ''}
              </>
            )}
          </button>
        </form>
      )}
    </div>
  )
}
