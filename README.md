# Family Day Planner

Unified discovery of family days out: search, filter (age, distance, dogs, type, cost), map and list views. Spec: `specs/001-family-day-planner/spec.md`.

Optional accounts (spec `specs/005-user-settings/spec.md`) add sign-in by email code, saved trips, family members, a home location, theme and email preferences, and data download and deletion. Browsing never needs an account.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # vitest
npm run build
```

## Local Supabase

Accounts use [Supabase](https://supabase.com) (see `docs/adr/0001-supabase-for-accounts.md`). Without the settings below the app runs anonymously, exactly as before, and never loads the Supabase client.

You need Docker Desktop running. The Supabase CLI and Deno are installed by `npm install`.

```bash
npx supabase start             # Postgres, Auth, Edge Functions, Studio and Mailpit
npx supabase status -o env     # prints API_URL and PUBLISHABLE_KEY
cp .env.example .env           # then fill in the two values below
npm run dev
```

| Variable                        | Value                                    |
| ------------------------------- | ---------------------------------------- |
| `VITE_SUPABASE_URL`             | `API_URL`, e.g. `http://127.0.0.1:54321` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `PUBLISHABLE_KEY` from `supabase status` |

Both are public and are baked into the bundle at build time.

- **Emails:** the local stack doesn't send real email. Sign-in codes and links, email change confirmations and notices all land in **Mailpit** at http://127.0.0.1:54324.
- **Database:** browse it in Studio at http://127.0.0.1:54323. The schema is in `supabase/migrations/`; after changing it, run `npm run db:types` to regenerate `src/account/database.types.ts`.
- **Edge Functions** (`supabase/functions/`): `unsubscribe`, `export-data` and `delete-account` are served by the local stack automatically. The unsubscribe signing key for local use is in `supabase/config.toml`.

### Tests

```bash
npm run check             # lint, format, type check, unit tests
npm run test:coverage     # fails below 85% for src/domain and src/account
npm run db:test           # row-level security and constraints (pgTAP)
npm run functions:check   # Edge Functions: Deno lint, type check, tests
npm run e2e               # Playwright against the local stack, incl. axe accessibility checks
```

### Before production

- Set up a custom SMTP provider in the Supabase project (Supabase's default sender only reaches the project team; see `specs/005-user-settings/research.md` R2).
- Set the Site URL and redirect URLs to the app's address, and use the email templates in `supabase/templates/`.
- Deploy the functions and set the signing key: `npx supabase functions deploy` and `npx supabase secrets set UNSUBSCRIBE_SIGNING_KEY=$(openssl rand -hex 32)`.

## Docker Desktop

```bash
docker compose up -d --build   # http://localhost:8080
```

`compose.yaml` passes `VITE_SUPABASE_*` from `.env` as build arguments; without them the image builds with accounts switched off.

## Data sources

`src/data/sources.ts` defines the `ActivitySource` interface; `aggregate()` merges sources and tolerates failures. Only a bundled **sample** source exists (`sampleSource.ts`) until real APIs are chosen in the research phase. Location search uses a small offline gazetteer (`places.ts`); postcodes need a geocoder.
