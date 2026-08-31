# HANDOFF.md

## 1. Start here

The Neobee Hospital PLC Stakeholder Finance Portal lets investors buy shares in a hospital by depositing money. Each investor gets a unique ID (NEO-0001 format) and a verification code (NB-XXXXXX format) to confirm their record. Staff register deposits, monitor fundraising, and approve requests. The portal tracks all financial activity; marketing pages show no fundraising figures. This is a financial system: money is always whole taka integers, never floats, and history is never rewritten — each investment records the share price and incentive at the time of purchase.

## 2. How to run it on your machine

Three run modes exist, in order of effort:

1. **Demo mode** (no database needed, fastest):
   ```bash
   node scripts/demo.mjs
   ```
   Launches the app with a built-in dataset from `data/demo/`. All UI is functional; you can explore the full experience instantly.

2. **Demo login mode** (requires Supabase):
   ```bash
   cp .env.example .env
   # fill out NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, etc.
   ```
   Launch with `pnpm dev`. The login page shows one-click demo buttons that sign in as pre-seeded staff/investor accounts.

3. **Real-data mode** (full database):
   ```bash
   cp .env.example .env
   # provide DATABASE_URL (Postgres URL) and any optional Supabase keys
   ```
   Run `pnpm dev`. Use `pnpm db:migrate` to apply migrations, `pnpm db:seed` for initial data, and `pnpm db:studio` to inspect.

For all modes, after `.env` is ready run `pnpm install` then `pnpm dev` to start the Next.js dev server at http://localhost:3000.

## 3. The big picture

```
Browser
  ↓ (HTTP/S)
proxy.ts  (locale prefix strip)
  ↓ (Server Component)
page.tsx (React component tree)
  ↓ (Server Actions / Route Handlers)
lib/investments.ts, lib/requests.ts, lib/leads.ts, etc.
  ↓ (Prisma)
PostgreSQL (with Supabase RLS)
  ↑ (ledger rows appended)
```

Each user click goes through proxy.ts, which removes the locale prefix, then lands in a Server Component. From there, mutations use Server Actions (client → server) or Route Handlers (client → server). Business logic lives in the `lib/` folder, calling Prisma to read/write the PostgreSQL database. The audit log and rate-limiting reuse the AuditLog table. Read-only views go directly to the DB.

## 4. Folder map

```
app/                    # Next.js app root
├── layout.tsx         # root shell
├── page.tsx           # generic 404
├── [locale]/          # locale prefix routing
│   ├── layout.tsx    # next-intl provider
│   ├── (site)/       # public marketing pages
│   ├── (auth)/       # login/register
│   └── (dash)/       # staff/investor dashboards
├── api/                # HTTP endpoints
├── components/        # UI primitives and features
├── lib/               # business logic (money, audit, settings, auth)
├── prisma/            # schema + migrations
├── data/demo/         # seed dataset (used in demo mode)
├── messages/          # i18n strings (en.json, bn.json)
├── scripts/           # build/dev/runtime helpers
└── public/            # static assets

components/           # React components, use client where interactive
├── ui/                # primitives (Button, Card, Badge, etc.)
├── layout/            # shells (SiteHeader, NavPills, etc.)
├── admin/             # admin-specific forms
├── portal/            # investor portal
├── auth/              # auth forms
├── receipt/           # printable receipts
├── verify/            # public code lookup
├── interest/          # lead capture
├── home/              # landing page components
└── about/             # about page components

lib/                  # business logic, pure functions only
├── money.ts           # integer money math, deriveCategory, formatUid, etc.
├── audit.ts           # actionVerbs enum, writeAuditLog
├── auth.ts            # requireStaff, requireAdmin, requireInvestor
├── settings.ts       # runtime share price/incentive lookup
├── rate-limit.ts      # DB-backed rate limiting using auditLog
├── requests.ts        # investment request flow
├── investments.ts     # investment register + confirm
├── leads.ts           # lead capture + pipeline
└── db.ts              # Prisma proxy
```

