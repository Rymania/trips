# ADR 0001: Use Supabase for accounts, authentication and user data

- **Status**: Proposed
- **Date**: 2026-10-24
- **Deciders**: Rymania
- **Relates to**: [#7 User settings](https://github.com/Rymania/trips/issues/7), [#8 Admin settings](https://github.com/Rymania/trips/issues/8), specs `005-user-settings` and `006-admin-settings`

## Context

Trips is a static React app built with Vite and served by nginx. It has no backend, database or sign-in. Issues #7 and #8 need:

- user accounts and sign-in
- per-user data: profile, family, saved trips and preferences
- roles (admin and user), enforced on the server
- admin actions that need elevated rights: deactivating users, editing their details, sending email
- login and activity history with trends
- feature flags and a site-wide banner that admins control

The constitution requires RBAC, secrets kept out of the repo, encryption in transit and at rest, versioned and documented APIs, and tests written first. The team is small and the app has no server code today.

## Options considered

1. **Supabase**: hosted Postgres with Auth, row-level security (RLS), Edge Functions, Realtime, and a local stack that runs in Docker through the Supabase CLI.
2. **Our own Node/TypeScript API with Postgres**: run in `compose.yaml` with an auth library such as Auth.js or Lucia.
3. **Browser storage only**: no backend.

## Decision

Use **Supabase** (option 1).

- **Auth**: Supabase Auth with email one-time links or codes. Social providers can be added later without changing the data model.
- **Data**: Postgres tables in the `public` schema. Every table has RLS turned on, and access is defined only through policies.
- **Elevated actions**: Edge Functions written in TypeScript on Deno. These are the only code that holds the service-role key, and they check the caller's admin role before acting.
- **Local development and CI**: the `supabase start` stack, with migrations in `supabase/migrations/` and database tests in `supabase/tests/` (pgTAP).

## Consequences

**Positive**

- Sign-in, sessions, email confirmation and rate limiting come built in, so there's no session or password code for us to secure.
- RLS enforces "users only see their own data" and "only admins" inside the database. That meets FR-013 in spec 005 and the role checks in spec 006 even if the client is bypassed.
- The frontend can stay a static nginx container, with no new long-running service to operate.
- Migrations and policy tests live in the repo and run in CI.

**Negative and risks**

- **Vendor dependency.** We mitigate it by keeping data in plain Postgres tables and keeping Supabase calls behind a small `src/account/` client layer. Self-hosting Supabase is also possible.
- **Email.** Supabase's built-in email service is for development only: it is heavily rate-limited and only delivers to project team members. Production needs a custom SMTP provider (to be chosen; see research.md).
- **Bundle size.** `@supabase/supabase-js` adds about 30 to 40 KB gzipped. It is loaded on demand so the main bundle stays within the 150 KB budget.
- The frontend build needs the project URL and publishable key. These are public by design and safe to ship. The service-role key must never reach the frontend or the repo.
- CI needs Docker to run the local Supabase stack for database tests and end-to-end tests.

## Rejected alternatives

- **Own API**: gives full control, but means building and securing sessions, email flows, rate limiting and RBAC ourselves, plus running another service. That is more work and more risk than these issues justify.
- **Browser storage only**: can't hold data across devices, and can't support #8 at all, since roles, managing users and login history need a server.
