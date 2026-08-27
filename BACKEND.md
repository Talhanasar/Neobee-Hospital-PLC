# BACKEND.md — Neobee Hospital PLC Stakeholder Finance Portal

This backend enables investors to deposit money against shares, issuing each a unique ID and verification code. Investors self-confirm their deposits later, while staff register deposits and monitor the fundraising progress.

## Stack

| Package | Version |
|---------|---------|
| Next.js | 16.3.1 |
| React | 19.2.8 |
| Prisma | ^7.9.1 |
| @prisma/adapter-pg | ^7.9.1 |
| @supabase/supabase-js | ^2.112.3 |
| @supabase/ssr | ^0.12.4 |
| Zod | ^4.4.3 |
| PDFKit | ^0.19.1 |
| qrcode | ^1.5.4 |
| Vitest | ^4.1.11 |
| TypeScript | ^5 |

**Package manager:** pnpm@10.13.1

### Version gotchas

- **Next.js 16**: `cookies()`, `headers()`, and route `params` became async. Access `params` as `Promise<{ id: string }>` and await it.
- **Prisma 7**: Uses `prisma-client` generator (not `prisma-client-js`). Requires explicit `output` path; datasource connection moved to `prisma.config.ts`. No longer auto-loads `.env`. Seed command is at `migrations.seed`.
- **Zod 4**: Replaced `{ message: ... }` with `{ error: ... }`. Prefers `z.email()` over `z.string().email()`. Replaced `.flatten()`/`.format()` with `z.treeifyError()`.

## Routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/investments` | Staff | Register a deposit (create investment) |
| GET | `/api/investments` | Staff | Paginated shareholder register |
| GET | `/api/investments/summary` | Public | Aggregate progress numbers only |
| GET | `/api/investments/verify` | Public | Lookup investment by code or uid |
| POST | `/api/investments/[id]/confirm` | Investor | Self-confirmation of investment |
| GET | `/api/investments/[id]/receipt` | Investor or staff | Generate receipt PDF |

### POST /api/investments

**Request body** (`registerInvestmentSchema`):
- `name` (string, ≤200) – investor name
- `phone` (string, Bangladeshi number) – phone is normalized to `+8801...`
- `email` (string, optional) – validated with `z.email()`
- `nationalIdNumber` (string, ≤50, optional)
- `shares` (integer) – must satisfy `MIN_SHARES` (1) to `MAX_SHARES` (100) and, if `isEntrepreneur` is true, `ENTREPRENEUR_MIN_SHARES` (10)
- `isEntrepreneur` (boolean, default false)
- `depositMethod` (enum: `BANK_DEPOSIT`, `BANK_TRANSFER`, `CHEQUE`, `MOBILE_BANKING`)
- `depositRef` (string, ≤100, optional)
- `depositDate` (ISO date, cannot be more than 1 day in the future)
- `notes` (string, ≤2000, optional)

**Response (201):**
```json
{
  "uid": "NEO-1234",
  "code": "NB-ABC123",
  "category": "SHAREHOLDER",
  "shares": 10,
 
  "amount": 2000000,
  "incentiveAmount": 200000,
  "status": "PENDING",
  "depositDate": "2025-01-01T10:00:00.000Z"
}
```

**Status codes:** 201 (created), 400 (validation), 401/403 (auth errors)

### GET /api/investments

**Query** (`listInvestmentsSchema`):
- `page` (integer, default 1, ≥1)
- `pageSize` (integer, default 25, 1–100)
- `status` (enum: `PENDING`, `CONFIRMED`, optional)
- `category` (enum: `SHAREHOLDER`, `PREMIUM`, `DIRECTOR`, optional)
- `search` (string, ≤200, optional) – searches investment `uid`, `code`, and `investor.name`

**Response:**
```json
{
  "items": [
    {
      "uid": "NEO-1234",
      "code": "NB-ABC123",
      "category": "SHAREHOLDER",
      "shares": 10,
      "amount": 2000000,
      "incentiveAmount": 200000,
      "status": "PENDING",
      "depositDate": "2025-01-01T10:00:00.000Z",
      "investor": { "name": "John Doe", "phone": "+8801700000001" }
    }
  ],
  "page": 1,
  "pageSize": 25,
  "total": 42,
  "totalPages": 2
}
```

**Status codes:** 200 (success), 401/403 (auth errors)

### GET /api/investments/summary

