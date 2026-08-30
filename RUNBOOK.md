# RUNBOOK — Neobee Hospital PLC Stakeholder Finance Portal

Next.js 16 (App Router) + TypeScript, Prisma 7, Supabase (Postgres / Auth / Storage), next-intl (`en` + `bn`), Tailwind CSS. Primary development shell is Git Bash on Windows.

Status as of 2026-08-29: `pnpm build`, `pnpm test` (111 unit tests), and `pnpm lint` (ESLint + 519 i18n keys matched + env parity) all pass. `3_leads` has been applied to the hosted Supabase database.

---

## 1. Prerequisites

- Node 26 or newer
- pnpm 10
- PostgreSQL 18, with `psql` on `PATH`

Docker and the Supabase CLI are **optional**. They are needed only for the full local Supabase stack (phone/OTP login, Storage) described in section 5 — not for the quick start in section 4 and not for any test command.

`scripts/ephemeral-pg.mjs` hardcodes two constants. Edit them if your PostgreSQL installation differs:

```js
const PG_BIN = 'C:\\Program Files\\PostgreSQL\\18\\bin';
const PORT = 54329;
```

## 2. Install

```bash
pnpm install
pnpm db:generate
```

`pnpm db:generate` is required before `dev` or `build`. `prisma/schema.prisma` sets `output = "../lib/generated/prisma"`, and `lib/generated` is gitignored, so the Prisma client is never committed and must be generated locally.

## 3. Environment

```bash
cp .env.example .env
```

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | The Postgres URL — paste your laptop's local Postgres (e.g. `postgresql://postgres:postgres@localhost:5432/postgres`), your Supabase project's direct connection string, or a Neon connection string. Used by the app, the seed script, and (unless `DIRECT_URL` is set) Prisma migrations |
| `DIRECT_URL` | Optional override — only needed when `DATABASE_URL` is a POOLED connection (Supabase Supavisor port 6543, or a Neon pooler URL), because Prisma Migrate requires a direct connection. When unset, migrations simply use `DATABASE_URL`; local Postgres never needs this |
| `NEOBEE_DB_PROVIDER` | Optional `supabase` or `generic`. When unset, the deploy runner infers from the host (see section 12) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL, browser-visible |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key, browser-visible |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key; never expose to the client |
| `SUPABASE_STORAGE_BUCKET` | Bucket name for NID scans and deposit slips |
| `SEED_ALLOW` | Commented out by default; only needed to force seeding when `NODE_ENV=production` |
| `DEMO_LOGIN` | Commented out by default; set to `'true'` to enable the demo login buttons outside development (demo users come from the seed script) |

Real values come from the Supabase dashboard under Project Settings → API.

One URL is enough in most setups: paste whatever Postgres string you have into `DATABASE_URL` and everything (app, seed, migrations) uses it. `DIRECT_URL` exists only as an override for POOLED connections — Supabase Supavisor port 6543 and Neon poolers cannot run Prisma Migrate; if that is what `DATABASE_URL` holds, put the direct (port 5432 / non-pooled) string in `DIRECT_URL` for migrations. A local Postgres has no pooler, so neither the distinction nor `DIRECT_URL` is ever needed there.

No `.env` file is needed for `pnpm test`, `pnpm lint`, `pnpm test:integration`, or the quick start in section 4. It **is** needed to run the app and to migrate a real database.

## 4. Quick start without Supabase

Verified working on Windows, 2026-08-22. This gives you a throwaway database with seeded data and the public pages running.

```bash
CONN="postgresql://postgres@127.0.0.1:54329/postgres"

node scripts/ephemeral-pg.mjs start
DATABASE_URL="$CONN" pnpm db:deploy
DATABASE_URL="$CONN" pnpm db:seed
DATABASE_URL="$CONN" pnpm exec next dev -p 3000
```

What each step does and what to expect:

1. `ephemeral-pg.mjs start` runs `initdb` into `.ephemeral-pg/` (gitignored) with trust auth and starts Postgres on `127.0.0.1:54329`. Expect `[ephemeral-pg] Postgres is ready`. Port 54329 must be free.
2. `pnpm db:deploy` sees a non-Supabase host and no `NEOBEE_DB_PROVIDER`, prints the auto-shim banner, applies `scripts/supabase-compat.sql` via `psql` (creates the `authenticated`, `anon`, and `service_role` roles, the `auth` schema with `auth.uid()`, and the table grants), runs both migrations, then re-applies the shim post-deploy so grants cover the new tables. Expect `All migrations have been successfully applied.` The auto-shim mode shells out to `psql`, so the PostgreSQL client tools must be on PATH (see section 1).
3. Expect `Seeded 6 settings, 2 staff, 5 investors, 5 investments, 5 transactions, and 5 audit logs.`

