# Implementation Plan: User Settings

**Branch**: `005-user-settings` | **Date**: 2026-10-24 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/005-user-settings/spec.md`

## Summary

Add optional accounts so families keep their profile, family members, saved trips, theme and contact preferences across devices. Sign-in uses an emailed one-time link or code through Supabase Auth. Data lives in Supabase Postgres tables, and row-level security (RLS) gives each user access only to their own rows. The frontend stays a static Vite build served by nginx. The Supabase client, the sign-in page, saved trips and settings are all lazy-loaded, so anonymous browsing costs no extra bundle size. Three Edge Functions handle the actions that need elevated rights: deleting an account, exporting data and unsubscribing.

## Technical Context

**Language/Version**: TypeScript 6 (strict) and React 19 on the frontend; Postgres 15 SQL; TypeScript on Deno 2 for Edge Functions
**Primary Dependencies**: Existing: Vite 8, Leaflet. New: `@supabase/supabase-js@2`, and dev-only `@playwright/test` and the `supabase` CLI
**Storage**: Supabase Postgres (tables described in data-model.md); `localStorage` for the device theme and the Supabase session
**Testing**: Vitest and Testing Library (unit and component tests), pgTAP through `supabase test db` (RLS and constraints), Playwright (end-to-end)
**Target Platform**: Modern evergreen browsers, last 2 versions. The static site is served by nginx in Docker, with Supabase hosted in production and run locally through `supabase start`
**Project Type**: Web application. A static single-page app plus a backend-as-a-service (Supabase)
**Performance Goals**: Main bundle ≤ 150 KB gzipped (about 79 KB today); LCP ≤ 2.5 s; settings and saved trips usable within 1 s of opening, once the client is cached
**Constraints**: Anonymous browsing must work exactly as today and must not load the Supabase client; no service-role key in the frontend; WCAG 2.1 AA; i18n for all new text
**Scale/Scope**: Up to 10k accounts, ≤ 20 family members and ≤ 500 saved trips per account; about 5 new screens or sections

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                    | How this plan complies                                                                                                                                         | Status |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| I. Test-first                | tasks.md puts a failing test before every implementation task: pgTAP for RLS, Vitest for domain logic and components, Playwright for sign-up and saving. Coverage now includes `src/account/**` | ✅     |
| II. Code quality             | Strict TypeScript, with Supabase row types generated (`supabase gen types`) rather than hand-written; existing eslint and prettier rules; one new runtime dependency, justified in ADR 0001 | ✅     |
| III. UX consistency          | New UI uses only the Terra tokens and existing components (`.btn`, `.card`, `.field`, `.chips`); keyboard and screen-reader paths are tested; text comes from `src/i18n/en.ts`; mobile-first | ✅     |
| IV. Performance              | Supabase client and new routes are lazy-loaded (research R3); a bundle size check is added to CI                                                               | ✅     |
| V. Error handling            | Every network action has loading, error and retry states; if auth is unavailable the app falls back to anonymous use (spec edge cases)                          | ✅     |
| VI. Security                 | RLS on every table; secrets only in Edge Function env and CI secrets; signed unsubscribe links; Supabase Auth rate limits; inputs checked on both client and database | ✅     |
| Workflow: ADR, docs          | ADR 0001 added; README gains a "Local Supabase" section; OpenAPI contract for the Edge Functions                                                               | ✅     |

There are no violations, so the Complexity Tracking section is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/005-user-settings/
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
├── account/                     # NEW: everything that talks to Supabase
│   ├── client.ts                # lazy createClient() with env config
│   ├── AuthProvider.tsx         # session context + useAuth()
│   ├── ProfileProvider.tsx      # profile/family/saved/prefs context + hooks
│   ├── repo.ts                  # typed data access (profiles, family, saved, prefs)
│   ├── savedMerge.ts            # session → account merge (pure)
│   ├── theme.ts                 # resolveTheme(), applyTheme(), persist
│   ├── database.types.ts        # generated by `supabase gen types`
│   └── types.ts
├── domain/
│   └── family.ts                # NEW: familyDefaults() (pure)
├── routes/                      # NEW: lazy routes
│   ├── useRoute.ts
│   ├── SignIn.tsx
│   ├── AuthCallback.tsx
│   ├── SavedTrips.tsx
│   └── settings/
│       ├── Settings.tsx
│       ├── ProfileSection.tsx
│       ├── FamilySection.tsx
│       ├── ContactSection.tsx
│       ├── AppearanceSection.tsx
│       └── DataSection.tsx
├── components/
│   └── AccountMenu.tsx          # NEW: header sign-in / account menu
├── App.tsx                      # wraps providers, routes, uses family defaults
└── styles.css                   # data-theme overrides, settings layout

supabase/                        # NEW
├── config.toml
├── migrations/20261024000100_user_settings.sql
├── functions/
│   ├── _shared/{cors.ts,auth.ts,errors.ts}
│   ├── delete-account/index.ts
│   ├── export-data/index.ts
│   └── unsubscribe/index.ts
├── templates/magic_link.html    # link + 6-digit code
└── tests/005_user_settings_rls.test.sql

e2e/                             # NEW (Playwright)
├── playwright.config.ts
├── helpers/mailpit.ts
└── account.spec.ts

docs/adr/0001-supabase-for-accounts.md
```

**Structure Decision**: The repo stays a single web project. Supabase lives in `supabase/` as the CLI expects, so migrations, functions and tests are versioned together. All Supabase access in the frontend goes through `src/account/`, so components never import `@supabase/supabase-js` directly. That makes them easy to test with a fake client, and keeps the vendor in one place (ADR 0001).

## Key design notes

- **Configuration**: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are read at build time. Both are public. When they're missing, `src/account/client.ts` reports "accounts unavailable", the account menu is hidden, and the app works anonymously. The Dockerfile takes them as build `ARG`s, `compose.yaml` passes them in from `.env`, and `.env.example` documents them.
- **Theme**: an inline script in `index.html` runs before first paint (research R5). `styles.css` gains `:root[data-theme=…]` blocks, and the `prefers-color-scheme` block is limited to `:root:not([data-theme='light'])`.
- **Family defaults**: `useFilters` takes an optional `defaults` argument. `App` passes `familyDefaults(members, new Date())` only when the URL has no filter parameters.
- **Saved trips**: the existing `sessionStorage` saved list stays for anonymous visitors. On `SIGNED_IN`, `savedMerge` upserts it into the account and clears it. From then on, saving and removing go through `repo.ts`, updating the screen straight away and rolling back if the request fails.
- **Cross-tab sign-out**: rely on the `onAuthStateChange` events that supabase-js broadcasts between tabs.
- **CI**: a new `supabase` job in `.github/workflows/build.yml` installs the CLI with `supabase/setup-cli`, runs `supabase start`, `supabase db lint`, `supabase test db`, then builds and runs Playwright. A bundle size check (`size-limit` or a small script) fails the build above 150 KB gzipped.

## Complexity Tracking

Not needed, because the Constitution Check found no violations.
