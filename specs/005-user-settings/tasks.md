---
description: 'Task list for 005 User Settings'
---

# Tasks: User Settings

**Input**: Design documents from `/specs/005-user-settings/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Required. The constitution mandates test-first development, so every story writes its tests first and confirms they fail before implementing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: The user story the task belongs to (US1–US7)

---

## Phase 1: Setup

- [x] T001 Add the `supabase` CLI and `@playwright/test` as dev dependencies, and `@supabase/supabase-js@2` as a runtime dependency, in `package.json`. Add `e2e` and `db:test` scripts
- [x] T002 Run `npx supabase init` to create `supabase/config.toml`. Set `site_url` and `additional_redirect_urls` to `http://localhost:5173` and `http://localhost:8080`, and the email OTP length to 6
- [x] T003 [P] Add `.env.example` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, and add `.env` to `.gitignore` and `.dockerignore`
- [x] T004 [P] Add `VITE_SUPABASE_*` build `ARG`s to `Dockerfile`, and pass them from `.env` as build args in `compose.yaml`
- [x] T005 [P] Add `e2e/playwright.config.ts` and `e2e/helpers/mailpit.ts`, which fetches the latest OTP for an address from the Mailpit API
- [x] T006 [P] Extend Vitest coverage `include` to `src/account/**`, and exclude `e2e/` and `supabase/` from Vitest, eslint and tsc
- [x] T007 Add a `supabase` CI job to `.github/workflows/build.yml` that runs `supabase/setup-cli`, `supabase start`, `db lint`, `test db`, `npm run e2e`, then `supabase stop`
- [x] T008 [P] Add a CI bundle size check that fails if the main JS is over 150 KB gzipped

---

## Phase 2: Foundational (blocks every story)

- [x] T009 Write `supabase/tests/005_user_settings_rls.test.sql`, covering cases 1–8 from contracts/rls-policies.md. It must fail because the tables don't exist yet
- [x] T010 Write migration `supabase/migrations/20261024000100_user_settings.sql` with the four tables, constraints, `set_updated_at` and family limit triggers, `handle_new_user` trigger, RLS policies and grants. Pass T009
- [x] T011 Generate `src/account/database.types.ts` with `supabase gen types typescript --local`, and add a `db:types` script
- [x] T012 [P] Write the test `src/account/client.test.ts`: when the env vars are missing, `getClient()` returns null and `accountsEnabled` is false
- [x] T013 Implement `src/account/client.ts`: lazy `import('@supabase/supabase-js')`, a single shared client, and `hasStoredSession()` that checks localStorage synchronously
- [x] T014 [P] Write tests for `src/routes/useRoute.ts`: push and replace, back and forward, and unknown paths falling back to `/`
- [x] T015 Implement `src/routes/useRoute.ts`, and wire lazy routes with a `<Suspense>` skeleton into `src/App.tsx`
- [x] T016 [P] Add the account, settings and saved trips strings to `src/i18n/en.ts`

**Checkpoint**: migrations and RLS tests pass, the app routes between pages, and anonymous behaviour is unchanged (existing 21 tests are green).

---

## Phase 3: US1, sign in (P1) 🎯 MVP

- [x] T017 [P] [US1] Write the test `src/account/AuthProvider.test.tsx`, using a fake client: states go from loading to anonymous to signed in, sign-out clears the session, and an unavailable client gives anonymous
- [x] T018 [P] [US1] Write the test `src/components/AccountMenu.test.tsx`: it shows "Sign in" when anonymous, and the menu (Settings, Saved trips, Theme, Sign out) when signed in, and is keyboard-operable
- [x] T019 [P] [US1] Write the test `src/routes/SignIn.test.tsx`: email validation, the "check your email" state, entering the code, and expired code and rate-limit errors
- [x] T020 [P] [US1] Write the end-to-end test `e2e/account.spec.ts` "signs up and signs in with email code", reading the code through Mailpit
- [x] T021 [US1] Implement `src/account/AuthProvider.tsx` (`useAuth`)
- [x] T022 [US1] Implement `src/routes/SignIn.tsx` and `src/routes/AuthCallback.tsx`
- [x] T023 [US1] Implement `src/components/AccountMenu.tsx` and add it to the header in `src/App.tsx`, with styles in `src/styles.css`
- [x] T024 [US1] Add `supabase/templates/magic_link.html`, containing the link and the code, and reference it in `config.toml`

---

## Phase 4: US2, saved trips (P1)