## 5. How routing works

```
/app/[locale]/(site)/page.tsx          -> /:locale/
/app/[locale]/(site)/about/page.tsx    -> /:locale/about
/app/[locale]/(site)/gallery/page.tsx  -> /:locale/gallery
/app/[locale]/(site)/interest/page.tsx -> /:locale/interest (uses interest/actions.ts)
/app/[locale]/(auth)/login/page.tsx     -> /:locale/login
/app/[locale]/(auth)/register/page.tsx -> /:locale/register
/app/[locale]/(auth)/register/profile/page.tsx -> /:locale/register/profile
/app/[locale]/(dash)/portal/…           -> /:locale/portal/… (investor)
/app/[locale]/(dash)/admin/…            -> /:locale/admin/… (staff/admin)
```

The locale segment appears in the URL but is stripped by `proxy.ts` before reaching the page logic. Route groups in parentheses `( )` do NOT appear in the URL but keep their files together (e.g., all marketing pages under `(site)`).

**Full verified route table:**

|PUBLIC (site)        |PRIVATE (dash)         |
|---------------------|----------------------|
|/:locale/            |/:locale/portal/…     |
|/:locale/about       |/:locale/portal/invest |
|/:locale/gallery     |/:locale/portal/account|
|/:locale/interest    |/:locale/portal/password|
|/:locale/verify      |/:locale/portal/receipts/[id]|
|                     |/:locale/admin/…      |
|                     |/:locale/admin/register |
|                     |/:locale/admin/requests/[id] |
|                     |/:locale/admin/registrations |
|                     |/:locale/admin/leads |
|                     |/:locale/admin/settings |
|                     |/:locale/admin/receipts/[id] |

API endpoints (no locale):
- `GET /api/investments/verify?code=NB-XXXXXX` (public lookup)
- `POST /api/investments` (register new investment)
- `POST /api/investments/[id]/confirm` (investor self-confirm)
- `GET /api/investments/[id]/receipt` (PDF download)

## 6. The data model

```
Investor ──(has many)── Investment
Investment ──(belongs to)── Investor
Investment ──(has many)── Transaction
Investment ──(has one)── InvestmentRequest
Transaction ──(belongs to)── InstallmentSchedule
Transaction ──(belongs to)── Staff (recordedByStaffId)
InstallmentSchedule ──(belongs to)── Investment
Lead ──(belongs to)── Staff (contactedByStaffId)
Staff ──(has many)── Investment
Staff ──(has many)── Setting (updatedByStaffId)
Staff ──(has many)── AuditLog (via actorId)
Investor ──(has many)── AuditLog
```

**Model fields (selected):**

|Model|Key Fields|Purpose|
|----|----------|-------|
|Investor|id, authUserId?, phone, name, email?, nationalIdFileKey?| investor record; can exist before auth linking; phone unique |
|Investment|id, uid (NEO-0001), code (NB-XXXXXX), shares, category, isEntrepreneur, sharePrice, incentivePerShare, amount, status, recordedByStaffId, confirmedByInvestorId?|financial ownership record; snapshots price/incentive at purchase; immutable after creation|
|Transaction|id, investmentId, amount, type (DEPOSIT/REFUND/CORRECTION/DISTRIBUTION), depositMethod?, depositDate?|ledger row; append-only; DEPOSIT positive, REFUND/CORRECTION/DISTRIBUTION negative; no UPDATE/DELETE policy|
|InstallmentSchedule|id, investmentId, dueDate, amount, status (SCHEDULED/PAID/OVERDUE/CANCELLED)|payment plan per investment|
|InvestmentRequest|id, investorId, kind, shares, status (SUBMITTED/APPROVED/REJECTED)|request for share purchase or payment; approved = creates Investment or DEPOSIT transaction|
|Lead|id, ref (NB-LEAD-XXXX), phone, name, status (NEW/CONTACTED)|marketing contact; never deleted; status changes via lib/leads.ts:32 and :112|
|Staff|id, authUserId, name, role (STAFF/ADMIN), isActive|user with permissions; requireStaff() and requireAdmin() guard routes|
|Setting|key, value (BigInt)|runtime config (share price, incentive, target amounts) |
|AuditLog|id, actorType, actorId, action, targetType, targetId, ipAddress, metadata, createdAt|immutable log of every mutation; reused for rate-limiting|