The public pages (`/`, `/en`, `/bn`, `/en/verify`, `/en/progress`) work against this database.

`/login`, `/portal`, and `/admin` return HTTP 500 with `Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL`. That is expected on this path — those routes need Supabase Auth — not a bug.

**Windows gotcha:** `pnpm dev -- -p 3000` does not work; pnpm forwards the `--` and Next.js reads it as a directory name. Use `pnpm exec next dev -p 3000`.

Teardown, which stops the server and **deletes the data directory** (all data is lost, by design):

```bash
node scripts/ephemeral-pg.mjs stop
```

## 5. Local Supabase stack (Docker required)

This section was **not executed** on the reference machine — no Docker was available. It is the documented Supabase procedure, not a verified transcript. Real-carrier SMS delivery is unverified.

This repo has no `supabase/` directory yet.

```bash
npx supabase init
npx supabase start
npx supabase status
```

Take the API URL, anon key, and service_role key from `supabase status` into `.env`, point `DATABASE_URL` at the local Postgres, then apply migrations:

```bash
pnpm db:deploy
```

For phone/OTP without real SMS: Supabase local development captures auth messages locally (Inbucket plus the auth logs) and supports pre-configured test phone numbers with fixed OTP codes declared in `supabase/config.toml`.

`TODO(architect):` confirm the exact local-OTP configuration keys and Studio navigation against the Supabase CLI version you adopt before relying on this section.

## 6. Migrations and seed

```bash
pnpm db:migrate                    # development: create and apply a new migration
pnpm db:deploy                     # path-aware runner: explicit provider or host inference (section 12)
pnpm db:studio                     # Prisma Studio — browse/edit data in the browser
pnpm exec prisma migrate deploy    # apply all migrations directly (raw escape hatch, plain deploy)
pnpm db:seed
```

Four migrations exist: `0_init` (schema plus the `investment_uid_seq` sequence), `1_rls` (Supabase RLS policies), `2_investment_requests` (investor request → staff approval workflow), and `3_leads` (public interest leads — `Lead` model, `NB-LEAD-XXXX` refs, `NEW → CONTACTED` staff pipeline; also enables RLS on `Lead` with a staff SELECT policy).

The `db:deploy` runner loads `.env` and `.env.local` itself before resolving the provider (`.env.local` takes precedence; variables already exported in the shell win over both files), so it works even though plain `node` does not read `.env`.

`pnpm db:deploy` resolves its mode in this order:

1. **Explicit `supabase`** (`NEOBEE_DB_PROVIDER=supabase` or `--provider=supabase`) — pre-flight checks via `pg` that `auth.uid()` exists; if it does not, the run fails with a friendly message (the database does not look like Supabase-hosted Postgres). Otherwise plain `prisma migrate deploy` — all migrations including `1_rls`.
2. **Inferred auto-shim** (no provider set, non-Supabase host) — applies `scripts/supabase-compat.sql` via `psql` (shells out to `psql`, so the PostgreSQL client tools must be on PATH for any non-Supabase host), deploys all migrations, re-applies the shim post-deploy so grants cover newly created tables. RLS stays active.
3. **Explicit `generic`** — marks `1_rls` as applied without executing it (because `auth.uid()` does not exist there) and deploys the rest; idempotent — the runner queries the database first and skips the marking step when `1_rls` is already recorded. The warning box notes that the provider was set explicitly.

An unrecognised value (`--provider=banana`) exits 1 listing accepted values; `supabase-with-shim` is deliberately NOT an explicit value — it only happens by inference. Connection strings are never printed.

Seed data is deliberately fake (`+88017…` phone numbers, `TEST-NID-000X` identifiers). The seed script refuses to run when `NODE_ENV=production` unless `SEED_ALLOW=true`; both behaviours were verified.

## 7. Staff role assignment (manual in v1)

Staff authorization is a row in `"Staff"` whose `authUserId` equals the Supabase auth user's UUID, with `isActive` true and `role` set to `STAFF` or `ADMIN`. This is enforced by `requireStaff` and `requireAdmin` in `lib/auth.ts`.

```bash
psql "$CONN" -c "INSERT INTO \"Staff\" (\"id\",\"authUserId\",\"name\",\"email\",\"role\",\"isActive\") VALUES (gen_random_uuid(),'<SUPABASE_AUTH_USER_UUID>','Full Name','person@example.com','ADMIN',true);"
```

On a hosted project, run the same SQL in the Supabase dashboard SQL editor.

The seed creates two staff rows with placeholder `authUserId` values (`seed-admin-authuser-0001`, `seed-staff-authuser-0001`) that match no real auth user. Update one of those rows' `authUserId` to a real UUID to sign in as staff.

