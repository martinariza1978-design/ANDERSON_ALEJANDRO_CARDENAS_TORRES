# Project memory

## Product intent & audience

- Customer-facing web app with user accounts/sign-in.
- Tech stack: Vite + React.

## Brand personality & voice

- Direct, helpful tone; offers options and asks clarifying questions before implementing.

## Visual design & UX direction

- Login flow exists with email + password fields only.
- No 2FA UI components (code entry, authenticator setup, SMS step) present.

## Decisions, constraints & rationale

- Authentication is email + password only; no two-factor authentication (2FA) currently implemented.
- Underlying auth/sign-in system supports authenticator-app codes, so 2FA could be added without replacing the auth provider.
- No 2FA was added yet — treated as a pending decision, not a constraint.

## Open questions & assumptions

- Whether to implement 2FA at all remains undecided.
- If implemented: should 2FA be required for all users or optional/opt-in?
- Assumption: users are individual customers (not admins or staff) based on current sign-in flow.