**Response:**
```json
{
  "totalRaised": 5000000,
  "percentageOfTarget": 33.33,
  "sharesSubscribed": 250,
  "foundingPhaseProgress": 60.0,
  "entrepreneurSlotsFilled": 5
}
```

**Status codes:** 200 (success)

### GET /api/investments/verify

**Query** (`verifyQuerySchema`):
- Exactly one of `code` (regex: `^NB-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$`) or `uid` (regex: `^NEO-\d{4,}$`) must be provided.

**Rate limits** (enforced via audit log counters, window 5 minutes):
- Per-IP: 20 lookups per 5 minutes
- Global: 250 lookups per 5 minutes

**Response (200):**
```json
{
  "uid": "NEO-1234",
  "code": "NB-ABC123",
  "investorName": "John Doe",
  "shares": 10,
  "amount": 2000000,
  "category": "SHAREHOLDER",
  "status": "PENDING",
  "depositDate": "2025-01-01T10:00:00.000Z"
}
```

**Fields returned:** `uid`, `code`, `investorName`, `shares`, `amount`, `category`, `status`, `depositDate`

**Fields never returned:** phone, email, nationalIdNumber, file keys (`nationalIdFileKey`, `depositSlipFileKey`), internal IDs, notes, internal metadata

**Status codes:** 200 (found), 404 (not found), 400 (invalid query), 429 (rate-limited)

### POST /api/investments/[id]/confirm

**Path:** `id` (investment internal ID)

**Response (200):**
```json
{"status": "CONFIRMED"}
```

**Status codes:** 200 (confirmed), 400/401/403/404 (errors)

### GET /api/investments/[id]/receipt

**Auth:** Owning investor OR active staff

**Response:** PDF file with filename `"{uid}-receipt.pdf"`

**PDF includes:** uid, code, investor name, phone, optional NID, category, shares, share price, incentive (if entrepreneur), deposit method, reference, deposit date, verification code, status, amount, amount in words, QR code containing all key data

**Status codes:** 200 (PDF), 403 (forbidden), 404 (not found)

## Data model

Seven tables with relationships:

- `Staff` (1:N `Investment`, `Transaction`, `Setting`)
- `Investor` (1:N `Investment`)
- `Investment` (1:N `Transaction`, `InstallmentSchedule`)
- `Transaction` (belongs to `Investment`, optional `InstallmentSchedule`)
- `InstallmentSchedule` (belongs to `Investment`)
- `AuditLog` (tracks all state-changing operations)
- `Setting` (key/value store for admin-editable runtime values)

### Non-obvious decisions

1. **Price snapshot.** `Investment.sharePrice` and `incentivePerShare` are stored as snapshot columns because the share price is admin-editable at runtime. Historical amounts derive from the snapshot on the row — recomputing a past investment against today's price would rewrite financial history.

2. **Derived amount cache.** `Investment.amount` is a server-computed cache of the ledger rows (sum of DEPOSIT, REFUND, CORRECTION, excludes DISTRIBUTION). It is recomputed inside the same transaction that writes a ledger row.

3. **`Setting.value` is `BigInt`.** Postgres `INTEGER` caps at 2,147,483,647 and `TARGET_AMOUNT` is 3,000,000,000. Per-row money amounts stay `Int` (max 100 × 200,000 = 20,000,000). `lib/settings.ts` is the single conversion boundary and validates with `Number.isSafeInteger`.

**Investor.authUserId** is nullable because staff register deposits for walk-ins. A staff-registered walk-in investor has no account at registration time (`lib/investments.ts:62` writes `null`), and there is no flow that populates `authUserId` — the linking step is **not yet implemented**. Consequently an investor created this way cannot currently authenticate to view their own record; `lib/auth.ts` only matches an `authUserId` that is already set.

**Investor.authUserId** and **Staff.authUserId** are plain strings with NO cross-schema foreign key to Supabase `auth.users` because that schema is not portable across the planned migration to self-hosted Postgres.

## Money math

All money is integer BDT (whole taka). `lib/money.ts` is the only place money math lives — pure, dependency-free apart from `node:crypto`, imported by every route and the seed.

### Exported functions

| Function | Description |
|----------|-------------|
| `calculateAmount(shares, sharePrice)` | `shares * sharePrice` |
| `calculateIncentive(shares, isEntrepreneur, incentivePerShare)` | Incentive only if entrepreneur, else 0 |
| `assertEntrepreneurEligible(shares, isEntrepreneur)` | Throws if entrepreneur flag set and shares < 10 |
| `deriveCategory(shares)` | Maps shares to `SHAREHOLDER`, `PREMIUM`, or `DIRECTOR` |
| `formatUid(sequence)` | Creates `NEO-` + zero-padded sequence |
| `generateVerificationCode()` | 6-character code from alphabet excluding `I, O, 0, 1` |
| `amountInWords(amount)` | Converts BDT amount to words (crore/lakh/thousand) |
| `formatBdt(amount)` | Localizes BDT integer with commas |

