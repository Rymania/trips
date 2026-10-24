---
description: 'Task list for 006 Admin Settings'
---

# Tasks: Admin Settings

**Input**: Design documents from `/specs/006-admin-settings/`
**Prerequisites**: 005-user-settings merged; plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Required (constitution I). In each story, write the tests first and see them fail.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: The user story the task belongs to (US1–US5)

---

## Phase 1: Setup

- [ ] T001 Add `@openfeature/web-sdk` and `@openfeature/react-sdk`, and add `admin:grant` and `test:functions` scripts, in `package.json`
- [ ] T002 [P] Turn on the custom access token hook (`[auth.hook.custom_access_token]`) and `pg_cron` in `supabase/config.toml`
- [ ] T003 [P] Add the `EMAIL_API_KEY`, `EMAIL_FROM`, `EMAIL_TRANSPORT` and SMTP settings to `supabase/functions/.env.example`
- [ ] T004 [P] Add a Deno test step for `supabase/functions/**` to the `supabase` CI job
- [ ] T005 [P] Add a second budget to the bundle size check: the main bundle for non-admins grows by 8 KB gzipped or less compared with 005

---

## Phase 2: Foundational (blocks every story)

- [ ] T006 Write `supabase/tests/006_admin_settings_rls.test.sql` with the fixtures and cases 1, 5, 6 and 10 from contracts/rls-policies.md. They must fail first
- [ ] T007 Write migration `20261101000100_admin_settings.sql` part 1: the `user_roles` table, the new `profiles` status columns, `is_admin()`, `is_active()`, `custom_access_token_hook`, `grant_admin_by_email`, the `admin_audit_log` table with its protection trigger, and the `is_active()` additions to 005's policies. Pass the T006 cases
- [ ] T008 [P] Write `supabase/functions/_shared/requireAdmin.ts` and `audit.ts`, with Deno tests: a missing token gives 401, a non-admin gives 403, and an admin passes
- [ ] T009 [P] Write `supabase/seed.sql` (accounts, flags, 90 days of events)
- [ ] T010 Regenerate `src/account/database.types.ts`
- [ ] T011 [P] Add the admin strings to `src/i18n/en.ts`

**Checkpoint**: `is_admin()` is enforced, deactivated users can't change data, and every existing test still passes.

---

## Phase 3: US1, roles and admin access (P1) 🎯 MVP

- [ ] T012 [P] [US1] Add pgTAP cases 3 and 4 (role grant and revoke audit, last-admin rule including the concurrent case)
- [ ] T013 [P] [US1] Write the Vitest test `AdminLayout.test.tsx`: non-admins get "not found", admins see the section navigation, and a `not_admin` response shows "You no longer have access"
- [ ] T014 [P] [US1] Write the Vitest test for `scripts/grant-admin.ts`, using a fake client: unknown email, already an admin, success
- [ ] T015 [P] [US1] Write the e2e test `admin.spec.ts`, "only admins can reach /admin"
- [ ] T016 [US1] Add the `ensure_an_admin_remains` and `audit_user_roles` triggers to the migration
- [ ] T017 [US1] Implement `scripts/grant-admin.ts`
- [ ] T018 [US1] Implement `src/routes/admin/AdminLayout.tsx`, the `/admin/*` routes in `useRoute`, and the Admin entry in `AccountMenu`
- [ ] T019 [US1] Add the role control to `UserDetail.tsx`, with a confirmation when removing your own role

---

## Phase 4: US2, manage users (P1)

- [ ] T020 [P] [US2] Add pgTAP case 2, and tests for `admin_list_users`: search, paging, total count, and a non-admin being refused
- [ ] T021 [P] [US2] Write Deno tests for `admin-set-status`: deactivate, reactivate, refusing to deactivate yourself, a missing reason, and one audit entry each
- [ ] T022 [P] [US2] Write Deno tests for `admin-update-email` (email already taken, both addresses told) and `admin-send-email` (validation, the 21st email in an hour gives 429, a provider failure gives 502 with no audit entry)
- [ ] T023 [P] [US2] Write Vitest tests for `UsersPage.tsx` and `UserDetail.tsx`: search with debounce, paging, edit form validation, the deactivation dialog, and the email form
- [ ] T024 [P] [US2] Write the e2e test "deactivate blocks sign-in; reactivate restores", and "email to user arrives in Mailpit"
- [ ] T025 [US2] Add `admin_list_users`, the admin `profiles` update policy, the `audit_profile_admin_edit` trigger, and the trigger that blocks status changes through the REST API
- [ ] T026 [US2] Implement the `admin-set-status`, `admin-update-email` and `admin-send-email` functions, with `_shared/email.ts` supporting both the provider API and SMTP
- [ ] T027 [US2] Implement `adminApi.ts`, `UsersPage.tsx` and `UserDetail.tsx` (Profile, Role, Status and Email tabs)

