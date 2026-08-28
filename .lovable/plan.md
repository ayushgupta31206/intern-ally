# Plan: Gate /admin so interns can't see the admin dashboard

## Problem

The `/admin` routes have no access gate. Any signed-in user — including interns — can navigate to `/admin` and see the admin UI. Data is already isolated by `owner_id` (an intern sees only their own empty workspace, never your data), but they shouldn't see the admin shell or be able to start creating their own workspace there.

## How access is decided

A signed-in user falls into one of these buckets:

| Bucket | Is their email in an interns row? | Do they own interns? | Result |
|---|---|---|---|
| Pure intern | Yes | No | Redirect to `/my` |
| Manager (not listed as intern) | No | — | Allow `/admin` |
| Manager who is also their own intern (you) | Yes | Yes | Allow `/admin` |
| Brand-new user (neither) | No | No | Allow `/admin` (empty setup state) |

This way:
- Interns are bounced to their intern view.
- You (owner of interns, also listed as one) still get through.
- A brand-new manager can sign in and set up their workspace.

## Changes

### 1. New server function: `getMyRole`

**File:** `src/lib/admin.functions.ts`

Add a single server function that returns whether the signed-in user is an intern and/or a manager:

```ts
export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = (context.claims as { email?: string }).email?.toLowerCase();
    const owner = context.userId;

    const [internMatch, ownedInterns] = await Promise.all([
      email
        ? context.supabase.from("interns").select("id").eq("email", email).limit(1)
        : Promise.resolve({ data: null, error: null, count: null, status: 0, statusText: "" }),
      context.supabase.from("interns").select("id", { count: "exact", head: true }).eq("owner_id", owner),
    ]);

    const isIntern = !!internMatch.data && internMatch.data.length > 0;
    const isManager = (ownedInterns.count ?? 0) > 0;
    return { isIntern, isManager };
  });
```

### 2. Gate the admin layout route

**File:** `src/routes/_authenticated/admin/route.tsx`

Add a `beforeLoad` that calls `getMyRole`. If `isIntern && !isManager`, redirect to `/my`. Otherwise allow.

```tsx
beforeLoad: async () => {
  const role = await getMyRole();
  if (role.isIntern && !role.isManager) {
    throw redirect({ to: "/my" });
  }
},
```

This runs client-side (the parent `_authenticated` layout is `ssr: false`), so there is no SSR/redirect-loop concern.

### 3. No RLS or database changes needed

The gate is purely a routing concern. Data isolation is already enforced by `owner_id` scoping in every admin server function and by RLS policies. Even if an intern bypassed the route gate somehow, RLS would still hide your data.

## What this does NOT change

- The intern dashboard (`/my`) still works exactly as before.
- The "Manager dashboard" link on `/my` still appears for users who are both intern and manager.
- Admin server functions remain scoped to `owner_id` — defense in depth.