- [ ] T025 [P] [US2] Write the test `src/account/savedMerge.test.ts`: merges with no duplicates and keeps existing notes and dates
- [ ] T026 [P] [US2] Write the test `src/routes/SavedTrips.test.tsx`: ordering, editing the planned date and note, "No longer available", removing, and the empty state
- [ ] T027 [P] [US2] Add the end-to-end test "saved trip appears on a second browser context"
- [ ] T028 [US2] Implement the saved trip functions in `src/account/repo.ts` and the state in `src/account/ProfileProvider.tsx`, updating the screen straight away and rolling back on error
- [ ] T029 [US2] Implement `src/account/savedMerge.ts` and run it on `SIGNED_IN`
- [ ] T030 [US2] Switch saving in `ActivityDetail` to the provider when signed in, keep `sessionStorage` otherwise, and add the "sign in to keep" prompt
- [ ] T031 [US2] Implement `src/routes/SavedTrips.tsx`

---

## Phase 5: US3, family members (P2)

- [ ] T032 [P] [US3] Write the test `src/domain/family.test.ts` for `familyDefaults`: ages at a month boundary, 18+ adds no group, a dog alone, an empty family, and duplicate groups
- [ ] T033 [P] [US3] Write the test `src/useFilters.test.ts`: defaults apply only when the URL has no filters
- [ ] T034 [P] [US3] Write the test `src/routes/settings/FamilySection.test.tsx`: add, edit, remove and reorder, child-only birth fields, and the limit of 20
- [ ] T035 [US3] Implement `src/domain/family.ts`
- [ ] T036 [US3] Add the `defaults` argument to `src/useFilters.ts`, and wire it in `App.tsx`
- [ ] T037 [US3] Add the family functions to `repo.ts` and the provider, and implement `FamilySection.tsx`

---

## Phase 6: US4, profile (P2)

- [ ] T038 [P] [US4] Write the test `ProfileSection.test.tsx`: name validation, choosing a home location through the existing gazetteer, and the "confirm from your new address" message when the email changes
- [ ] T039 [US4] Implement `ProfileSection.tsx` and `Settings.tsx` (section navigation and the signed-in guard)
- [ ] T040 [US4] Use the home location as the default when the URL has no `loc` parameter, in `useFilters` and `App`

---

## Phase 7: US5, theme (P3)

- [ ] T041 [P] [US5] Write the test `src/account/theme.test.ts`: how `system`, `light` and `dark` resolve, localStorage being saved, and storage that throws
- [ ] T042 [P] [US5] Add the end-to-end test "dark theme persists with no flash", checking that the computed `--bg` at `DOMContentLoaded` is the dark value
- [ ] T043 [US5] Implement `theme.ts`, add the inline pre-paint script to `index.html`, and add the `data-theme` token blocks to `styles.css`
- [ ] T044 [US5] Implement `AppearanceSection.tsx` and the theme switch in `AccountMenu`, saving to the profile when signed in

---

## Phase 8: US6, contact preferences (P3)

- [ ] T045 [P] [US6] Write the test `ContactSection.test.tsx`: everything off by default, the frequency only shown for the digest, and the changed time updating
- [ ] T046 [P] [US6] Write a Deno test for `supabase/functions/unsubscribe`: a valid signature turns the option off, a changed signature returns 400, and the POST one-click flow works
- [ ] T047 [US6] Implement `ContactSection.tsx` and the preference functions in `repo.ts`
- [ ] T048 [US6] Implement the `unsubscribe` Edge Function and a shared `signUnsubscribe()` helper, to be used by the future email feature

---

## Phase 9: US7, export and delete (P3)

- [ ] T049 [P] [US7] Write Deno tests for `export-data` (returns only the caller's data) and `delete-account` (wrong email gives 400, then 204, then the user is gone and the rows are removed)
- [ ] T050 [P] [US7] Write the test `DataSection.test.tsx`: the download triggers, and delete requires typing the email
- [ ] T051 [US7] Implement the `export-data` and `delete-account` Edge Functions, with shared `auth.ts` and `errors.ts`
- [ ] T052 [US7] Implement `DataSection.tsx`

---

## Phase 10: Polish

- [ ] T053 [P] Run axe accessibility checks in Playwright on `/sign-in`, `/saved` and `/settings`, at 320, 768, 1024 and 1440 px
- [ ] T054 [P] Add a "Local Supabase" section to the README, covering env vars and Mailpit
- [ ] T055 Go through quickstart.md end to end, and confirm the bundle size check, the coverage threshold of at least 85% for `src/domain` and `src/account`, and that all CI jobs are green

## Dependencies

- Phase 1 must finish before Phase 2, and Phase 2 before any user story.
- US1 blocks US2–US7. After US1, US2 through US7 can proceed in parallel; US3 and US4 both touch `useFilters`, so do those two one after the other.
- Within each story, write the tests and see them fail, then implement.