**Why Investment snapshots and append-only ledger:**
- `sharePrice` and `incentivePerShare` are recorded at registration because share price is admin-editable at runtime. Historical amounts are computed from these snapshots to avoid rewriting financial history.
- `Transaction` has no `updatedAt`. The comment says: DEPOSIT rows are positive; REFUND negative; CORRECTION either sign; DISTRIBUTION negative and excluded from principal cache. Corrections are new rows, never edits.

## 7. The money rules

**Constants (from lib/money.ts):**
```
SHARE_PRICE = 200000 BDT
TARGET_SHARES = 15000
TARGET_AMOUNT = 3000000000 BDT
FOUNDING_AMOUNT = 100000000 BDT
INCENTIVE_PER_SHARE = 20000 BDT
ENTREPRENEUR_MIN_SHARES = 10
MIN_SHARES = 1
MAX_SHARES = 100
UID_PREFIX = "NEO-"
CODE_PREFIX = "NB-"
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" (excludes I,O,0,1)
```

**Category thresholds:**
- SHAREHOLDER: 1–4 shares
- PREMIUM: 5–9 shares  
- DIRECTOR: 10+ shares

**Incentive rule:** Entrepreneurs get bonus = shares × incentivePerShare. Non-entrepreneurs get 0.

**ID formats:**
- UID: NEO-0001 (zero-padded, sequential)
- Verification code: NB-XXXXXX (6 chars, alphabet excludes I,O,0,1 to avoid confusion)
- Lead reference: NB-LEAD-XXXX

**Real code (lib/money.ts):**
```ts
export function deriveCategory(shares: number): InvestmentCategory {
  assertPositiveInteger(shares, 'shares');
  if (shares >= 10) return InvestmentCategory.DIRECTOR;
  if (shares >= 5) return InvestmentCategory.PREMIUM;
  return InvestmentCategory.SHAREHOLDER;
}

export function calculateAmount(shares: number, sharePrice: number): number {
  assertPositiveInteger(shares, 'shares');
  assertPositiveInteger(sharePrice, 'sharePrice');
  const amount = shares * sharePrice;
  if (!Number.isSafeInteger(amount)) {
    throw new RangeError('amount exceeds Number.MAX_SAFE_INTEGER');
  }
  return amount;
}
```

**Code alphabet drop explanation:** The characters I, O, 0, and 1 are excluded because they can be confused with each other in handwritten or OCR contexts, reducing verification errors.

## 8. The flows

### (a) Login (demo mode)
```
1. Browser → /:locale/login (page)
2. Click "Demo Login" (client component)
3. → POST /api/auth/demo-login (route handler)
4. → app/[locale]/(auth)/login/actions.ts:53 (demoLoginAction) writes audit at :137
5. Set neobee-demo-role cookie
6. Redirect to /:locale/portal
```

### (b) Staff registers a deposit
```
1. Staff logs in → /:locale/admin/register (page)
2. Fill RegisterForm (client) → POST /:locale/admin/register (Server Action)
3. → lib/investments.ts:107 (registerInvestment)
   - Calls lib/investments.ts:45 (nextInvestmentUid)
   - tx.investment.create (creates Investment with uidSequence)
   - tx.transaction.create (DEPOSIT row)
   - tx.investor.upsert (links authUserId)
4. Audit written at :157
5. UI updates instantly (no page reload)
```

