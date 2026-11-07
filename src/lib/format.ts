/** Format a value in centavos to COP currency string */
export function formatCOP(cents: number): string {
  const pesos = cents / 100
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(pesos)
}

/** Format a value in centavos to a plain number string (no currency symbol) */
export function formatNumber(cents: number): string {
  const pesos = cents / 100
  return new Intl.NumberFormat('es-CO').format(pesos)
}

/** Parse a user-entered COP amount string into centavos */
export function parseCOPToCents(input: string): number {
  const cleaned = input.replace(/[^0-9]/g, '')
  if (!cleaned) return 0
  return parseInt(cleaned, 10) * 100
}

/** Format a timestamp for display */
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

/** Format a date as short date only */
export function formatDateShort(date: string | Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}

/** Generate a unique idempotency key */
export function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

/** Mask an account number showing only last 4 digits */
export function maskAccountNumber(number: string): string {
  if (number.length <= 4) return number
  return `****${number.slice(-4)}`
}

/** Get the transaction type label in Spanish */
export function getTransactionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    deposit: 'Depósito',
    withdrawal: 'Retiro',
    transfer_in: 'Transferencia recibida',
    transfer_out: 'Transferencia enviada',
    ach_out: 'ACH enviada',
    ach_in: 'ACH recibida',
    payment: 'Pago de servicio',
    recharge: 'Recarga móvil',
    commission: 'Comisión',
  }
  return labels[type] || type
}

/** Get the transaction type color classes */
export function getTransactionTypeColor(type: string): string {
  const colors: Record<string, string> = {
    deposit: 'text-accent-600',
    withdrawal: 'text-danger-600',
    transfer_in: 'text-accent-600',
    transfer_out: 'text-warning-600',
    ach_out: 'text-warning-600',
    ach_in: 'text-accent-600',
    payment: 'text-primary-600',
    recharge: 'text-primary-600',
    commission: 'text-danger-500',
  }
  return colors[type] || 'text-neutral-600'
}

/** Get the sign prefix for a transaction type */
export function getTransactionSign(type: string): string {
  const positive = ['deposit', 'transfer_in', 'ach_in']
  return positive.includes(type) ? '+' : '-'
}

/** Get account type label */
export function getAccountTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    savings: 'Cuenta de Ahorros',
    checking: 'Cuenta Corriente',
    wallet: 'Billetera Digital',
  }
  return labels[type] || type
}

/** Get account type icon name */
export function getAccountTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    savings: 'PiggyBank',
    checking: 'Landmark',
    wallet: 'Wallet',
  }
  return icons[type] || 'CreditCard'
}
