
## Problem

Supabase's recovery link redirects to the site's default URL (usually `/`), not to `/reset-password`. When you click the email link:
1. Supabase JS parses the recovery tokens in the URL hash
2. Fires a `PASSWORD_RECOVERY` auth event
3. Signs you in with a temporary recovery session
4. But since you land on `/`, the `/reset-password` page never mounts and never sees the event — so nothing happens and you just look "signed in"

Also, "can't log in now" is expected: you never actually set a new password. The previous recovery session has since expired. Once the flow is fixed, request a fresh reset link and it will work.

## Fix

Intercept `PASSWORD_RECOVERY` globally so no matter where the recovery link drops you, you get sent to `/reset-password` immediately.

### 1. `src/lib/auth.tsx`

In the `onAuthStateChange` handler, when the event is `PASSWORD_RECOVERY`, set a module-level flag `isRecovering = true` and use `window.location.replace('/reset-password' + window.location.hash)` if not already on that path. Using `window.location` (not the router) guarantees the redirect wins over any other navigation racing with it (e.g. AuthGate sending an authenticated user to `/`).

### 2. `src/routes/__root.tsx` (AuthGate)

- Keep `/reset-password` in `publicPath`.
- Add a guard: if `window.location.hash` contains `type=recovery` OR the pathname is `/reset-password`, do NOT run the "session && path === '/auth' → redirect to /" branch and do NOT redirect authenticated users off `/reset-password`. This prevents the race where the recovery session triggers a redirect to `/` before the recovery event handler fires.

### 3. `src/routes/reset-password.tsx`

No functional change needed — it already listens for `PASSWORD_RECOVERY` and accepts an existing session. Just confirm it doesn't call `signOut` before `updateUser` completes (it doesn't).

## Notes for the user

- After this fix ships, request a **new** reset link. The old one is single-use and likely expired.
- If you truly can't get in and reset also fails, tell me — I can wipe your account server-side and you can sign up fresh.
- No email domain, DNS, or backend changes required.
