# Research: Admin Settings (006)

Builds on [spec 005's research](../005-user-settings/research.md) and [ADR 0001](../../docs/adr/0001-supabase-for-accounts.md). The feature flag design is in [ADR 0002](../../docs/adr/0002-openfeature-supabase-provider.md).

## R1. Where roles live and how they're checked

- **Decision**: a `user_roles` table (one row per admin; no row means `user`). Authorization goes through a `public.is_admin()` SQL function, marked `stable` and `security definer` with a fixed `search_path`, which looks up the caller (`auth.uid()`) in `user_roles`. Every admin RLS policy and Edge Function uses it.
- **For the interface only**: a Supabase [custom access token hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook) adds a `user_role` claim to the access token, so the app can show the Admin menu entry without an extra request.
- **Why**: claims in an access token can be up to an hour old, but checking the table is always current, which meets spec scenario 3 ("takes effect on that user's next request"). The claim is only a hint for the menu, never used for authorization.
- **Last-admin rule**: a trigger on `user_roles` (`before delete or update`) refuses the change when it would leave no admins. It takes `lock table user_roles in share row exclusive mode`, so two admins demoting each other at the same moment can't both succeed.
- **First admin**: `npm run admin:grant -- <email>` runs `scripts/grant-admin.ts` using `SUPABASE_SERVICE_ROLE_KEY` from the operator's environment. It calls `grant_admin_by_email(email)`, which only the `service_role` can run.

## R2. Deactivating accounts

- **Decision**: the `admin-set-status` Edge Function:
  1. checks `is_admin()` for the caller, and refuses a request to deactivate themselves
  2. calls `auth.admin.updateUserById(id, { ban_duration: '876000h' })` to deactivate, or `'none'` to reactivate. A banned user can't sign in or refresh a session.
  3. sets `profiles.status`, `status_reason`, `status_changed_by` and `status_changed_at`
  4. writes an audit entry.
- **Sessions still open**: an existing access token stays valid until it expires (default 1 hour). To block changes at once, every 005 RLS `insert`, `update` and `delete` policy gains `and public.is_active()`. That function checks `profiles.status = 'active'` for the caller.
- **Alternative**: keep the default access token lifetime but lower it. That's possible (for example to 15 minutes) but adds refresh traffic for everyone, so it isn't the default.

## R3. Listing and searching users

- **Decision**: a SQL function `admin_list_users(search text, page int, page_size int)`, marked `security definer`, which first checks `is_admin()`. It joins `auth.users` (`email`, `created_at`, `last_sign_in_at`, `banned_until`) with `profiles` and `user_roles`, and searches with `ilike` on email and display name. A `pg_trgm` index on `profiles.display_name` speeds up name searches. Email searches scan `auth.users`, which is fine at the planned scale of 10k accounts. It returns a total count for pagination.
- **Why**: `auth.admin.listUsers()` can't search or join. A SQL function keeps it to one request, and the role check happens in the database.
- **Editing details**: display name and home location use a normal `update` on `profiles`, allowed by an admin RLS policy. Changing the email goes through the `admin-update-email` Edge Function, which calls `auth.admin.updateUserById(id, { email })` and then emails both the old and new addresses.

## R4. Sending email

- **Decision**: the `admin-send-email` Edge Function sends through the provider chosen in spec 005 (proposed: Resend, using its HTTPS API and the secret `EMAIL_API_KEY`). Messages are plain text only, with a 1–120 character subject and a 1–5,000 character body, from `support@<domain>`, with `Reply-To` set to the support inbox. The audit entry stores the subject and the provider's message ID, not the body.
- **Rate limit**: 20 emails per admin per hour, counted from the audit log.
- **Local development**: with `EMAIL_TRANSPORT=smtp`, the Edge Function sends over SMTP to the local stack's mail catcher, so the end-to-end test can check delivery in Mailpit. The SMTP host and port come from `supabase/functions/.env`.

## R5. Sign-in history

- **Decision**: read `auth.audit_log_entries`, where `payload->>'action' = 'login'`, through an admin-only function `admin_user_sign_ins(user_id, limit)`, which is `security definer` and checks `is_admin()`. It returns the time, the sign-in method where the log records one, and `ip_address`. The interface shows the IP address partly hidden (for example `81.2.x.x`), which is enough to spot a sign-in from an unusual network without showing the full address. Looking up a location from the IP address is out of scope, because it would need a third-party lookup service.
- **Why**: Supabase Auth already records sign-ins, so nothing extra needs to be added. The daily sign-in totals are copied into `daily_activity_totals` by the nightly job (R7), so they survive the auth log being cleaned up.

## R6. Recording activity events

- **Decision**: an RPC function `track_event(kind, subject)` for the `authenticated` role, marked `security definer`, which checks `is_active()`. `kind` must be one of `search`, `view_activity` or `save_activity`, and `subject` must be at most 200 characters with no spaces (an activity or category ID). Each user is limited to 120 events per minute, enforced by the function. The client sends events in the background and ignores failures.
- **Privacy**: no search text, coordinates or free text is stored. The rest is pending the clarification in FR-015 of spec 006.

## R7. Trends and retention

- **Decision**: a `pg_cron` job runs nightly at 02:15 UTC. It:
  1. adds the previous day's totals from `activity_events` and `auth.audit_log_entries` to `daily_activity_totals (day, kind, subject, count)`
  2. deletes raw events older than the retention period (FR-014; proposed 90 days).
- **The Activity page** reads only the totals through `admin_trends(from, to)` and `admin_top(kind, from, to, limit)`. Today's partial numbers are counted live from `activity_events`. 90 days of totals is at most about 90 × 4 × 200 rows, so it is fast without extra indexes beyond the primary key `(day, kind, subject)`.
- **Charts**: inline SVG components with a `<table>` alternative (FR-013). No chart library is added.

## R8. Banner and flag loading for anonymous visitors

- **Decision**: both are read with a plain `fetch` to the Supabase REST endpoint (`/rest/v1/app_banners?…` and `/rest/v1/feature_flags?…`) with the publishable key, after the first render. Both tables have a public `select` policy that only allows the safe columns (active banners only, and flag settings). This is done without `supabase-js` (spec 005 R3), and with a 3-second timeout that falls back to defaults.
- **Layout shift**: the banner is placed above the header, and it only appears once loaded. To keep layout shift (CLS) at or below 0.1, it slides in using `transform` and reserves its height only after being measured. Users who prefer reduced motion get no animation.

## R9. Audit log

- **Decision**: an `admin_audit_log` table. The `authenticated` role can only `select` from it, and only through an `is_admin()` policy. Nobody has `insert`, `update` or `delete` grants. Entries are written only by `security definer` triggers on `user_roles`, `profiles` (status changes and edits by an admin), `app_banners` and `feature_flags`, and by the Edge Functions, which use the service role. A trigger also blocks `update` and `delete` for every role except the retention job's owner.