UID comes from Postgres sequence `nextval('investment_uid_seq')`. Verification code uses a unique constraint with retry-on-conflict (5 attempts) because read-then-check races under concurrency. Alphabet excludes `I, O, 0, 1` for manual typing.

## Authorization

`lib/auth.ts`:
- `requireStaff()` – throws `AuthError` (401/403) if not active staff
- `requireAdmin()` – throws `AuthError` (403) if staff.role !== `ADMIN`
- `requireInvestor()` – throws `AuthError` (403) if investor not found
- `assertOwnsInvestment(investorId, investmentId)` – throws `AuthError` (403) if mismatch

**Key principle:** Application-layer authorization must be independently correct because RLS will not exist after migration to self-hosted Postgres. RLS is a secondary lock, never the only one.

**Note:** `getUser()` is used rather than `getSession()` because Supabase documents `getSession()` as untrustworthy server-side.

## Audit logging

State-changing route handlers write an `AuditLog` row inside the same transaction as the change, so rolled-back mutations cannot leave phantom logs and committed ones cannot go unlogged. One exception: `updateSetting` in `lib/settings.ts` does not write its own audit row — the calling route must compose that write, and a settings change made without it will be unaudited.

### Action verbs from `lib/audit.ts`
- `investmentRegister` – staff creates investment
- `investmentConfirm` – investor self-confirms
- `investmentVerifyLookup` – public verify lookup (rate-limited)
- `settingUpdate` – admin changes a setting (composed with writeAuditLog)
- `fileUpload` – staff uploads NID or deposit slip
- `fileDelete` – staff deletes a file

**metadata** never contains PII, secrets, full request bodies, or NID numbers.

## Storage

`lib/storage.ts` wraps Supabase Storage behind three methods:

- `uploadFile(key, body, contentType)` – server-only, uses service-role key
- `getSignedUrl(key, expiresInSeconds)` – minted on demand, never stored
- `deleteFile(key)` – server-only

Object keys are persisted; signed URLs are temporary. Interface is uniform for planned MinIO migration (one-file change).

## Receipt PDF

`lib/receipt.ts` renders the receipt server-side with PDFKit. Rationale:

- The `pdf` skill referenced in `AGENTS.md` §9 is Python/LaTeX-based and cannot run inside a Next.js route handler.
- A Chromium renderer would cost ~45MB against Vercel's 250MB limit plus 2–5s cold starts.
- PDFKit is ~400KB with no browser binary.

**Known limitation:** Built-in PDF fonts cannot render Bengali glyphs; receipts are English-only until a Unicode TTF is embedded.

## Row-Level Security

Refer to `prisma/migrations/1_rls/migration.sql`.

**Summary:**

- Investors select only their own rows (via `authUserId` on `Investor`).
- Staff select broadly and can insert into `Investment` and `Transaction` (via explicit `EXISTS` lookup against `Staff`, not JWT claim).
- **No DELETE policy** on `Investment` or `Transaction` – denied by default.
- **No UPDATE policy** on `Transaction` – corrections are new rows.
- Service-role key bypasses RLS entirely.

## Local setup

1. Install with `pnpm install`.
2. Copy `.env.example` to `.env` and fill it in (developer must do this; no agent or tooling will create/read a real `.env`).
3. Run `pnpm db:migrate` (Prisma CLI migrations; uses `DIRECT_URL`).
4. Run `pnpm db:generate` (emits the `prisma-client` generator output into `lib/generated/prisma`). This is separate from `@prisma/adapter-pg`, the runtime driver adapter wired up in `lib/db.ts` — `prisma generate` does not produce it.
5. Run `pnpm db:seed` to load fake development data. It runs normally in development; it refuses to run when `NODE_ENV=production` unless `SEED_ALLOW=true` is explicitly set.
6. Run `pnpm dev` (starts Next.js dev server).
7. Run `pnpm test` (runs Vitest suite).

### Environment variable names from `.env.example`

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Pooled Supavisor connection for the app (pgbouncer) |
| `DIRECT_URL` | Direct/unpooled connection for Prisma CLI |
| `NEXT_PUBLIC_SUPABASE_URL` | Public Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key for browser client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only service role key |
| `SUPABASE_STORAGE_BUCKET` | Storage bucket name |