---

## Phase 5: US3, app banner (P2)

- [ ] T028 [P] [US3] Add pgTAP case 7 (banner part), plus `one_active_banner` and the time-window checks
- [ ] T029 [P] [US3] Write the Vitest test `AppBanner.test.tsx`: HTML in the message is shown as text, the link only allows https, dismissal is stored per banner, a fetch failure shows nothing, and `role="status"`
- [ ] T030 [P] [US3] Write the Vitest test `BannerPage.test.tsx`: preview, validation (end before start, link without text), publish and end
- [ ] T031 [P] [US3] Write the e2e test "published banner shows to anonymous visitors without layout shift", checking that CLS is 0.1 or less with a PerformanceObserver
- [ ] T032 [US3] Add the `app_banners` table, the `active_banner` view, the triggers and the audit trigger to the migration
- [ ] T033 [US3] Implement `fetchActiveBanner.ts` and `AppBanner.tsx`, and mount the banner above the header in `App.tsx`
- [ ] T034 [US3] Implement `BannerPage.tsx`

---

## Phase 6: US4, feature flags (P2)

- [ ] T035 [P] [US4] Write the Vitest tests `bucket.test.ts` and `evaluate.test.ts`: buckets are stable, a 50% rollout is within ±5% over 10k IDs, the three audiences, a disabled flag gives the default, and an unknown key gives the default
- [ ] T036 [P] [US4] Write the Vitest test `TripsFlagProvider.test.ts`: ready and error events, a fetch timeout giving defaults, refetching on focus every 5 minutes, and `ConfigurationChanged` from Realtime
- [ ] T037 [P] [US4] Add pgTAP case 7 (flags part), and the flag audit trigger
- [ ] T038 [P] [US4] Write the Vitest test `FlagsPage.test.tsx`: key validation, the audience and rollout controls, delete with confirmation
- [ ] T039 [P] [US4] Write the e2e test "admin toggles flag; open signed-in tab updates within 5s"
- [ ] T040 [US4] Add the `feature_flags` table, the realtime publication and the audit trigger to the migration
- [ ] T041 [US4] Implement `bucket.ts`, `evaluate.ts`, `anonymousId.ts`, `TripsFlagProvider.ts` and `FlagsProvider.tsx`, and register the provider in `main.tsx`
- [ ] T042 [US4] Implement `FlagsPage.tsx`
- [ ] T043 [US4] Put the saved-trip notes field from 005 behind the `saved-trips-notes` flag as the first real use, and document how to add a flag in the README

---

## Phase 7: US5, sign-ins, activity and trends (P3)

- [ ] T044 [P] [US5] Add pgTAP cases 8 and 11, plus tests for `admin_trends`, `admin_top`, `admin_user_sign_ins` and `admin_user_events`
- [ ] T045 [P] [US5] Write the Vitest test `track.test.ts`: does nothing when signed out or opted out, the search debounce, and failures are ignored
- [ ] T046 [P] [US5] Write Vitest tests for `LineChart`, `BarList` and `ActivityPage`: the table alternative, the 7, 30 and 90 day switch, empty data, and accessible names
- [ ] T047 [US5] Add `activity_events`, `daily_activity_totals`, `track_event`, `rollup_daily_totals`, the admin trend functions and the `pg_cron` schedule to the migration
- [ ] T048 [US5] Implement `src/account/track.ts`, and call it from the search, the detail dialog and saving
- [ ] T049 [US5] Implement the charts and `ActivityPage.tsx`, and the Activity tab in `UserDetail.tsx` (sign-ins with the IP partly hidden, recent events)
- [ ] T050 [US5] Add the `tracking_opt_out` setting under Settings, then Contact & privacy (from 005's `ContactSection`)

---

## Phase 8: Polish

- [ ] T051 [P] Write the Vitest test and implementation for `AuditLogPage.tsx`: filter by action and target, paging. Add pgTAP case 9
- [ ] T052 [P] Run axe checks in Playwright on every `/admin/*` page, at 320, 768, 1024 and 1440 px
- [ ] T053 [P] Add an "Admin access" section to the README: making the first admin, seed accounts, adding a flag
- [ ] T054 Resolve FR-014, FR-015 and FR-016 with the product owner, and update the migration constants, the privacy notice text and the email provider
- [ ] T055 Go through quickstart.md end to end, and confirm the bundle budgets, coverage of at least 85% for `src/flags`, `src/banner` and `src/account`, and that CI is green

## Dependencies

- 005 must be merged first. Then Phase 1, then Phase 2, then the stories.
- US1 blocks US2 (UserDetail). US3 and US4 depend only on Phase 2 and can run in parallel with US1 and US2. Most of US5 depends only on Phase 2 too, but its per-user Activity tab (part of T049) needs US2's `UserDetail.tsx`.
- In every story, write the tests and see them fail before implementing.
