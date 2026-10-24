# Quickstart: Admin Settings (006)

This assumes the 005 quickstart already works: local Supabase is running and `.env` is set.

## 1. Reset the database with seed data

```bash
npx supabase db reset       # applies all migrations, then supabase/seed.sql
```

Seeded accounts, all of which sign in with an email code through Mailpit:

| Email                  | Role  | Status      |
| ---------------------- | ----- | ----------- |
| admin@trips.test       | admin | active      |
| user@trips.test        | user  | active      |
| deactivated@trips.test | user  | deactivated |

To make a new admin on any environment, run this operator command (it needs the service-role key):

```bash
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run admin:grant -- someone@example.com
```

## 2. Check each story by hand

1. **Roles (US1)**: sign in as `user@trips.test`. There's no Admin entry, and `/admin` shows "not found". Sign in as `admin@trips.test`, open Admin, then Users, then user@trips.test, and choose Make admin. user@trips.test now sees Admin after reloading. Try removing the admin role from both accounts: removing the last admin is refused.
2. **Users (US2)**: search for "user", edit the display name, then deactivate user@trips.test with a reason. Signing in as them now fails. Reactivate them. Send them an email and see it in Mailpit. Open Admin, then Audit log, and see each action.
3. **Banner (US3)**: create a warning banner that starts now, then open the app in a private window. The banner is there. Dismiss it, reload, and it stays dismissed.
4. **Flags (US4)**: the seed includes `saved-trips-notes`. Set its audience to admins and watch the notes field appear or disappear in an open admin tab within 5 seconds.
5. **Activity (US5)**: open Admin, then Activity. The 7, 30 and 90 day views show the seeded trends, with table views. User detail, then Activity, lists sign-ins.

## 3. Automated checks

```bash
npx supabase test db        # 005 + 006 RLS and function tests
npm run test:functions      # deno test supabase/functions
npm run check
npm run e2e                 # includes e2e/admin.spec.ts
```
