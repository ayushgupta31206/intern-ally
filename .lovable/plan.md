# Fix: admin password accepted but nothing happens

## What's actually going wrong

The captured network traffic from your attempt shows the flow working right up to the last step:

1. `adminLogin` was called with your password and returned **ok: true** — so the password is correct.
2. Immediately after, `adminStatus` returned **isAdmin: false** — the admin session was gone on the very next request.
3. Because of that, `/admin` bounced you straight back to the sign-in page, which looks like "nothing happened".

Cause: the admin session cookie is set with `sameSite: "lax"`. The app preview is rendered inside an iframe, which browsers treat as a third-party context, so a `Lax` cookie is never sent back. The session therefore never sticks.

## The fix

1. In the admin session config, set the cookie to `sameSite: "none"` with `secure: true` so it is accepted and returned inside the embedded preview as well as on the published site.
2. Keep `httpOnly: true` and `path: "/"` — the cookie stays unreadable to page scripts.
3. After a successful login, re-check admin status and invalidate the router before navigating, so `/admin` loads with the fresh session instead of a stale one.
4. Show a clear inline message if the session still isn't established, instead of silently staying on the page.

## Verification

Drive the real sign-in flow in a headless browser against the running app: submit the password, confirm the admin session cookie comes back on the next request, and confirm the dashboard renders (pool counts, assignment log) rather than redirecting to the login page.

## Technical notes

- File to change: `src/lib/admin.server.ts` (`sessionConfig` cookie options).
- File to change: `src/routes/admin-login.tsx` (post-login status re-check + router invalidate before `navigate({ to: "/admin" })`).
- No database, schema, or RLS changes; intern Google sign-in is untouched.
