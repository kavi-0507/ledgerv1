## Goal

Fix the broken forgot-password flow so clicking the email link takes the user to a dedicated page where they set a new password (twice), then returns them to sign in.

## Why the current flow fails

Supabase's default recovery email contains a link, not a code. The link creates a session and, since no `/reset-password` page exists, the user just lands on the home page already signed in — no password change ever happens.

## Changes

### 1. Simplify `src/routes/forgot-password.tsx`
Remove the two-stage code/OTP logic. Keep only stage 1:
- Email input → `supabase.auth.resetPasswordForEmail(email, { redirectTo: ${window.location.origin}/reset-password })`
- Show a confirmation message: "Check your email for a reset link."
- Link back to `/auth`.

### 2. Create `src/routes/reset-password.tsx` (new)
- On mount, listen for `supabase.auth.onAuthStateChange`; when event is `PASSWORD_RECOVERY`, enable the form. Also allow rendering immediately if a session already exists (link click hydrates the session).
- If no recovery session is detected after a short delay, show an error with a link back to `/forgot-password`.
- Form: New password + Confirm new password (min 6 chars, must match).
- On submit: `supabase.auth.updateUser({ password })` → `supabase.auth.signOut()` → toast success → `navigate({ to: "/auth" })`.

### 3. Update `src/routes/__root.tsx`
Add `/reset-password` to the `publicPath` check in `AuthGate` so the recovery session doesn't bounce the user away before they can set the new password.

## Files

- edit `src/routes/forgot-password.tsx` (simplify to email-only request stage)
- create `src/routes/reset-password.tsx`
- edit `src/routes/__root.tsx` (add `/reset-password` to public paths)

No backend, email domain, or DNS setup required — uses Supabase's default recovery email.