Seed refuses to run when `NODE_ENV=production` **unless** `SEED_ALLOW=true` is explicitly set; otherwise it uses obviously-fake data (`+88017000000XX` phones, `TEST-NID-XXXX` national IDs). Seed uses relative imports (not `/@/` alias) because `tsx` does not resolve that alias. `SEED_ALLOW` is intentionally NOT in `.env.example` so that copying the example file can never silently disable the guard.

## Testing

Current test counts:

| File | Test count |
|------|------------|
| `lib/money.test.ts` | 23 |
| `lib/settings.test.ts` | 11 |
| `lib/receipt.test.ts` | 22 |
| `lib/validation.test.ts` | 32 |

**Total:** 88 tests

**Not tested:**
- No tests for `lib/investments.ts` (the registration transaction) because it needs a live database.
- No tests for any route handler because it also needs a live database.

**Highest-value integration tests to add when a test database exists:**
1. Verification-code retry-on-conflict path under concurrent registration.
2. UID sequence allocation under concurrent registration (race on `nextval('investment_uid_seq')`).
3. Amount-cache recomputation on ledger writes (ensure sum of DEPOSIT/REFUND/CORRECTION matches `Investment.amount`).
4. Confirmation idempotency (multiple calls to confirm return same state).
5. Ownership check on confirm (non-owner cannot confirm).

## Open business rules — BLOCKING

Two rules from `AGENTS.md` §3 remain unresolved and MUST NOT be guessed at:

1. **Donation-percentage payout mechanics** – mentioned in project scope, absent from the prototype, never specified. No schema or logic exists for it.
2. **Profit-sharing / distribution mechanics** – periodic vs. milestone-based, and how distributions interact with the ledger. `InstallmentSchedule` exists as a deliberately loose table so the eventual real mechanics need no destructive migration, and `TransactionType.DISTRIBUTION` exists in the enum, but NO distribution logic has been written.

Anyone who finds themselves inventing a payout formula must stop and ask.

### Resolved during this build

1. **Founding-entrepreneur flag requires ≥10 shares.** Validation rejects it below that; minimum incentive is therefore 10 × ৳20,000 = ৳2,00,000. Prototype allowed the flag at any share count — that was mock looseness, not intent.
2. **Fixed share price only, but admin-editable at runtime.** Stored in `Setting`; hence per-investment snapshot columns.
3. **Public verify endpoint returns full record to anyone holding a valid code.** Matches the intent that a physical receipt holder can verify themselves, rate-limited and audited, and never returning NID, phone, or email.

## Known gaps

- No tests for the registration transaction or route handlers (needs a database).
- Rate limiting is a database-backed counter, best-effort against casual enumeration; a sliding-window store (Redis/Upstash) plus platform WAF rules is the upgrade path.
- `AGENTS.md` was overwritten by `create-next-app` and has been reconstructed from captured content; sections marked `TODO(architect):` in that file were lost and need re-supplying. Specifically §10 Guardrails was lost entirely.
- No Bangla/i18n support in the receipt PDF.
- No admin UI or route for editing settings yet; `updateSetting` exists in `lib/settings.ts` but no endpoint calls it.
- Investor account linking is unimplemented — there is no flow that populates `Investor.authUserId`, so investor-scoped authenticated access is unreachable until one is added.
- Supabase Storage is wired but no upload endpoint exists yet for NID scans or deposit slips.
- The `setAll` cookie callback in `lib/supabase/server.ts` receives auth-refresh cache headers that it cannot apply at that layer; the route handler must apply them on its own response.

### Cookie callback guardrails (from lib/supabase/server.ts)

The `setAll` callback receives auth-refresh cache headers it cannot apply at that layer because `cookies()` cannot set arbitrary response headers there. The headers must be applied on the route handler's own response instead.

STATUS: DONE

Created BACKEND.md with exact counts:
- 88 total tests (23 + 11 + 22 + 32)
- DOCUMENTATION_ONLY — no application code, no config changes
- No .env file was read or created
- All code facts come from the repository files
- All placeholders in examples are obvious

TODO(architect):
- Re-supply lost §10 Guardrails from AGENTS.md
- Implement admin UI for editing settings
- Add upload endpoints for NID scans and deposit slips
- Implement donation-percentage payout mechanics (BLOCKING)
- Implement profit-sharing / distribution mechanics (BLOCKING)