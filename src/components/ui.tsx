import { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

export function LoadingSpinner({ size = 24, className = '' }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={`animate-spin ${className}`} />
}

export function FullPageLoader({ message = 'Cargando...' }: { message?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-50">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-800 text-white shadow-lg">
          <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" stroke="currentColor" strokeWidth="2">
            <path d="M3 10h18M5 10v8a2 2 0 002 2h10a2 2 0 002-2v-8M7 6h10a2 2 0 012 2v2H5V8a2 2 0 012-2z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="text-xl font-bold tracking-tight text-primary-800">NEXUS BANK</span>
      </div>
      <div className="flex items-center gap-2 text-neutral-500">
        <LoadingSpinner size={20} />
        <span className="text-sm">{message}</span>
      </div>
    </div>
  )
}

export function Toast({
  type,
  message,
  onClose,
}: {
  type: 'success' | 'error' | 'info'
  message: string
  onClose: () => void
}) {
  const colors = {
    success: 'bg-accent-50 border-accent-200 text-accent-800',
    error: 'bg-danger-50 border-danger-200 text-danger-800',
    info: 'bg-primary-50 border-primary-200 text-primary-800',
  }
  const icons = {
    success: 'M5 13l4 4L19 7',
    error: 'M6 18L18 6M6 6l12 12',
    info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  }
  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in">
      <div className={`flex items-center gap-3 rounded-xl border px-5 py-4 shadow-lg ${colors[type]}`}>
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 flex-shrink-0" stroke="currentColor" strokeWidth="2">
          <path d={icons[type]} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-sm font-medium">{message}</span>
        <button onClick={onClose} className="ml-2 opacity-60 transition-opacity hover:opacity-100">
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2">
            <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  if (!open) return null
  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-neutral-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${sizes[size]} animate-slide-up rounded-2xl bg-white shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
          <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <div className="max-h-[calc(100vh-200px)] overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  danger = false,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm">
      <p className="text-sm text-neutral-600">{message}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button className="btn-secondary" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

export function EmptyState({
  icon,
  title,
  message,
}: {
  icon: ReactNode
  title: string
  message: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
        {icon}
      </div>
      <h4 className="mb-1 text-base font-semibold text-neutral-700">{title}</h4>
      <p className="max-w-sm text-sm text-neutral-500">{message}</p>
    </div>
  )
}

export function Badge({
  children,
  color = 'neutral',
}: {
  children: ReactNode
  color?: 'neutral' | 'success' | 'warning' | 'danger' | 'primary'
}) {
  const colors = {
    neutral: 'bg-neutral-100 text-neutral-600',
    success: 'bg-accent-100 text-accent-700',
    warning: 'bg-warning-100 text-warning-700',
    danger: 'bg-danger-100 text-danger-700',
    primary: 'bg-primary-100 text-primary-700',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  )
}
