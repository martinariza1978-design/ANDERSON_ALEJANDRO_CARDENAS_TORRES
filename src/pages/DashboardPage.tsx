import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  Building2,
  Receipt,
  Smartphone,
  PiggyBank,
  Landmark,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
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
  CreditCard,
  LucideIcon,
} from 'lucide-react'
import { Account, Transaction, fetchAccounts, fetchTransactions } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { formatCOP, formatDate, getTransactionTypeLabel, getTransactionTypeColor, getTransactionSign, getAccountTypeLabel } from '../lib/format'
import { LoadingSpinner } from '../components/ui'

const iconMap: Record<string, LucideIcon> = {
  PiggyBank,
  Landmark,
  Wallet,
  CreditCard,
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

const accountIcon: Record<string, LucideIcon> = {
  savings: PiggyBank,
  checking: Landmark,
  wallet: Wallet,
}

const quickActions = [
  { label: 'Transferir', icon: ArrowLeftRight, path: '/transfer', color: 'bg-primary-50 text-primary-600' },
  { label: 'Retirar', icon: Building2, path: '/withdraw', color: 'bg-warning-50 text-warning-600' },
  { label: 'Pagar', icon: Receipt, path: '/pay', color: 'bg-accent-50 text-accent-600' },
  { label: 'Recargar', icon: Smartphone, path: '/recharge', color: 'bg-primary-50 text-primary-600' },
  { label: 'ACH', icon: ArrowUpRight, path: '/ach', color: 'bg-neutral-100 text-neutral-600' },
]

export function DashboardPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const [accs, txs] = await Promise.all([fetchAccounts(), fetchTransactions(undefined, 10)])
      setAccounts(accs)
      setTransactions(txs)
    } catch (err) {
      console.error('Dashboard load error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size={32} />
      </div>
    )
  }

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0)
  const firstName = profile?.full_name?.split(' ')[0] || 'Usuario'

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Hola, {firstName}</h1>
        <p className="text-sm text-neutral-500">Aquí está el resumen de tus cuentas</p>
      </div>

      {/* Total balance card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-800 to-primary-950 p-6 shadow-xl">
        <div className="absolute right-0 top-0 h-40 w-40 -translate-y-12 translate-x-12 rounded-full bg-white/5" />
        <div className="absolute bottom-0 right-8 h-24 w-24 translate-y-8 rounded-full bg-white/5" />
        <div className="relative">
          <p className="text-sm text-primary-200">Balance total</p>
          <p className="mt-1 text-3xl font-bold text-white">{formatCOP(totalBalance)}</p>
          <div className="mt-4 flex items-center gap-2 text-sm text-primary-200">
            <Wallet size={16} />
            <span>{accounts.length} {accounts.length === 1 ? 'cuenta activa' : 'cuentas activas'}</span>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="card p-5">
        <h2 className="mb-4 text-sm font-semibold text-neutral-700">Acciones rápidas</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.label}
                onClick={() => navigate(action.path)}
                className="group flex flex-col items-center gap-2.5 rounded-xl border border-neutral-100 p-4 transition-all hover:border-neutral-200 hover:shadow-md active:scale-[0.97]"
              >
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${action.color} transition-transform group-hover:scale-110`}>
                  <Icon size={20} />
                </div>
                <span className="text-xs font-medium text-neutral-700">{action.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Accounts */}
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-700">Mis cuentas</h2>
            <button
              onClick={() => navigate('/accounts')}
              className="text-xs font-medium text-primary-600 hover:text-primary-700"
            >
              Ver todas
            </button>
          </div>
          {accounts.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
                <Wallet size={24} />
              </div>
              <p className="text-sm text-neutral-500">No tienes cuentas aún</p>
              <button
                onClick={() => navigate('/accounts')}
                className="btn-primary mt-4"
              >
                <Plus size={16} />
                Crear cuenta
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => {
                const Icon = accountIcon[account.type] || CreditCard
                return (
                  <div
                    key={account.id}
                    className="flex items-center gap-3.5 rounded-xl border border-neutral-100 p-3.5 transition-all hover:border-neutral-200 hover:bg-neutral-50"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                      <Icon size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-neutral-800">
                        {getAccountTypeLabel(account.type)}
                      </div>
                      <div className="text-xs text-neutral-400">No. {account.account_number}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-neutral-900">{formatCOP(account.balance)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent transactions */}
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-700">Movimientos recientes</h2>
          </div>
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
                <Receipt size={24} />
              </div>
              <p className="text-sm text-neutral-500">No hay movimientos recientes</p>
            </div>
          ) : (
            <div className="space-y-1">
              {transactions.slice(0, 8).map((tx) => {
                const isIncoming = ['deposit', 'transfer_in', 'ach_in'].includes(tx.type)
                return (
                  <div
                    key={tx.id}
                    className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-neutral-50"
                  >
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                        isIncoming ? 'bg-accent-50 text-accent-600' : 'bg-neutral-100 text-neutral-500'
                      }`}
                    >
                      {isIncoming ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-neutral-800">
                        {tx.description || getTransactionTypeLabel(tx.type)}
                      </div>
                      <div className="text-xs text-neutral-400">{formatDate(tx.created_at)}</div>
                    </div>
                    <div className={`text-sm font-semibold ${getTransactionTypeColor(tx.type)}`}>
                      {getTransactionSign(tx.type)}{formatCOP(tx.amount)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