### (c) Investor self-confirms
```
1. Investor receives code (NB-XXXXXX) from staff
2. Visits /:locale/verify (page) → public lookup
3. Click confirm button (client) → POST /api/investments/[id]/confirm (Route Handler)
4. → lib/investments.ts:184 (confirmInvestment)
   - findUnique by id + investorId guard (VERBATIM check)
5. Audit written at :207
6. Investment status becomes CONFIRMED, investor can use portal
```

### (d) Public verify by code
```
1. Visitor → /:locale/verify?code=NB-XXXXXX
2. VerifyLookup component calls GET /api/investments/verify?code=NB-XXXXXX
3. → app/api/investments/verify/route.ts:15 (GET handler)
4. Rate-limit check: countRecentAttempts with 5min window, limit 20/IP + 250 global
5. Returns: uid, code, investorName, shares, amount, category, status, depositDate
   WITHHELD: investorId, recordedByStaffId, notes, nationalIdNumber, deposit references
6. Audit written at :82 (ActorType.PUBLIC, action='investment.verify_lookup')
```

### (e) Share-purchase request then admin approval
```
1. Investor → /:locale/portal/invest (page)
2. Fill InvestForm (client) → POST /:locale/portal/invest (Server Action)
3. → lib/requests.ts:55 (submitInvestmentRequest)
   - Creates InvestmentRequest (status SUBMITTED)
4. Admin → /:locale/admin/registrations (page)
5. ReviewRequestForm → POST /:locale/admin/registrations/[id]/approve (Server Action)
6. → lib/requests.ts:118 (approveInvestmentRequest)
   - tx.investmentRequest.updateMany (SUBMITTED → APPROVED)
   - tx.investment.create (full investment record)
7. Audit at :94 (request.submit), :203 (request.approve)
```

### (f) Payment request then approval
```
1. Staff → /:locale/admin/requests (page)
2. ReviewRequestForm → POST /:locale/admin/requests/[id]/approve (Server Action)
3. → lib/requests.ts:299 (submitPaymentRequest) → lib/requests.ts:365 (approvePaymentRequest)
   - Creates Transaction row (DEPOSIT against targetInvestmentId)
4. Audits at :262 (request.submit), :341, :414, :480 (request.approve + payment.record)
```

### (g) Public lead form then admin pipeline
```
1. Visitor → /:locale/interest (page)
2. LeadForm (client) → POST /:locale/interest (Server Action)
3. → lib/leads.ts:32 (createLead) writes audit at :66 (lead.create)
4. Status becomes NEW
5. Admin → /:locale/admin/leads (page)
6. MarkLeadContacted form → POST /:locale/admin/leads/[id]/contact (Server Action)
7. → lib/leads.ts:112 (markLeadContacted) writes audit at :131 (lead.contact)
8. Status becomes CONTACTED; row never deleted
```

### (h) Admin edits settings
```
1. Admin → /:locale/admin/settings (page)
2. SettingsForm (client) → POST /:locale/admin/settings (Server Action)
3. → lib/settings.ts:64 (updateSetting)
4. Auditor composes update + writeAuditLog in one transaction
5. Audit written at settings/actions.ts:75
6. Share price/incentive updated instantly for new registrations
```

## 9. Auth and roles

**Four audiences:**
- **Public** (marketing pages, verify)
- **Investor** (portal dashboard, invest, account)
- **Staff** (admin console)
- **Admin** (staff with role='ADMIN'; extra permissions)

**Guard functions (from lib/auth.ts):**

```ts
export async function requireStaff(): Promise<Staff> {
  const authUserId = await loadAuthUserId();
  const staff = await getStaffForUser(authUserId);
  if (!staff || !staff.isActive) {
    throw new AuthError('Forbidden', 403);
  }
  return staff;
}
```

```ts
export async function requireAdmin(): Promise<Staff> {
  const staff = await requireStaff();
  if (staff.role !== 'ADMIN') {
    throw new AuthError('Forbidden', 403);
  }
  return staff;
}
```