## 8. Investor login and linking — known gap

Investor authorization is `Investor.authUserId` matching the Supabase auth user, enforced by `requireInvestor` in `lib/auth.ts`.

**Verified gap:** `lib/link-investor.ts` exports `linkInvestorToAuthUser`, which updates `Investor.authUserId` and writes an `investor.link` audit row — but it has zero call sites. No route or server action invokes it. As a result, a real investor's auth user is never linked to their Investor row after OTP sign-in, so `/portal` and the confirm action are unreachable for real users. Seeded investors have `authUserId = null`.

Manual workaround for local testing:

```bash
psql "$CONN" -c "UPDATE \"Investor\" SET \"authUserId\"='<UUID>' WHERE phone='+8801700000001';"
```

`TODO(architect):` wire `linkInvestorToAuthUser` into the post-OTP login flow. This is required before investor self-confirmation works end to end.

## 9. Tests and checks

```bash
pnpm test              # 111 unit tests, no database required
pnpm test:integration  # 9 route and RLS tests against a throwaway Postgres
pnpm lint              # ESLint plus the i18n and env-parity checks
pnpm check:i18n        # key parity between messages/en.json and messages/bn.json
pnpm check:env         # parity between .env.example declarations and process.env reads in code
```

`pnpm test:integration` starts its own ephemeral Postgres, applies the compat shim and both migrations, runs the tests, and always tears the cluster down afterwards. It needs the PostgreSQL 18 binaries and a free port 54329; it does not need Docker.

`pnpm check:i18n` exits non-zero on drift between the two catalogs.

`pnpm check:env` exits non-zero on env drift: a variable read in code but missing from `.env.example`, a variable commented out there while still read (unless it is on the script's `OPTIONAL_VARS` allowlist, currently just `SEED_ALLOW`), or a declared variable read nowhere.

## 10. Build and run

```bash
pnpm build
pnpm start
```

next-intl fails the build on a message key referenced by a statically rendered page. A key missing from **both** catalogs on a dynamic page does not fail the build — it surfaces at runtime as `MISSING_MESSAGE` and renders the raw key on screen. The parity check catches `en`/`bn` drift, not keys absent from both files. Add a component's strings to both catalogs in the same change.

## 11. Known limitations (reference machine, 2026-08-22)

- `lib/storage.ts` compiles but was never exercised against a real bucket. Nothing in `app/` or `components/` imports it — there is no upload endpoint for NID scans or deposit slips yet.
- ~~Nothing calls `updateSetting` from `lib/settings.ts`, so the admin-editable share price has no interface.~~ Resolved: `/admin/settings` (SettingsForm + server action) edits the runtime `Setting` rows.
- Investor auth-linking gap; see section 8.
- Phone/OTP was never executed (no Docker). Real SMS delivery is unverified.
- RLS cross-tenant denial was verified, but on vanilla Postgres via `scripts/supabase-compat.sql`, which mirrors rather than exactly reproduces hosted Supabase. Re-verify against the hosted project before launch. See section 12 for which RLS path is active and why.
- Bangla copy is machine-drafted and still needs native-speaker review; see `FRONTEND.md`.

## 12. Row-Level Security: which path is active

The `1_rls` migration depends on Supabase's `auth.uid()`, so every deployment runs one of three modes, resolved by `NEOBEE_DB_PROVIDER` when set explicitly and by the host in the connection URL when not:

- **Explicit `supabase`** — for a Supabase-hosted database. A pre-flight check verifies `auth.uid()` actually exists (guarding against pointing `supabase` at a non-Supabase database), then `1_rls` applies and RLS is live as defense-in-depth behind the API layer.
- **Inferred auto-shim** — no provider set, host is not Supabase (local Postgres, Neon, anything else). The runner applies `scripts/supabase-compat.sql` (which synthesises `auth.uid()` and the Supabase roles), deploys all migrations including `1_rls`, and re-applies the shim post-deploy. RLS is active here too.
- **Explicit `generic`** — `auth.uid()` does not exist, `1_rls` is marked applied but its SQL never runs, and the API layer is the ONLY access-control enforcement. This is a real reduction from the designed posture; treat it as a temporary state.

The inferred default keeps RLS on: any non-Supabase host gets the compat shim, so running WITHOUT RLS requires setting `NEOBEE_DB_PROVIDER=generic` — still an explicit, deliberate choice that cannot happen by omission.

TODO(architect): record here which path this deployment actually uses once the connection string is chosen — the value in .env is the source of truth.

RLS test coverage exists regardless of that choice: `pnpm test:integration` always exercises Path A semantics by applying `scripts/supabase-compat.sql` (which synthesises `auth.uid()`) to a throwaway database before running both migrations.
