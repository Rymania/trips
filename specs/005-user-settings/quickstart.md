# Quickstart: User Settings (005)

How to run and check this feature locally once it's implemented.

## Prerequisites

- Docker Desktop running
- The Supabase CLI. It's installed as a dev dependency, so use `npx supabase …`.

## 1. Start the local Supabase stack

```bash
npx supabase start          # Postgres, Auth, Edge Functions, Mailpit
npx supabase status -o env  # prints API_URL and PUBLISHABLE_KEY
```

Copy `.env.example` to `.env` and set:

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key from `supabase status`>
```

## 2. Run the app

```bash
npm run dev                 # http://localhost:5173
```

Emails sent by the local stack, including sign-in links and codes, appear in Mailpit at http://127.0.0.1:54324.

## 3. Check each story by hand

1. **Sign in (US1)**: choose "Sign in", enter any email, then open Mailpit and follow the link or enter the code. The header now shows the account menu.
2. **Saved trips (US2)**: save two activities, open the Saved trips page, set a planned date on one, then sign in from a private window and see the same list.
3. **Family (US3)**: go to Settings, then Family, and add an adult, a child born 2019 and a dog. Open `/` with no query string and see the matching age group, family size 2 and dog-friendly selected.
4. **Profile (US4)**: set a display name and home location. Distances on `/` are now measured from home.
5. **Theme (US5)**: choose Dark, reload, and the page loads dark with no flash.
6. **Contact preferences (US6)**: turn on the digest and choose monthly, then reload. The choice is kept. The unsubscribe link in emails is signed with `UNSUBSCRIBE_SIGNING_KEY`: the local stack sets a development key in `supabase/config.toml`, and production needs `npx supabase secrets set UNSUBSCRIBE_SIGNING_KEY=$(openssl rand -hex 32)`.
7. **Your data (US7)**: download the data and check the JSON, then delete the account. Signing in again creates a new, empty account.

## 4. Automated checks

```bash
npm run check               # lint, format, typecheck, unit tests
npx supabase test db        # RLS and constraint tests (pgTAP)
npm run functions:check     # Edge Functions: Deno lint, type check and tests
npm run e2e                 # Playwright against the local stack
```

## Docker

```bash
docker compose up -d --build   # reads VITE_SUPABASE_* from .env as build args
```

If `VITE_SUPABASE_*` isn't set, the image still builds and the app runs anonymously.
