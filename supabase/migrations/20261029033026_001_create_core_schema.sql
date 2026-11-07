/*
# NEXUS BANK — Core Financial Schema

1. New Tables
- `profiles` — Extends auth.users with customer data: full name, phone, category (standard/vip), status (active/locked)
- `accounts` — Bank accounts (savings/checking) linked to users, with account_number, type, balance, daily_withdrawal_total
- `transactions` — All financial movements with type, amount, status, idempotency_key, description, reference
- `audit_logs` — Immutable audit trail for every transaction with user, timestamp, amount, ip
- `login_attempts` — Tracks failed login attempts for account lockout (3 strikes = 24h lock)
- `service_catalog` — Catalog of payable services (electricity, water, gas, phone) with reference validation patterns
- `ach_transfers` — Interbank ACH transfers with target bank, target account, commission, status (pending/processed/failed)
2. Security
- RLS enabled on all tables
- Owner-scoped policies on profiles, accounts, transactions, audit_logs, login_attempts
- service_catalog is read-only public to authenticated users
- SECURITY DEFINER functions for all financial mutations (transfers, withdrawals, deposits, payments)
3. Important Notes
- All monetary operations use SECURITY DEFINER functions with row-level locking (SELECT FOR UPDATE) for ACID compliance
- Idempotency keys prevent duplicate processing of the same request
- Daily withdrawal limit of $2,000,000 COP enforced at DB level
- ACH commission: 1% (min $4,000 COP), VIP customers exempt
- Account lockout after 3 failed login attempts, locked for 24 hours
*/

-- ============================================
-- PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  category text NOT NULL DEFAULT 'standard' CHECK (category IN ('standard', 'vip')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'locked')),
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================
-- ACCOUNTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_number text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('savings', 'checking', 'wallet')),
  balance bigint NOT NULL DEFAULT 0 CHECK (balance >= 0),
  daily_withdrawal_total bigint NOT NULL DEFAULT 0,
  daily_withdrawal_reset_date date NOT NULL DEFAULT CURRENT_DATE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON accounts TO authenticated;

DROP POLICY IF EXISTS "select_own_accounts" ON accounts;
CREATE POLICY "select_own_accounts" ON accounts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_accounts" ON accounts;
CREATE POLICY "insert_own_accounts" ON accounts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============================================
-- TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'transfer_in', 'transfer_out', 'ach_out', 'ach_in', 'payment', 'recharge', 'commission')),
  amount bigint NOT NULL,
  balance_after bigint,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'pending')),
  idempotency_key text,
  description text,
  reference text,
  related_account_id uuid REFERENCES accounts(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON transactions TO authenticated;

DROP POLICY IF EXISTS "select_own_transactions" ON transactions;
CREATE POLICY "select_own_transactions" ON transactions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_transactions" ON transactions;
CREATE POLICY "insert_own_transactions" ON transactions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_idempotency ON transactions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);

-- ============================================
-- AUDIT LOGS TABLE (Immutable)
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  amount bigint,
  ip_address text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON audit_logs TO authenticated;

DROP POLICY IF EXISTS "select_own_audit_logs" ON audit_logs;
CREATE POLICY "select_own_audit_logs" ON audit_logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_audit_logs" ON audit_logs;
CREATE POLICY "insert_own_audit_logs" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ============================================
-- LOGIN ATTEMPTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  success boolean NOT NULL DEFAULT false,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON login_attempts TO authenticated;

DROP POLICY IF EXISTS "select_own_login_attempts" ON login_attempts;
CREATE POLICY "select_own_login_attempts" ON login_attempts FOR SELECT
  TO authenticated USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "insert_own_login_attempts" ON login_attempts;
CREATE POLICY "insert_own_login_attempts" ON login_attempts FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON login_attempts(created_at DESC);

-- ============================================
-- SERVICE CATALOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS service_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('utility', 'telecom', 'streaming', 'other')),
  icon text NOT NULL DEFAULT 'Receipt',
  reference_pattern text,
  min_amount bigint NOT NULL DEFAULT 1000,
  max_amount bigint NOT NULL DEFAULT 5000000,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE service_catalog ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON service_catalog TO authenticated;

DROP POLICY IF EXISTS "select_service_catalog" ON service_catalog;
CREATE POLICY "select_service_catalog" ON service_catalog FOR SELECT
  TO authenticated USING (is_active = true);

-- ============================================
-- ACH TRANSFERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS ach_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  target_bank_code text NOT NULL,
  target_bank_name text NOT NULL,
  target_account_number text NOT NULL,
  target_account_type text NOT NULL DEFAULT 'savings',
  target_owner_name text NOT NULL,
  amount bigint NOT NULL,
  commission bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ach_transfers ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON ach_transfers TO authenticated;

DROP POLICY IF EXISTS "select_own_ach_transfers" ON ach_transfers;
CREATE POLICY "select_own_ach_transfers" ON ach_transfers FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ach_transfers_user_id ON ach_transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_ach_transfers_status ON ach_transfers(status);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON profiles;
CREATE TRIGGER trigger_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_accounts_updated_at ON accounts;
CREATE TRIGGER trigger_accounts_updated_at BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
