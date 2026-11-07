/*
# Lock down direct writes to money, history, and profile role fields

1. Modified Access
- `accounts`, `transactions`, `audit_logs`, `login_attempts`: signed-in users can no longer insert rows directly. All account creation and money movement goes through the secure database functions, which already write the matching transaction and audit records.
- `profiles`: signed-in users can only set their name and phone on sign-up, and can only update their phone afterwards. Customer category (standard/vip) and account status (active/locked) can no longer be changed from the app.
- `perform_deposit`: no longer callable by signed-in users, since no screen uses it and it would let anyone credit their own balance.
- `update_updated_at` trigger function: fixed search path.

2. Security
- Closes direct balance inserts, forged transaction and audit history, self-promotion to VIP (waives ACH commission), and self-unlocking of locked accounts.

3. Important Notes
- Existing policies are unchanged; these are column and table privilege reductions only.
- No data is modified or removed.
*/

REVOKE INSERT ON accounts FROM authenticated;
REVOKE INSERT ON transactions FROM authenticated;
REVOKE INSERT ON audit_logs FROM authenticated;
REVOKE INSERT ON login_attempts FROM authenticated;

REVOKE INSERT, UPDATE ON profiles FROM authenticated;
GRANT INSERT (id, full_name, phone) ON profiles TO authenticated;
GRANT UPDATE (phone) ON profiles TO authenticated;

REVOKE EXECUTE ON FUNCTION perform_deposit(uuid, bigint, text, text) FROM authenticated;

ALTER FUNCTION update_updated_at() SET search_path = public;
