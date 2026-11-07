import { supabase } from './supabase'
import { generateIdempotencyKey } from './format'

export interface Account {
  id: string
  user_id: string
  account_number: string
  type: 'savings' | 'checking' | 'wallet'
  balance: number
  daily_withdrawal_total: number
  daily_withdrawal_reset_date: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Transaction {
  id: string
  account_id: string
  user_id: string
  type: string
  amount: number
  balance_after: number | null
  status: string
  idempotency_key: string | null
  description: string | null
  reference: string | null
  related_account_id: string | null
  created_at: string
}

export interface Profile {
  id: string
  full_name: string
  phone: string | null
  category: 'standard' | 'vip'
  status: 'active' | 'locked'
  locked_until: string | null
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: string
  user_id: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  amount: number | null
  ip_address: string | null
  details: Record<string, unknown> | null
  created_at: string
}

export interface ServiceItem {
  id: string
  name: string
  category: string
  icon: string
  min_amount: number
  max_amount: number
  is_active: boolean
}

export interface ACHTransfer {
  id: string
  transaction_id: string
  user_id: string
  source_account_id: string
  target_bank_code: string
  target_bank_name: string
  target_account_number: string
  target_account_type: string
  target_owner_name: string
  amount: number
  commission: number
  status: 'pending' | 'processed' | 'failed'
  scheduled_for: string
  processed_at: string | null
  created_at: string
}

// =====================
// Profile operations
// =====================

export async function fetchProfile(): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', (await supabase.auth.getUser()).data.user?.id)
    .maybeSingle()
  if (error) throw error
  return data as Profile | null
}

export async function updateProfilePhone(phone: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ phone })
    .eq('id', (await supabase.auth.getUser()).data.user?.id)
  if (error) throw error
}

// =====================
// Account operations
// =====================

export async function fetchAccounts(): Promise<Account[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data || []) as Account[]
}

export async function createAccount(type: 'savings' | 'checking' | 'wallet'): Promise<string> {
  const { data, error } = await supabase.rpc('create_account', { p_type: type })
  if (error) throw error
  return data as string
}

// =====================
// Transaction operations
// =====================

export async function fetchTransactions(accountId?: string, limit = 50): Promise<Transaction[]> {
  let query = supabase
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (accountId) {
    query = query.eq('account_id', accountId)
  }
  const { data, error } = await query
  if (error) throw error
  return (data || []) as Transaction[]
}

export async function withdraw(
  accountId: string,
  amountCents: number,
  description?: string,
): Promise<{ status: string; transaction_id: string; new_balance: number }> {
  const { data, error } = await supabase.rpc('perform_withdrawal', {
    p_account_id: accountId,
    p_amount: amountCents,
    p_idempotency_key: generateIdempotencyKey(),
    p_description: description || 'Retiro de cajero',
    p_ip_address: null,
  })
  if (error) throw error
  return data as { status: string; transaction_id: string; new_balance: number }
}

export async function transfer(
  sourceId: string,
  targetId: string,
  amountCents: number,
  description?: string,
): Promise<{ status: string; transaction_id: string; new_balance: number }> {
  const { data, error } = await supabase.rpc('perform_transfer', {
    p_source_id: sourceId,
    p_target_id: targetId,
    p_amount: amountCents,
    p_idempotency_key: generateIdempotencyKey(),
    p_description: description || 'Transferencia',
    p_ip_address: null,
  })
  if (error) throw error
  return data as { status: string; transaction_id: string; new_balance: number }
}

export async function achTransfer(
  sourceId: string,
  targetBankCode: string,
  targetBankName: string,
  targetAccountNumber: string,
  targetOwnerName: string,
  amountCents: number,
): Promise<{ status: string; transaction_id: string; new_balance: number; commission: number }> {
  const { data, error } = await supabase.rpc('perform_ach_transfer', {
    p_source_id: sourceId,
    p_target_bank_code: targetBankCode,
    p_target_bank_name: targetBankName,
    p_target_account_number: targetAccountNumber,
    p_target_owner_name: targetOwnerName,
    p_amount: amountCents,
    p_idempotency_key: generateIdempotencyKey(),
    p_ip_address: null,
  })
  if (error) throw error
  return data as { status: string; transaction_id: string; new_balance: number; commission: number }
}

export async function payService(
  accountId: string,
  serviceId: string,
  reference: string,
  amountCents: number,
): Promise<{ status: string; transaction_id: string; new_balance: number }> {
  const { data, error } = await supabase.rpc('pay_service', {
    p_account_id: accountId,
    p_service_id: serviceId,
    p_reference: reference,
    p_amount: amountCents,
    p_idempotency_key: generateIdempotencyKey(),
    p_ip_address: null,
  })
  if (error) throw error
  return data as { status: string; transaction_id: string; new_balance: number }
}

export async function recharge(
  accountId: string,
  phoneNumber: string,
  amountCents: number,
): Promise<{ status: string; transaction_id: string; new_balance: number }> {
  const { data, error } = await supabase.rpc('perform_recharge', {
    p_account_id: accountId,
    p_phone_number: phoneNumber,
    p_amount: amountCents,
    p_idempotency_key: generateIdempotencyKey(),
    p_ip_address: null,
  })
  if (error) throw error
  return data as { status: string; transaction_id: string; new_balance: number }
}

export async function searchAccountByNumber(accountNumber: string): Promise<{
  found: boolean
  account_id?: string
  account_number?: string
  type?: string
  owner_name?: string
}> {
  const { data, error } = await supabase.rpc('search_account_by_number', {
    p_account_number: accountNumber,
  })
  if (error) throw error
  return data as { found: boolean; account_id?: string; account_number?: string; type?: string; owner_name?: string }
}

// =====================
// Service catalog
// =====================

export async function fetchServices(): Promise<ServiceItem[]> {
  const { data, error } = await supabase
    .from('service_catalog')
    .select('*')
    .order('category', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw error
  return (data || []) as ServiceItem[]
}

// =====================
// ACH transfers
// =====================

export async function fetchACHTransfers(): Promise<ACHTransfer[]> {
  const { data, error } = await supabase
    .from('ach_transfers')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as ACHTransfer[]
}

// =====================
// Audit logs
// =====================

export async function fetchAuditLogs(limit = 100): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data || []) as AuditLog[]
}

// =====================
// Batch processing
// =====================

export async function processACHBatch(): Promise<{ processed: number; failed: number }> {
  const { data, error } = await supabase.rpc('process_ach_batch')
  if (error) throw error
  return data as { processed: number; failed: number }
}

export async function calculateSavingsInterest(): Promise<{ accounts_processed: number }> {
  const { data, error } = await supabase.rpc('calculate_savings_interest')
  if (error) throw error
  return data as { accounts_processed: number }
}

// =====================
// Auth helpers
// =====================

export async function recordLoginAttempt(email: string, success: boolean): Promise<void> {
  await supabase.rpc('record_login_attempt', {
    p_email: email,
    p_success: success,
    p_ip_address: null,
  })
}