```ts
export async function requireInvestor(): Promise<Investor> {
  const authUserId = await loadAuthUserId();
  if (isDemoData()) {
    const demoInvestor = demoInvestorForAuthUser(authUserId);
    if (!demoInvestor) throw new AuthError('Forbidden', 403);
    return demoInvestor as unknown as Investor;
  }
  const investor = await prisma.investor.findUnique({ where: { authUserId } });
  if (!investor) {
    throw new AuthError('Forbidden', 403);
  }
  return investor;
}
```

**Demo-mode branch:** When `isDemoData()` is true, `demoInvestorForAuthUser` returns a seeded investor based on the `neobee-demo-role` cookie. Verification code alone never grants confirm — the investor must be logged in (requireInvestor).

## 10. The audit log and rate limiting

**actionVerbs** (lib/audit.ts): A frozen object mapping logical actions to string keys. Every mutation writes a row with one of these actions (e.g., `investment.register`). The same keys are used for rate-limiting.

**Why same transaction:** If the audit write is outside the mutation transaction, and the mutation rolls back, a phantom audit row remains. To prevent that, `writeAuditLog` is called inside the same DB transaction that performs the business mutation.

**Rate-limiting trick:** `lib/rate-limit.ts` counts recent `auditLog` rows for a given action and optional IP address. Public verify uses both IP bucket (null bucket for unauthenticated requests) and global bucket, limiting 20/IP/5min and 250 global. No extra table needed because AuditLog already has the required indexes.

## 11. Two languages

**next-intl 4.13.7 wiring:**
- `i18n/routing.ts` defines locales (en, bn) and a cookie `NEOBEE_LOCALE`.
- `i18n/request.ts` reads the resolved locale, loads messages from `../messages/${resolved}.json`.
- `i18n/navigation.ts` exports Link, redirect, useRouter etc. that preserve the locale prefix.

**Parity rule:** Every UI string must exist in BOTH `messages/en.json` and `messages/bn.json` with identical flattened keys. The script `scripts/check-i18n.mjs` validates parity; the build fails otherwise.

**Gotcha:** Use `i18n/navigation.ts` exports for navigation, not `next/link` or `next/navigation`. Using the wrong import strips the locale prefix.

## 12. The design system

**Tokens (Tailwind v4, in app/globals.css):**
```css
@theme {
  --color-ink: #201D12;
  --color-ink-soft: #5C5744;
  --color-paper: #FDFCF7;
  --color-panel: #FFFFFF;
  --color-line: #E9E4D4;

  --color-honey: #E9A215;
  --color-honey-deep: #A96F05;
  --color-honey-soft: #FBF0D6;

  --color-green: #2F7D5B;
  --color-green-soft: #E4F1EA;
  --color-amber: #B26E00;
  --color-amber-soft: #FBEED3;
  --color-violet: #5B4B8A;
  --color-violet-soft: #ECE7F7;
  --color-blue: #1E5F8E;
  --color-blue-soft: #E2EEF6;

  --radius-card: 14px;
  --breakpoint-md: 760px;
}
```

**How a token becomes a class:** `--color-ink-soft` is declared in `@theme`, then used as `text-ink-soft` or `bg-ink-soft` via Tailwind's JIT compiler.

**Three contrast rules (in same file):**
1. `ink-on-honey` — any filled honey accent must carry `text-ink` (AA 4.5:1+).
2. `honey is fill/decoration only` — never use `--color-honey` for text.
3. `honey-deep / amber text only at >=24px or >=19px bold` — smaller sizes default to `--color-ink` / `--color-ink-soft`.

Focus rings use `--color-honey-deep`.

**FRONTEND.md is locked** — design tokens and component specs cannot change without explicit approval; they are the single source of truth for visual consistency.

## 13. Testing and the checks that gate a change

