/*
# NEXUS BANK — Financial Operations Functions (SECURITY DEFINER)

1. New Functions
- `create_account(type)` — Creates a new bank account with a unique account number for the calling user
- `perform_deposit(account_id, amount, idempotency_key, description)` — Deposits funds into an account
- `perform_withdrawal(account_id, amount, idempotency_key, description, ip_address)` — Withdraws funds with daily limit ($2M COP) and concurrency protection (SELECT FOR UPDATE)
- `perform_transfer(source_id, target_id, amount, idempotency_key, description, ip_address)` — Internal transfer between own or other accounts with row-level locking
- `perform_ach_transfer(source_id, target_bank_code, target_bank_name, target_account_number, target_owner_name, amount, idempotency_key, ip_address)` — ACH interbank transfer with 1% commission (min $4,000 COP), VIP exempt
- `pay_service(account_id, service_id, reference, amount, idempotency_key, ip_address)` — Pay a utility/service bill
- `perform_recharge(account_id, phone_number, amount, idempotency_key, ip_address)` — Mobile phone recharge
- `process_ach_batch()` — Batch process pending ACH transfers (scheduled at 11 PM)
- `calculate_savings_interest()` — Calculate interest on savings accounts (batch)
- `record_login_attempt(email, success, ip_address)` — Records login attempts and handles account lockout logic

2. Security
- All functions are SECURITY DEFINER to operate across user boundaries safely
- EXECUTE revoked from PUBLIC and anon, granted only to authenticated
- Row-level locking via SELECT FOR UPDATE prevents concurrent modifications
- Idempotency keys checked before processing to prevent duplicate operations

3. Important Notes
- All amounts stored as bigint (COP cents: $1 = 100 units) to avoid floating point
- Balance check happens inside the locked transaction row
- Daily withdrawal limit enforced with automatic daily reset
- ACH transfers are created as 'pending' and processed in batch
- Commission calculated as CEIL(amount * 0.01) with minimum 4000, VIP exempt
*/

-- ============================================
-- HELPER: Format COP amounts (stored in cents)
-- ============================================
-- All monetary values are stored in centavos (1 COP = 100 centavos)
-- This avoids floating point issues with money

