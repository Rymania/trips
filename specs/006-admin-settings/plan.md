# Implementation Plan: Admin Settings

**Branch**: `006-admin-settings` | **Date**: 2026-10-24 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/006-admin-settings/spec.md`
**Depends on**: `005-user-settings`, which must be merged first

## Summary

Add an admin area at `/admin`, lazily loaded and shown only to admins. In it, Trips owners can:

- give or remove the admin role
- find, edit, deactivate and email users
- publish a site-wide banner
- manage feature flags that the app checks through OpenFeature
- see sign-ins, activity and trends.

Authorization happens in Postgres. A `user_roles` table and the `is_admin()` function back every admin RLS policy and admin SQL function. Actions that need the service-role key run in three Edge Functions. Every admin action writes to an audit log that can only be added to. Visitors who aren't admins load only the banner and the OpenFeature SDK and provider (8 KB gzipped or less).

## Technical Context

**Language/Version**: Same as 005: TypeScript 6 and React 19, Postgres 15, TypeScript Edge Functions on Deno 2
**Primary Dependencies**: New runtime dependencies are `@openfeature/web-sdk` and `@openfeature/react-sdk`. Postgres extensions `pg_cron` and `pg_trgm`, both available in Supabase. Email goes through the provider's HTTPS API (proposed: Resend), with no SDK
**Storage**: Supabase Postgres (tables in data-model.md); `localStorage` for dismissed banners and the anonymous ID used for flag rollouts
**Testing**: pgTAP (RLS, triggers, functions), Deno tests (Edge Functions), Vitest and Testing Library (provider, components), Playwright (admin user flows, banner, flags)
**Target Platform**: Same as 005
**Project Type**: Web application. A static single-page app plus Supabase
**Performance Goals**: Admin pages usable within 1 s of opening; 90 days of totals in under 1 s at 10k users; flag changes reach signed-in visitors in 5 s or less
**Constraints**: Authorization only on the server; banner and flags must never block first paint or cause layout shift above 0.1; no chart library; WCAG 2.1 AA, with table alternatives to charts
**Scale/Scope**: About 10k users, about 50 flags, 1 active banner; 6 admin screens

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle             | How this plan complies                                                                                                                                 | Status |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| I. Test-first         | tasks.md has a failing pgTAP, Deno, Vitest or Playwright test before each implementation task. Cases 1–11 in contracts/rls-policies.md are mandatory | ✅     |
| II. Code quality      | Generated database types; two small, justified runtime dependencies (ADR 0002); the provider is a pure, unit-tested module                             | ✅     |
| III. UX consistency   | Admin UI uses the Terra tokens and existing components; tables and forms meet WCAG AA; charts are inline SVG with tables; text comes from `src/i18n/en.ts` | ✅     |
| IV. Performance       | `/admin` is lazily loaded; banner and flags are fetched without `supabase-js`; the bundle size check (from 005) gets a non-admin budget                 | ✅     |
| V. Error handling     | Flags fall back to the code's defaults; banner failures are silent; admin actions show "not saved, try again"; email failures return 502 and aren't recorded as sent | ✅     |
| VI. Security          | Role-based access in the database; `security definer` functions with an empty `search_path`; service role only in Edge Functions; audit log can't be edited; last-admin rule; rate-limited email and tracking; plain-text banner | ✅     |
| Workflow: ADR, docs   | ADR 0002; OpenAPI contract; README section "Admin access"                                                                                              | ✅     |

**Open clarifications** (spec FR-014, FR-015, FR-016): retention periods, the consent model for activity tracking, and the email provider. The plan uses the values the spec proposes. Each one is a single setting or migration constant, so changing it later doesn't affect the design.

## Project Structure

### Documentation (this feature)

```text
specs/006-admin-settings/
├── spec.md
├── plan.md                 # this file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── rls-policies.md
│   └── edge-functions.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── flags/                         # NEW
│   ├── TripsFlagProvider.ts       # OpenFeature Provider (ADR 0002)
│   ├── bucket.ts                  # fnv1a rollout bucketing (pure)
│   ├── evaluate.ts                # audience + rollout rules (pure)
│   ├── anonymousId.ts
│   └── FlagsProvider.tsx          # registers provider, sets context from auth
├── banner/                        # NEW
│   ├── AppBanner.tsx              # public banner (plain text, dismiss)
│   └── fetchActiveBanner.ts
├── account/
│   └── track.ts                   # NEW: fire-and-forget track_event()
├── routes/admin/                  # NEW, lazy chunk
│   ├── AdminLayout.tsx            # guard + section nav
│   ├── UsersPage.tsx
│   ├── UserDetail.tsx             # profile, role, status, email, activity tabs
│   ├── BannerPage.tsx
│   ├── FlagsPage.tsx
│   ├── ActivityPage.tsx
│   ├── AuditLogPage.tsx
│   ├── charts/{LineChart.tsx,BarList.tsx}   # SVG + <table>
│   └── adminApi.ts                # typed RPC + Edge Function calls
└── components/AccountMenu.tsx     # + "Admin" entry when user_role claim = admin

supabase/
├── migrations/20261101000100_admin_settings.sql
├── functions/
│   ├── admin-set-status/index.ts
│   ├── admin-update-email/index.ts
│   ├── admin-send-email/index.ts
│   └── _shared/{requireAdmin.ts,email.ts,audit.ts}
├── seed.sql                       # demo users, events, flags for local dev
└── tests/006_admin_settings_rls.test.sql

scripts/grant-admin.ts             # operator bootstrap (FR-004)
e2e/admin.spec.ts
docs/adr/0002-openfeature-supabase-provider.md
```

**Structure Decision**: Same single project as 005. Admin code lives under `src/routes/admin/` so it forms its own lazy chunk. The flag and banner modules are small and loaded for everyone, and they don't use `supabase-js`.

## Key design notes

- **Admin guard**: `AdminLayout` shows the "not found" page unless the `user_role` claim is `admin`. That only controls what's shown. Every request is still authorized by the server, and a `not_admin` response at any point switches the page to "You no longer have access".
- **Flags context**: `FlagsProvider` calls `OpenFeature.setContext({ targetingKey, signedIn, role })` whenever the sign-in state changes. Both the React SDK's `useBooleanFlagValue(key, default)` and the provider's `ConfigurationChanged` events cause components to re-render.
- **Recording events**: `track()` is called from the search (debounced to one event per committed filter change, with the subject being each selected category), from opening the detail dialog (`view_activity`) and from saving (`save_activity`). It does nothing when signed out or when `tracking_opt_out` is set.
- **Scheduled jobs**: the migration enables `pg_cron`, and `cron.schedule('rollup-daily', '15 2 * * *', 'select public.rollup_daily_totals(current_date - 1)')`.
- **Seed data**: `supabase/seed.sql` creates `admin@trips.test`, `user@trips.test` and `deactivated@trips.test`, plus 90 days of synthetic events, so the admin pages can be built and tested locally.

## Complexity Tracking

Not needed, because the Constitution Check found no violations.
