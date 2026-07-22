# Neobee Hospital PLC Stakeholder Portal

A public stakeholder portal for Neobee Hospital PLC. It shows live fundraising progress on the landing page, allows passwordless email-OTP sign-up and login for stakeholders, and provides a stakeholder dashboard with a digital receipt, PDF download, and QR code. Admins can manage investments through a separate dashboard, and a public verification page lets anyone confirm a shareholding with a unique ID or verification code.

## Tech stack

- **Framework**: Next.js 16.2.10 (App Router) + TypeScript + React 19.2.4
- **Styling**: Tailwind CSS v4 (`tailwindcss@^4`, `@tailwindcss/postcss@^4`)
- **Database ORM**: Prisma 6.19.3 (`prisma`, `@prisma/client`)
- **Database**: PostgreSQL via Supabase
- **Auth**: Supabase Auth email-OTP (`@supabase/ssr@^0.12.3`, `@supabase/supabase-js@^2.110.7`)
- **Utilities**: `qrcode@^1.5.4` for receipt QR codes, `pdf-lib@^1.17.1` for PDF generation
- **Deploy target**: Vercel

> **Why Prisma 6?** Prisma is pinned to v6.19.3 because the schema uses `url = env("DATABASE_URL")`. Newer Prisma versions (v7+) no longer allow `env(...)` in the `datasource` block, so the project intentionally stays on v6 until a migration path is adopted.

## Feature/route map

| Route | Access | What it does |
|-------|--------|--------------|
| `/` | Public | Landing page with live raise progress toward the project target. |
| `/signup` | Public | Stakeholder sign-up form (name, email, phone, NID, number of shares). Issues a `NEO-####` unique ID and `NB-XXXXXX` verification code and sends an email OTP. |
| `/signup/success` | Public | Shows the newly issued IDs after successful sign-up. |
| `/login` | Public | Passwordless login form that sends an email OTP. |
| `/login/verify` | Public | OTP entry page; verifies the code with Supabase and links the domain `Stakeholder` row to the Supabase auth user. |
| `/auth/callback` | Public | Supabase auth callback route handler. |
| `/dashboard` | Authenticated stakeholder | Lists the current stakeholder’s investments and shows share/amount/category/status. |
| `/dashboard/receipt/[uniqueId]` | Authenticated stakeholder | Digital receipt for one of the stakeholder’s own investments (amount in words, QR code, verification code, branding footer). |
| `/dashboard/receipt/[uniqueId]/pdf` | Authenticated stakeholder | Generates a branded PDF with the same receipt data. |
| `/admin` | Admin only | Aggregate stats, stakeholder table, search/filter. |
| `/admin/add` | Admin only | Manual form to add a stakeholder/investment. |
| `/admin/[investmentId]` | Admin only | Edit a stakeholder/investment; changing shares recomputes amount and category. |
| `/verify` | Public | Public lookup by `NB-XXXXXX` or `NEO-####` (or raw QR string). Returns only name, category, shares, amount, and status. |

Route protection is handled by `src/proxy.ts` (the Next.js 16 proxy replacement for middleware). It guards `/dashboard` and `/admin` prefixes, refreshes the Supabase session cookie, and redirects anonymous users to `/login`. Fine-grained role checks (stakeholder vs. admin) live in `src/lib/auth.ts`.

## Business rules reference

All business logic constants live in `src/lib/business.ts`:

- **Share price**: ৳2,00,000 per share (`SHARE_PRICE = 200_000`)
- **Share categories**:
  - 1 share = Shareholder
  - 5 shares = Premium
  - 10 shares = Director
- **Project target**: ৳300 crore / 15,000 shares (`PROJECT_TARGET = 3_000_000_000`, `TOTAL_SHARES = 15_000`)
- **Founding entrepreneur phase**:
  - 50 slots (`ENTREPRENEUR_SLOTS = 50`)
  - ৳20,00,000 entry per entrepreneur (`FOUNDING_ENTRY = 2_000_000`)
  - ৳10 crore sub-target (`FOUNDING_SUBTARGET = 100_000_000`)
  - ৳20,000 per share incentive for founding entrepreneurs (`INCENTIVE_PER_SHARE = 20_000`)
- **ID formats**:
  - Unique investment ID: `NEO-####` (e.g., `NEO-0042`)
  - Verification code: `NB-XXXXXX` (6 alphanumeric characters, e.g., `NB-A3B9C2`)

## Getting started (local development)

1. **Prerequisites**: Node.js 20 or later.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the environment template and fill in real values:
   ```bash
   cp .env.example .env
   ```
   See the [What you must provide](#what-you-must-provide) section below for each value.
4. Create the database tables:
   ```bash
   npx prisma migrate dev
   # or, during early prototyping:
   npx prisma db push
   ```
5. Generate the Prisma client:
   ```bash
   npx prisma generate
   ```
6. Start the dev server:
   ```bash
   npm run dev
   ```

Available scripts:

- `npm run dev` — start the Next.js dev server
- `npm run build` — production build
- `npm run start` — production server
- `npm run lint` — run ESLint

## What you must provide

The following values must come from a real Supabase project. They cannot be placeholders if you want auth and database access to work.

| Env var | What it is | Where to find it in Supabase |
|---------|------------|------------------------------|
| `DATABASE_URL` | PostgreSQL connection string (pooler/transaction or direct, depending on environment) | Project Settings → Database → Connection string |
| `DIRECT_URL` | Direct PostgreSQL connection string (used for migrations) | Project Settings → Database → Connection string → URI mode |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key | Project Settings → API → Project API keys → `anon` `public` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-only, never expose to the browser) | Project Settings → API → Project API keys → `service_role` `secret` |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL (`http://localhost:3000` locally, production domain in prod) | Set by you; must match Supabase Auth redirect URLs |

## Security notes

- **Stakeholder data scoping** is enforced at the DB/Prisma layer in `src/lib/scoped-db.ts`. A stakeholder can only read or write their own records; every query hard-codes `stakeholderId: me.id`. Even guessing another stakeholder’s `NEO-####` ID returns a 404.
- **Admin writes are audited**. Every admin mutation creates an `AuditLog` row with the admin’s ID as the actor.
- **Stakeholder self-confirmation** also writes an audit row with actor `"self"` when the stakeholder clicks “confirm my details”.
- **Public verification** (`/verify`) exposes only name, category, shares, amount, incentive, status, and confirmation date. It never returns phone, email, NID, payment reference, deposit method, or notes.
- **No passwords are stored**. Authentication is passwordless email-OTP through Supabase Auth.

## Project structure notes

- `src/proxy.ts` — Next.js 16 proxy/middleware entry point; guards `/dashboard/*` and `/admin/*`.
- `src/lib/auth.ts` — server-side auth helpers (`requireStakeholder`, `requireAdmin`, `signOut`).
- `src/lib/scoped-db.ts` — the enforced data-scoping boundary for stakeholders.
- `src/lib/business.ts` — business constants and category/amount/incentive helpers.
- `prisma/schema.prisma` — `Stakeholder`, `Investment`, `Admin`, `AuditLog` models and enums.