-- ============================================
-- CREATE ACCOUNT FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION create_account(p_type text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_account_number text;
  v_account_id uuid;
  v_existing_count int;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_type NOT IN ('savings', 'checking', 'wallet') THEN
    RAISE EXCEPTION 'Invalid account type. Must be: savings, checking, or wallet';
  END IF;

  -- Limit to 5 accounts per user
  SELECT COUNT(*) INTO v_existing_count FROM accounts WHERE user_id = v_user_id;
  IF v_existing_count >= 5 THEN
    RAISE EXCEPTION 'Maximum of 5 accounts per user reached';
  END IF;

  -- Generate unique 12-digit account number
  v_account_number := lpad(floor(random() * 1000000000000)::text, 12, '0');
  LOOP
    EXIT WHEN NOT EXISTS (SELECT 1 FROM accounts WHERE account_number = v_account_number);
    v_account_number := lpad(floor(random() * 1000000000000)::text, 12, '0');
  END LOOP;

  INSERT INTO accounts (user_id, account_number, type, balance)
  VALUES (v_user_id, v_account_number, p_type, 0)
  RETURNING id INTO v_account_id;

  -- Initial deposit bonus for savings accounts (100,000 COP = 10,000,000 centavos)
  IF p_type = 'savings' THEN
    UPDATE accounts SET balance = 10000000 WHERE id = v_account_id;
    INSERT INTO transactions (account_id, user_id, type, amount, balance_after, description, reference)
    VALUES (v_account_id, v_user_id, 'deposit', 10000000, 10000000, 'Bono de bienvenida - Cuenta de ahorros', 'WELCOME_BONUS');
  END IF;

  -- For checking accounts, initial deposit of 500,000 COP
  IF p_type = 'checking' THEN
    UPDATE accounts SET balance = 50000000 WHERE id = v_account_id;
    INSERT INTO transactions (account_id, user_id, type, amount, balance_after, description, reference)
    VALUES (v_account_id, v_user_id, 'deposit', 50000000, 50000000, 'Deposito inicial - Cuenta corriente', 'INITIAL_DEPOSIT');
  END IF;

  -- For wallets, initial 50,000 COP
  IF p_type = 'wallet' THEN
    UPDATE accounts SET balance = 5000000 WHERE id = v_account_id;
    INSERT INTO transactions (account_id, user_id, type, amount, balance_after, description, reference)
    VALUES (v_account_id, v_user_id, 'deposit', 5000000, 50000000, 'Saldo inicial - Billetera digital', 'INITIAL_WALLET');
  END IF;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (v_user_id, 'ACCOUNT_CREATED', 'account', v_account_id, jsonb_build_object('type', p_type, 'account_number', v_account_number));

  RETURN v_account_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION create_account(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_account(text) TO authenticated;

-- ============================================
-- PERFORM DEPOSIT FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION perform_deposit(
  p_account_id uuid,
  p_amount bigint,
  p_idempotency_key text DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_account accounts%ROWTYPE;
  v_existing uuid;
  v_tx_id uuid;
  v_balance_after bigint;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing FROM transactions
    WHERE idempotency_key = p_idempotency_key AND account_id = p_account_id AND type = 'deposit';
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('status', 'duplicate', 'message', 'Deposit already processed', 'transaction_id', v_existing);
    END IF;
  END IF;

  -- Lock the account row for update
  SELECT * INTO v_account FROM accounts WHERE id = p_account_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found or not owned by user';
  END IF;

  IF v_account.is_active = false THEN
    RAISE EXCEPTION 'Account is not active';
  END IF;

  v_balance_after := v_account.balance + p_amount;

  UPDATE accounts SET balance = v_balance_after WHERE id = p_account_id;

  INSERT INTO transactions (account_id, user_id, type, amount, balance_after, idempotency_key, description, reference)
  VALUES (p_account_id, v_user_id, 'deposit', p_amount, v_balance_after, p_idempotency_key, COALESCE(p_description, 'Deposit'), 'DEP' || lpad(floor(random()*1000000)::text, 6, '0'))
  RETURNING id INTO v_tx_id;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, amount, details)
  VALUES (v_user_id, 'DEPOSIT', 'account', p_account_id, p_amount, jsonb_build_object('transaction_id', v_tx_id, 'description', p_description));

  RETURN jsonb_build_object('status', 'success', 'transaction_id', v_tx_id, 'new_balance', v_balance_after);
END;
$$;

REVOKE EXECUTE ON FUNCTION perform_deposit(uuid, bigint, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION perform_deposit(uuid, bigint, text, text) TO authenticated;

-- ============================================
-- PERFORM WITHDRAWAL FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION perform_withdrawal(
  p_account_id uuid,
  p_amount bigint,
  p_idempotency_key text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_ip_address text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_account accounts%ROWTYPE;
  v_profile profiles%ROWTYPE;
  v_existing uuid;
  v_tx_id uuid;
  v_balance_after bigint;
  v_daily_total bigint;
  v_daily_limit bigint := 200000000; -- $2,000,000 COP in centavos
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing FROM transactions
    WHERE idempotency_key = p_idempotency_key AND account_id = p_account_id AND type = 'withdrawal';
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('status', 'duplicate', 'message', 'Withdrawal already processed', 'transaction_id', v_existing);
    END IF;
  END IF;

  -- Lock the account row
  SELECT * INTO v_account FROM accounts WHERE id = p_account_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found or not owned by user';
  END IF;

  IF v_account.is_active = false THEN
    RAISE EXCEPTION 'Account is not active';
  END IF;

  -- Check profile status (locked accounts)
  SELECT * INTO v_profile FROM profiles WHERE id = v_user_id;
  IF v_profile.status = 'locked' AND (v_profile.locked_until IS NULL OR v_profile.locked_until > now()) THEN
    RAISE EXCEPTION 'User account is locked. Please try again later.';
  END IF;

  -- Check daily withdrawal limit (reset if new day)
  IF v_account.daily_withdrawal_reset_date < CURRENT_DATE THEN
    v_daily_total := 0;
    UPDATE accounts SET daily_withdrawal_total = 0, daily_withdrawal_reset_date = CURRENT_DATE WHERE id = p_account_id;
    v_account.daily_withdrawal_total := 0;
  ELSE
    v_daily_total := v_account.daily_withdrawal_total;
  END IF;

  IF v_daily_total + p_amount > v_daily_limit THEN
    RAISE EXCEPTION 'Daily withdrawal limit of $2,000,000 COP exceeded. Withdrawn today: $% COP', (v_daily_total / 100);
  END IF;

  -- Check sufficient balance
  IF v_account.balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance. Available: $% COP', (v_account.balance / 100);
  END IF;

  v_balance_after := v_account.balance - p_amount;

  UPDATE accounts SET balance = v_balance_after, daily_withdrawal_total = v_daily_total + p_amount WHERE id = p_account_id;

  INSERT INTO transactions (account_id, user_id, type, amount, balance_after, idempotency_key, description, reference)
  VALUES (p_account_id, v_user_id, 'withdrawal', p_amount, v_balance_after, p_idempotency_key, COALESCE(p_description, 'Retiro de cajero'), 'WDR' || lpad(floor(random()*1000000)::text, 6, '0'))
  RETURNING id INTO v_tx_id;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, amount, ip_address, details)
  VALUES (v_user_id, 'WITHDRAWAL', 'account', p_account_id, p_amount, p_ip_address, jsonb_build_object('transaction_id', v_tx_id, 'description', p_description));

  RETURN jsonb_build_object('status', 'success', 'transaction_id', v_tx_id, 'new_balance', v_balance_after);
END;
$$;

REVOKE EXECUTE ON FUNCTION perform_withdrawal(uuid, bigint, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION perform_withdrawal(uuid, bigint, text, text, text) TO authenticated;

-- ============================================
-- PERFORM TRANSFER FUNCTION (Internal)
-- ============================================
CREATE OR REPLACE FUNCTION perform_transfer(
  p_source_id uuid,
  p_target_id uuid,
  p_amount bigint,
  p_idempotency_key text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_ip_address text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_source accounts%ROWTYPE;
  v_target accounts%ROWTYPE;
  v_profile profiles%ROWTYPE;
  v_existing uuid;
  v_tx_out_id uuid;
  v_tx_in_id uuid;
  v_source_balance bigint;
  v_target_balance bigint;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  IF p_source_id = p_target_id THEN
    RAISE EXCEPTION 'Cannot transfer to the same account';
  END IF;

  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing FROM transactions
    WHERE idempotency_key = p_idempotency_key AND account_id = p_source_id AND type = 'transfer_out';
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('status', 'duplicate', 'message', 'Transfer already processed', 'transaction_id', v_existing);
    END IF;
  END IF;

  -- Lock both account rows (source first to avoid deadlocks)
  SELECT * INTO v_source FROM accounts WHERE id = p_source_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source account not found or not owned by user';
  END IF;

  SELECT * INTO v_target FROM accounts WHERE id = p_target_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target account not found';
  END IF;

  IF v_source.is_active = false THEN
    RAISE EXCEPTION 'Source account is not active';
  END IF;

  IF v_target.is_active = false THEN
    RAISE EXCEPTION 'Target account is not active';
  END IF;

  -- Check profile status
  SELECT * INTO v_profile FROM profiles WHERE id = v_user_id;
  IF v_profile.status = 'locked' AND (v_profile.locked_until IS NULL OR v_profile.locked_until > now()) THEN
    RAISE EXCEPTION 'User account is locked';
  END IF;

  -- Check sufficient balance
  IF v_source.balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance. Available: $% COP', (v_source.balance / 100);
  END IF;

  v_source_balance := v_source.balance - p_amount;
  v_target_balance := v_target.balance + p_amount;

  UPDATE accounts SET balance = v_source_balance WHERE id = p_source_id;
  UPDATE accounts SET balance = v_target_balance WHERE id = p_target_id;

  INSERT INTO transactions (account_id, user_id, type, amount, balance_after, idempotency_key, description, reference, related_account_id)
  VALUES (p_source_id, v_user_id, 'transfer_out', p_amount, v_source_balance, p_idempotency_key, COALESCE(p_description, 'Transferencia enviada'), 'TRF' || lpad(floor(random()*1000000)::text, 6, '0'), p_target_id)
  RETURNING id INTO v_tx_out_id;

  INSERT INTO transactions (account_id, user_id, type, amount, balance_after, idempotency_key, description, reference, related_account_id)
  VALUES (p_target_id, v_target.user_id, 'transfer_in', p_amount, v_target_balance, p_idempotency_key, COALESCE(p_description, 'Transferencia recibida'), 'TRF' || lpad(floor(random()*1000000)::text, 6, '0'), p_source_id)
  RETURNING id INTO v_tx_in_id;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, amount, ip_address, details)
  VALUES (v_user_id, 'TRANSFER', 'account', p_source_id, p_amount, p_ip_address,
    jsonb_build_object('source_account', p_source_id, 'target_account', p_target_id, 'transaction_id', v_tx_out_id));

  RETURN jsonb_build_object('status', 'success', 'transaction_id', v_tx_out_id, 'new_balance', v_source_balance);
END;
$$;

REVOKE EXECUTE ON FUNCTION perform_transfer(uuid, uuid, bigint, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION perform_transfer(uuid, uuid, bigint, text, text, text) TO authenticated;

-- ============================================
-- PERFORM ACH TRANSFER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION perform_ach_transfer(
  p_source_id uuid,
  p_target_bank_code text,
  p_target_bank_name text,
  p_target_account_number text,
  p_target_owner_name text,
  p_amount bigint,
  p_idempotency_key text DEFAULT NULL,
  p_ip_address text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_source accounts%ROWTYPE;
  v_profile profiles%ROWTYPE;
  v_existing uuid;
  v_tx_id uuid;
  v_balance_after bigint;
  v_commission bigint;
  v_total_deduct bigint;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing FROM transactions
    WHERE idempotency_key = p_idempotency_key AND account_id = p_source_id AND type = 'ach_out';
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('status', 'duplicate', 'message', 'ACH transfer already processed', 'transaction_id', v_existing);
    END IF;
  END IF;

  -- Lock source account
  SELECT * INTO v_source FROM accounts WHERE id = p_source_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source account not found or not owned by user';
  END IF;

  -- Check profile status and calculate commission
  SELECT * INTO v_profile FROM profiles WHERE id = v_user_id;
  IF v_profile.status = 'locked' AND (v_profile.locked_until IS NULL OR v_profile.locked_until > now()) THEN
    RAISE EXCEPTION 'User account is locked';
  END IF;

  -- Commission: 1% (min 4000 COP = 400000 centavos), VIP exempt
  IF v_profile.category = 'vip' THEN
    v_commission := 0;
  ELSE
    v_commission := GREATEST(CEIL(p_amount * 0.01), 400000);
  END IF;

  v_total_deduct := p_amount + v_commission;

  IF v_source.balance < v_total_deduct THEN
    RAISE EXCEPTION 'Insufficient balance (including commission of $% COP). Available: $% COP', (v_commission / 100), (v_source.balance / 100);
  END IF;

  v_balance_after := v_source.balance - v_total_deduct;

  UPDATE accounts SET balance = v_balance_after WHERE id = p_source_id;

  -- Create debit transaction
  INSERT INTO transactions (account_id, user_id, type, amount, balance_after, idempotency_key, description, reference)
  VALUES (p_source_id, v_user_id, 'ach_out', p_amount, v_balance_after, p_idempotency_key,
    'ACH a ' || p_target_bank_name, 'ACH' || lpad(floor(random()*1000000)::text, 6, '0'))
  RETURNING id INTO v_tx_id;

  -- If commission applies, create commission transaction
  IF v_commission > 0 THEN
    INSERT INTO transactions (account_id, user_id, type, amount, description, reference)
    VALUES (p_source_id, v_user_id, 'commission', v_commission, 'Comision ACH 1%', 'COM' || lpad(floor(random()*1000000)::text, 6, '0'));
  END IF;

  -- Create pending ACH record
  INSERT INTO ach_transfers (transaction_id, user_id, source_account_id, target_bank_code, target_bank_name, target_account_number, target_owner_name, amount, commission, status, scheduled_for)
  VALUES (v_tx_id, v_user_id, p_source_id, p_target_bank_code, p_target_bank_name, p_target_account_number, p_target_owner_name, p_amount, v_commission, 'pending', now());

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, amount, ip_address, details)
  VALUES (v_user_id, 'ACH_TRANSFER', 'account', p_source_id, p_amount, p_ip_address,
    jsonb_build_object('target_bank', p_target_bank_name, 'target_account', p_target_account_number, 'commission', v_commission, 'transaction_id', v_tx_id));

  RETURN jsonb_build_object('status', 'success', 'transaction_id', v_tx_id, 'new_balance', v_balance_after, 'commission', v_commission);
END;
$$;

REVOKE EXECUTE ON FUNCTION perform_ach_transfer(uuid, text, text, text, text, bigint, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION perform_ach_transfer(uuid, text, text, text, text, bigint, text, text) TO authenticated;

-- ============================================
-- PAY SERVICE FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION pay_service(
  p_account_id uuid,
  p_service_id uuid,
  p_reference text,
  p_amount bigint,
  p_idempotency_key text DEFAULT NULL,
  p_ip_address text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_account accounts%ROWTYPE;
  v_profile profiles%ROWTYPE;
  v_service service_catalog%ROWTYPE;
  v_existing uuid;
  v_tx_id uuid;
  v_balance_after bigint;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing FROM transactions
    WHERE idempotency_key = p_idempotency_key AND account_id = p_account_id AND type = 'payment';
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('status', 'duplicate', 'message', 'Payment already processed', 'transaction_id', v_existing);
    END IF;
  END IF;

  -- Validate service
  SELECT * INTO v_service FROM service_catalog WHERE id = p_service_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service not found or inactive';
  END IF;

  IF p_amount < v_service.min_amount THEN
    RAISE EXCEPTION 'Amount below minimum ($% COP)', (v_service.min_amount / 100);
  END IF;

  IF p_amount > v_service.max_amount THEN
    RAISE EXCEPTION 'Amount above maximum ($% COP)', (v_service.max_amount / 100);
  END IF;

  -- Lock account
  SELECT * INTO v_account FROM accounts WHERE id = p_account_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found or not owned by user';
  END IF;

  -- Check profile
  SELECT * INTO v_profile FROM profiles WHERE id = v_user_id;
  IF v_profile.status = 'locked' AND (v_profile.locked_until IS NULL OR v_profile.locked_until > now()) THEN
    RAISE EXCEPTION 'User account is locked';
  END IF;

  IF v_account.balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance. Available: $% COP', (v_account.balance / 100);
  END IF;

  v_balance_after := v_account.balance - p_amount;
  UPDATE accounts SET balance = v_balance_after WHERE id = p_account_id;

  INSERT INTO transactions (account_id, user_id, type, amount, balance_after, idempotency_key, description, reference)
  VALUES (p_account_id, v_user_id, 'payment', p_amount, v_balance_after, p_idempotency_key,
    'Pago: ' || v_service.name || ' Ref: ' || p_reference, 'PAY' || lpad(floor(random()*1000000)::text, 6, '0'))
  RETURNING id INTO v_tx_id;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, amount, ip_address, details)
  VALUES (v_user_id, 'SERVICE_PAYMENT', 'account', p_account_id, p_amount, p_ip_address,
    jsonb_build_object('service', v_service.name, 'reference', p_reference, 'transaction_id', v_tx_id));

  RETURN jsonb_build_object('status', 'success', 'transaction_id', v_tx_id, 'new_balance', v_balance_after);
END;
$$;

REVOKE EXECUTE ON FUNCTION pay_service(uuid, uuid, text, bigint, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION pay_service(uuid, uuid, text, bigint, text, text) TO authenticated;

-- ============================================
-- PERFORM RECHARGE FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION perform_recharge(
  p_account_id uuid,
  p_phone_number text,
  p_amount bigint,
  p_idempotency_key text DEFAULT NULL,
  p_ip_address text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_account accounts%ROWTYPE;
  v_profile profiles%ROWTYPE;
  v_existing uuid;
  v_tx_id uuid;
  v_balance_after bigint;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  IF p_phone_number !~ '^[0-9]{10}$' THEN
    RAISE EXCEPTION 'Invalid phone number (must be 10 digits)';
  END IF;

  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing FROM transactions
    WHERE idempotency_key = p_idempotency_key AND account_id = p_account_id AND type = 'recharge';
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('status', 'duplicate', 'message', 'Recharge already processed', 'transaction_id', v_existing);
    END IF;
  END IF;

  -- Lock account
  SELECT * INTO v_account FROM accounts WHERE id = p_account_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found or not owned by user';
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = v_user_id;
  IF v_profile.status = 'locked' AND (v_profile.locked_until IS NULL OR v_profile.locked_until > now()) THEN
    RAISE EXCEPTION 'User account is locked';
  END IF;

  IF v_account.balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance. Available: $% COP', (v_account.balance / 100);
  END IF;

  v_balance_after := v_account.balance - p_amount;
  UPDATE accounts SET balance = v_balance_after WHERE id = p_account_id;

  INSERT INTO transactions (account_id, user_id, type, amount, balance_after, idempotency_key, description, reference)
  VALUES (p_account_id, v_user_id, 'recharge', p_amount, v_balance_after, p_idempotency_key,
    'Recarga a ' || p_phone_number, 'REC' || lpad(floor(random()*1000000)::text, 6, '0'))
  RETURNING id INTO v_tx_id;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, amount, ip_address, details)
  VALUES (v_user_id, 'RECHARGE', 'account', p_account_id, p_amount, p_ip_address,
    jsonb_build_object('phone', p_phone_number, 'transaction_id', v_tx_id));

  RETURN jsonb_build_object('status', 'success', 'transaction_id', v_tx_id, 'new_balance', v_balance_after);
END;
$$;

REVOKE EXECUTE ON FUNCTION perform_recharge(uuid, text, bigint, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION perform_recharge(uuid, text, bigint, text, text) TO authenticated;

-- ============================================
-- RECORD LOGIN ATTEMPT FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION record_login_attempt(
  p_email text,
  p_success boolean,
  p_ip_address text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_failed_count int;
  v_profile profiles%ROWTYPE;
  v_user_id uuid;
BEGIN
  INSERT INTO login_attempts (email, success, ip_address)
  VALUES (p_email, p_success, p_ip_address);

  IF NOT p_success THEN
    -- Count failed attempts in last 24 hours
    SELECT COUNT(*) INTO v_failed_count
    FROM login_attempts
    WHERE email = p_email AND success = false AND created_at > now() - interval '24 hours';

    IF v_failed_count >= 3 THEN
      -- Find user by email and lock profile
      SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
      IF v_user_id IS NOT NULL THEN
        UPDATE profiles
        SET status = 'locked', locked_until = now() + interval '24 hours'
        WHERE id = v_user_id;
        RETURN jsonb_build_object('status', 'locked', 'message', 'Account locked for 24 hours due to 3 failed attempts', 'failed_count', v_failed_count);
      END IF;
      RETURN jsonb_build_object('status', 'locked', 'message', 'Account locked for 24 hours', 'failed_count', v_failed_count);
    END IF;

    RETURN jsonb_build_object('status', 'failed', 'failed_count', v_failed_count);
  ELSE
    -- On success, unlock if previously locked
    SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
    IF v_user_id IS NOT NULL THEN
      SELECT * INTO v_profile FROM profiles WHERE id = v_user_id;
      IF v_profile.status = 'locked' AND v_profile.locked_until IS NOT NULL AND v_profile.locked_until <= now() THEN
        UPDATE profiles SET status = 'active', locked_until = NULL WHERE id = v_user_id;
      END IF;
    END IF;
    RETURN jsonb_build_object('status', 'success');
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION record_login_attempt(text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION record_login_attempt(text, boolean, text) TO authenticated;

-- ============================================
-- PROCESS ACH BATCH FUNCTION (Scheduled 11 PM)
-- ============================================
CREATE OR REPLACE FUNCTION process_ach_batch()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_processed int := 0;
  v_failed int := 0;
  v_ach RECORD;
BEGIN
  FOR v_ach IN SELECT * FROM ach_transfers WHERE status = 'pending' ORDER BY created_at FOR UPDATE SKIP LOCKED LOOP
    BEGIN
      -- Simulate processing (90% success rate for demo)
      IF random() > 0.1 THEN
        UPDATE ach_transfers SET status = 'processed', processed_at = now() WHERE id = v_ach.id;
        v_processed := v_processed + 1;

        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, amount, details)
        VALUES (v_ach.user_id, 'ACH_PROCESSED', 'ach_transfer', v_ach.id, v_ach.amount,
          jsonb_build_object('target_bank', v_ach.target_bank_name, 'target_account', v_ach.target_account_number));
      ELSE
        UPDATE ach_transfers SET status = 'failed', processed_at = now() WHERE id = v_ach.id;
        -- Refund the amount (not commission) on failure
        UPDATE accounts SET balance = balance + v_ach.amount WHERE id = v_ach.source_account_id;
        INSERT INTO transactions (account_id, user_id, type, amount, description, reference)
        VALUES (v_ach.source_account_id, v_ach.user_id, 'deposit', v_ach.amount, 'Reembolso ACH fallido', 'REF' || lpad(floor(random()*1000000)::text, 6, '0'));
        v_failed := v_failed + 1;

        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, amount, details)
        VALUES (v_ach.user_id, 'ACH_FAILED', 'ach_transfer', v_ach.id, v_ach.amount,
          jsonb_build_object('reason', 'Processing failed - amount refunded'));
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object('processed', v_processed, 'failed', v_failed);
END;
$$;

REVOKE EXECUTE ON FUNCTION process_ach_batch() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION process_ach_batch() TO authenticated;

-- ============================================
-- CALCULATE SAVINGS INTEREST FUNCTION (Batch)
-- ============================================
CREATE OR REPLACE FUNCTION calculate_savings_interest()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  v_account RECORD;
  v_interest bigint;
BEGIN
  FOR v_account IN SELECT * FROM accounts WHERE type = 'savings' AND is_active = true AND balance > 0 FOR UPDATE LOOP
    -- 0.5% monthly interest rate, applied daily as 0.5/30 = 0.0167%
    v_interest := CEIL(v_account.balance * 0.000167);

    IF v_interest > 0 THEN
      UPDATE accounts SET balance = balance + v_interest WHERE id = v_account.id;
      INSERT INTO transactions (account_id, user_id, type, amount, description, reference)
      VALUES (v_account.id, v_account.user_id, 'deposit', v_interest, 'Interes diario cuenta de ahorros', 'INT' || lpad(floor(random()*1000000)::text, 6, '0'));
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('accounts_processed', v_count);
END;
$$;

REVOKE EXECUTE ON FUNCTION calculate_savings_interest() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION calculate_savings_interest() TO authenticated;

-- ============================================
-- SEARCH ACCOUNT BY NUMBER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION search_account_by_number(p_account_number text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account accounts%ROWTYPE;
  v_profile profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_account FROM accounts WHERE account_number = p_account_number AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT full_name INTO v_profile FROM profiles WHERE id = v_account.user_id;

  RETURN jsonb_build_object(
    'found', true,
    'account_id', v_account.id,
    'account_number', v_account.account_number,
    'type', v_account.type,
    'owner_name', v_profile.full_name
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION search_account_by_number(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION search_account_by_number(text) TO authenticated;
