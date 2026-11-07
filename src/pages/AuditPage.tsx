import { useEffect, useState, useCallback } from 'react'
import { ScrollText, Download, Play, TrendingUp } from 'lucide-react'
import { AuditLog, Transaction, fetchAuditLogs, fetchTransactions, processACHBatch, calculateSavingsInterest } from '../lib/api'
import { formatCOP, formatDate, getTransactionTypeLabel, getTransactionTypeColor, getTransactionSign } from '../lib/format'
import { LoadingSpinner, Toast, Badge, EmptyState } from '../components/ui'

export function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [tab, setTab] = useState<'audit' | 'transactions'>('audit')

  const loadData = useCallback(async () => {
    try {
      const [lg, txs] = await Promise.all([fetchAuditLogs(100), fetchTransactions(undefined, 100)])
      setLogs(lg)
      setTransactions(txs)
    } catch (err) {
      console.error('Audit load error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleProcessACH = async () => {
    setProcessing(true)
    setToast(null)
    try {
      const result = await processACHBatch()
      setToast({
        type: 'success',
        message: `Lote ACH procesado: ${result.processed} completadas, ${result.failed} fallidas.`,
      })
      await loadData()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al procesar lote'
      setToast({ type: 'error', message: msg })
    } finally {
      setProcessing(false)
    }
  }

  const handleInterest = async () => {
    setProcessing(true)
    setToast(null)
    try {
      const result = await calculateSavingsInterest()
      setToast({
        type: 'success',
        message: `Intereses calculados para ${result.accounts_processed} cuentas de ahorros.`,
      })
      await loadData()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al calcular intereses'
      setToast({ type: 'error', message: msg })
    } finally {
      setProcessing(false)
    }
  }

  const getActionBadge = (action: string) => {
    if (action.includes('DEPOSIT') || action.includes('PROCESSED')) return <Badge color="success">{action}</Badge>
    if (action.includes('WITHDRAWAL') || action.includes('ACH_FAILED') || action.includes('LOCKED')) return <Badge color="danger">{action}</Badge>
    if (action.includes('ACH') || action.includes('TRANSFER')) return <Badge color="warning">{action}</Badge>
    if (action.includes('PAYMENT')) return <Badge color="primary">{action}</Badge>
    return <Badge color="neutral">{action}</Badge>
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
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Auditoría y Registros</h1>
          <p className="text-sm text-neutral-500">Registro inmutable de todas las operaciones</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleProcessACH} disabled={processing} className="btn-secondary">
            {processing ? <LoadingSpinner size={14} /> : <Play size={14} />}
            Procesar ACH
          </button>
          <button onClick={handleInterest} disabled={processing} className="btn-secondary">
            {processing ? <LoadingSpinner size={14} /> : <TrendingUp size={14} />}
            Calcular intereses
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-neutral-100 p-1">
        <button
          onClick={() => setTab('audit')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            tab === 'audit' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Registro de auditoría ({logs.length})
        </button>
        <button
          onClick={() => setTab('transactions')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            tab === 'transactions' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Movimientos ({transactions.length})
        </button>
      </div>

      {tab === 'audit' ? (
        <div className="card overflow-hidden">
          {logs.length === 0 ? (
            <EmptyState
              icon={<ScrollText size={28} />}
              title="Sin registros"
              message="No hay registros de auditoría. Realiza operaciones para verlas aquí."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50 text-left text-xs font-semibold text-neutral-500">
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Acción</th>
                    <th className="px-4 py-3">Monto</th>
                    <th className="px-4 py-3">IP</th>
                    <th className="px-4 py-3">Detalles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {logs.map((log) => (
                    <tr key={log.id} className="transition-colors hover:bg-neutral-50">
                      <td className="px-4 py-3 text-xs text-neutral-500">{formatDate(log.created_at)}</td>
                      <td className="px-4 py-3">{getActionBadge(log.action)}</td>
                      <td className="px-4 py-3 text-xs font-medium text-neutral-700">
                        {log.amount !== null ? formatCOP(log.amount) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-400">{log.ip_address || '—'}</td>
                      <td className="px-4 py-3 text-xs text-neutral-400">
                        {log.details ? JSON.stringify(log.details).substring(0, 80) + '...' : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          {transactions.length === 0 ? (
            <EmptyState
              icon={<ScrollText size={28} />}
              title="Sin movimientos"
              message="No hay transacciones registradas todavía."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50 text-left text-xs font-semibold text-neutral-500">
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Descripción</th>
                    <th className="px-4 py-3">Referencia</th>
                    <th className="px-4 py-3 text-right">Monto</th>
                    <th className="px-4 py-3 text-right">Saldo después</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="transition-colors hover:bg-neutral-50">
                      <td className="px-4 py-3 text-xs text-neutral-500">{formatDate(tx.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${getTransactionTypeColor(tx.type)}`}>
                          {getTransactionTypeLabel(tx.type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-600">
                        {tx.description || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-400">{tx.reference || '—'}</td>
                      <td className={`px-4 py-3 text-right text-xs font-semibold ${getTransactionTypeColor(tx.type)}`}>
                        {getTransactionSign(tx.type)}{formatCOP(tx.amount)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-neutral-500">
                        {tx.balance_after !== null ? formatCOP(tx.balance_after) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Info note */}
      <div className="card flex items-start gap-3 p-4">
        <Download size={18} className="mt-0.5 flex-shrink-0 text-neutral-400" />
        <div className="text-xs text-neutral-500">
          <p className="font-medium text-neutral-600">Procesamiento Batch</p>
          <p className="mt-1">
            El sistema ejecuta procesos programados a las 11:00 PM: procesamiento de transferencias
            ACH pendientes y cálculo de intereses diarios sobre cuentas de ahorros (0.5% mensual).
            Puedes ejecutar estos procesos manualmente con los botones superiores para fines de demostración.
          </p>
        </div>
      </div>
    </div>
  )
}
