# Research: User Settings (005)

Decisions made while planning, and why. The choice of Supabase itself is in [ADR 0001](../../docs/adr/0001-supabase-for-accounts.md).

## R1. Sign-in method

- **Decision**: email one-time sign-in using `signInWithOtp({ email })`. The email template includes both the link (`{{ .ConfirmationURL }}`) and the 6-digit code (`{{ .Token }}`), so users can sign in on a different device from the one that receives the email. Codes are checked with `verifyOtp({ email, token, type: 'email' })`.
- **Why**: there are no passwords to store, reset or leak. It also suits a family app that people visit occasionally.
- **Alternatives**: email and password (adds password reset and breach risk) and social login (deferred; Supabase supports it later on the same accounts).

## R2. Email delivery

- **Decision**: during development, use the local Supabase stack's built-in mail catcher, Mailpit (`http://127.0.0.1:54324`). End-to-end tests read the code from it. Production must use a **custom SMTP provider**, chosen before launch, with SPF, DKIM and DMARC set up on the sending domain.
- **Why**: Supabase's default email service only delivers to project team members and is heavily rate-limited, so it can't be used in production.
- **Open**: which provider. Resend, Postmark and Amazon SES all work. Issue #8's "send email" will use the same provider (see spec 006).

## R3. Keeping the bundle within budget

- **Decision**: load `@supabase/supabase-js` with a dynamic `import()` after the first render. The header knows straight away whether a stored session exists by checking for the `sb-<project-ref>-auth-token` key in localStorage, so it can show an account placeholder rather than "Sign in" while the library loads. Saved trips, settings and sign-in are separate lazy-loaded routes.
- **Why**: the main bundle is about 79 KB gzipped today, against a 150 KB budget. The client adds about 30 to 40 KB gzipped, and it isn't needed for anonymous browsing.

## R4. Routing

- **Decision**: a small `useRoute()` hook built on the History API, with the routes `/`, `/saved`, `/settings`, `/sign-in` and `/auth/callback`. Each route except the search page is loaded with `React.lazy`. nginx already sends unknown paths to `index.html` (`try_files $uri /index.html`).
- **Why**: there are only five routes and no nesting, so a routing library isn't justified under the constitution's dependency rule.
- **Alternative**: React Router. We'll revisit it if the admin routes in spec 006 make this hook complex.

## R5. Applying the theme before first paint

- **Decision**: a small inline script in `index.html` reads `localStorage['trips.theme']` and sets `data-theme` on `<html>` before any CSS paints. For a signed-in user, the account's theme is written to that key whenever the profile loads, so the next page load is correct with no network wait. The CSS tokens get explicit `:root[data-theme='dark']` and `:root[data-theme='light']` blocks, and the `prefers-color-scheme` block is limited to `:root:not([data-theme='light'])`.
- **Why**: it meets SC-004 (no flash of the wrong theme). If a Content Security Policy is added later, the script needs its hash listed in `script-src`.

## R6. Ages without storing birth dates

- **Decision**: store only a child's birth month and year. Age is counted in whole years as of the first day of the birth month, so a child is treated as having their birthday at the start of that month. A pure function, `ageGroupsForFamily(members, today)`, in `src/domain/family.ts` maps ages to the existing `AGE_GROUPS`.
- **Why**: it keeps as little personal data about children as possible (UK GDPR) while still deriving age groups correctly. At worst a child moves into a new group up to a month early.

## R7. Unsubscribe without signing in

- **Decision**: an Edge Function `unsubscribe` that takes `?u=<profile_id>&t=<topic>&s=<signature>`. The signature is an HMAC-SHA256 of `profile_id:topic`, made with a function secret (`UNSUBSCRIBE_SIGNING_KEY`). A valid request sets `opted_in = false` and returns a confirmation page. Emails will include a `List-Unsubscribe` header pointing at it.
- **Why**: one-click unsubscribe is expected by email providers and required for marketing email (UK PECR). The signature stops anyone else from changing a user's preferences.

## R8. Deleting an account

- **Decision**: an Edge Function `delete-account` checks the caller's access token, then calls `auth.admin.deleteUser(uid)`. All user tables reference `auth.users(id)` with `on delete cascade`, so this deletes everything in one step.
- **Why**: deleting a user from Auth needs the service-role key, which must never be in the browser.

## R9. Testing approach (constitution I)

- **Database and RLS**: pgTAP tests in `supabase/tests/`, run with `supabase test db`. They cover the policies for each table, including that one user can't read or change another user's rows.
- **Unit**: Vitest for the domain logic (family to filters, merging saved trips, theme resolution) and for components, with a fake account client.
- **End-to-end**: Playwright (new dev dependency) against `vite preview` and a local Supabase stack. It signs in by reading the code from Mailpit.
- **CI**: a new `supabase` job uses `supabase/setup-cli` and `supabase start`, then runs the database tests and the end-to-end tests. The existing jobs are unchanged.