**Test files:**
- `lib/money.test.ts` (unit tests for integer math)
- `lib/validation.test.ts` (Zod validation)
- `lib/requests.test.ts` (investment request flows)
- `lib/settings.test.ts` (settings lookup)
- `lib/receipt.test.ts` (PDF generation)
- `tests/integration/api.int.test.ts` (end-to-end API checks)

**Four mandatory commands (all must pass):**
```bash
pnpm lint            # runs eslint + scripts/check-i18n.mjs + scripts/check-env.mjs
pnpm test            # runs vitest
pnpm build           # Next.js build
pnpm check:i18n      # validates parity of en.json ↔ bn.json
```

**Also:** `pnpm db:migrate` (applies migrations), `pnpm db:seed` (seeds data), and `pnpm test:integration` for heavy DB checks.

## 14. Rules you must not break

- Money math lives ONLY in `lib/money.ts`. Never use floats/decimals elsewhere.
- Every financial mutation writes a ledger row. Corrections are new rows — never UPDATE or DELETE.
- Never edit `lib/generated/` — that’s Prisma output; edit `prisma/schema.prisma`.
- Every UI string must appear in BOTH `messages/en.json` and `messages/bn.json`.
- Mutations use Server Actions or Route Handlers; never call Prisma from client components.
- Zod validation at EVERY server entry point.
- Admin filters/pagination are URL state (plain GET), not React state.
- No new npm dependencies without human approval.
- No commit/push/force-push without explicit human go-ahead.
- No destructive DB ops (no `reset`, no `DROP/TRUNCATE`). Use `pnpm db:deploy` to apply migrations.
- Never read/print/commit real `.env` values; only `.env.example`.
- Before committing, run: `pnpm lint`, `pnpm test`, `tsc --noEmit`, `pnpm build`.

## 15. Known gaps and open questions

- **Donation-percentage payout mechanics** — mentioned in project scope but never specced; needs clarification before implementation.
- **Profit-sharing / distribution mechanics for InstallmentSchedule** — periodic vs milestone-based, and interaction with ledger not defined.

Refer to `FRONTEND.md` "Known gaps" and `RUNBOOK.md` "Known limitations" for additional unbuilt areas.

## 16. Your first week

1. **Read orientation docs:**
   - `README.md` – quick orientation and scripts.
   - `FRONTEND.md` – locked design system; you need to know tokens and component API.
   - `RUNBOOK.md` – environment setup and known issues.

2. **Run the demo:**
   ```bash
   node scripts/demo.mjs
   ```
   Navigate to http://localhost:3000/en and explore the investor portal without a database.

3. **Trace a flow:**
   - Open `lib/investments.ts` and read the `registerInvestment` path (file:line 107).
   - Follow the transaction chain: `nextInvestmentUid` (45), `tx.investment.create`, `tx.transaction.create`, `tx.investor.upsert`.
   - Verify the audit log write at line 157.

4. **Touch i18n:**
   - Edit one string in `messages/en.json` and `messages/bn.json` (same key).
   - Run `pnpm check:i18n`; fix parity errors.

5. **Run the tests:**
   ```bash
   pnpm test
   ```
   Fix any failures (most likely money.ts validation).

6. **Build the app:**
   ```bash
   pnpm build
   ```
   Ensure no type errors and that the demo mode serves static HTML.

By the end of week one you should be able to read any new feature spec and explain it in terms of the existing lib/*, understand how a new request flows through the admin queue, and edit i18n strings safely.

---

**STATUS: DONE**

**Sections written:** 1. Start here, 2. How to run it on your machine, 3. The big picture, 4. Folder map, 5. How routing works, 6. The data model, 7. The money rules, 8. The flows, 9. Auth and roles, 10. The audit log and rate limiting, 11. Two languages, 12. The design system, 13. Testing and the checks that gate a change, 14. Rules you must not break, 15. Known gaps and open questions, 16. Your first week

**TODO(architect):**
- If the product needs a public fundraising counter, that logic is missing.
- The donation-percentage payout and profit-sharing specifics are undefined; clarification needed before implementation.