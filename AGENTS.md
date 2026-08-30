# AGENTS.md — Neobee Hospital PLC Stakeholder Finance Portal

The original was overwritten by `create-next-app` on 2026-08-20 and reconstructed from captured content. `TODO(architect):` markers flag what is still genuinely unknown — do not guess at them. Start with `README.md` for orientation, `FRONTEND.md` for the locked design system, and `RUNBOOK.md` for environment/database operations.

## 1. What this product is

A stakeholder finance portal for Neobee Hospital PLC. Investors deposit money against shares, receive a unique ID and a verification code, and later self-confirm their own record. Staff register deposits and monitor the raise. The public marketing surface (home, about, gallery) and the "Become a Shareholder" lead form carry no fundraising figures; the portal and admin console carry all of them.

## 2. Tech stack

- Next.js (App Router), TypeScript
- Prisma ORM
- Supabase Postgres (target: self-hosted Postgres on a VPS later)
- Supabase Auth — phone/OTP as the primary investor login method
- Supabase Storage (target: MinIO later) — NID/passport scans, deposit slips
- Deployed on Vercel (target: VPS later)
- Tailwind CSS for styling (utility classes only — see frontend prompt for the constraint on which classes are actually available at build time)

**Known future migration:** Supabase → self-hosted Postgres + MinIO on a VPS. Design with this in mind:
- Don't hard-code Supabase-only Postgres extensions or RLS as the *only* line of defense — application-layer authorization must also hold up without RLS.
- Keep file storage behind a thin storage adapter interface, not direct Supabase Storage SDK calls sprinkled through the codebase.
- Supabase Auth password/OTP hashes do not export cleanly — the migration will need a "verify against Supabase, then re-issue credentials against the new system on next login" flow, not a raw table dump. Don't build anything today that assumes Supabase's internal `auth.users` schema is portable.

## 3. Business rules — single source of truth

| Rule | Value |
|---|---|
| Share price | ৳2,00,000 (200,000 BDT) per share |
| Entrepreneur share incentive | ৳20,000 bonus per share, entrepreneurs only |
| Project target | ৳300 crore (3,000,000,000 BDT) |
| Total shares at target | 15,000 |
| Founding phase target | ৳10 crore (100,000,000 BDT) |
| Founding entrepreneur slots | 50 |
| Category: Shareholder | 1–4 shares |
| Category: Premium Shareholder | 5–9 shares |
| Category: Director Shareholder | 10+ shares |
| Unique ID format | `NEO-0001` (sequential, zero-padded to 4) |
| Verification code format | `NB-XXXXXX` (6 chars, unambiguous alphabet: no `I O 0 1`) |
| Deposit methods | Bank deposit (NEOBEE account), Bank transfer, Cheque, Mobile banking |
| Investment status | `pending` → `confirmed` (investor self-confirms) |
| Lead reference format | `NB-LEAD-XXXX` (4 chars from the same unambiguous alphabet) |
| Lead status | `NEW` → `CONTACTED` (staff mark after calling; leads are never deleted) |

### Open items (as originally written)
Open items the prototype left ambiguous — confirm with the human before implementing, do not silently pick one:
- The prototype lets *any* share count carry the "founding entrepreneur" flag, but the project prose says entrepreneur entry is specifically ৳20,00,000 (10 shares). Decide: is "entrepreneur" an independent flag, or does it require ≥10 shares? This changes validation and the incentive calculation.
- Donation-percentage payout mechanics (mentioned in project scope, not present in the prototype at all) — needs its own spec before coding.
- Profit-sharing mechanics for `InstallmentSchedule` / ongoing distributions — periodic vs. milestone-based, and how it interacts with the ledger.
- Fixed share price vs. free-amount investment — the prototype implements **fixed price only** (integer share count × ৳2,00,000). Confirm this is final before building free-amount support into the schema.

### Resolved (decided 2026-08-20)
1. **Entrepreneur minimum** — the founding-entrepreneur flag requires ≥10 shares; validation rejects the flag below that. Consequence: the smallest possible incentive is 10 × ৳20,000 = ৳2,00,000. The prototype's permissiveness was mock looseness, not intent.
2. **Fixed price, admin-editable** — fixed share price only; an investment is always a whole share count × the share price. The price itself is administrator-editable at runtime, stored in a `Setting` table rather than hardcoded. Consequence: every `Investment` row snapshots the `sharePrice` and `incentivePerShare` in effect at registration, and historical amounts are computed from that snapshot, never recomputed against the current live price — doing so would silently rewrite financial history.
3. **Public verify lookup** — the public verify-by-code endpoint returns the full record (investor name, shares, amount, category, status, deposit date) to anyone holding a valid code, matching the prototype's intent that a physical receipt holder can verify themselves. It is strictly rate-limited per IP and every lookup writes an `AuditLog` row, because a 6-character code over a 32-character alphabet is enumerable otherwise. It never returns NID number, phone, or email.

Two items remain open and unresolved: donation-percentage payout mechanics, and profit-sharing / distribution mechanics for `InstallmentSchedule`.

## 4. Money handling — non-negotiable rules
- All monetary values are integers. Never use `float`/`Decimal` JS types for storage or arithmetic that touches the ledger.
- Recommended unit: integer BDT (whole taka), not paisa.
- The prototype's own arithmetic never produces fractional taka.
- Money math lives in one pure, unit-tested module, server-side only.
- Every financial mutation writes an immutable ledger row. Corrections are new rows that reference the original, never in-place edits to historical rows.

Formatting, amount-in-words, and the category-threshold derivations are specified in `.claude/skills/neobee-money-math/SKILL.md` — read it before touching any money code.

## 5. Data model
The implemented Prisma schema lives at `prisma/schema.prisma` with models `Staff`, `Investor`, `Investment`, `InvestmentRequest`, `Transaction`, `InstallmentSchedule`, `AuditLog`, `Setting`, and `Lead`. `.claude/skills/neobee-ledger-conventions/SKILL.md` documents the financial relationships and ledger rules.

Migrations (in `prisma/migrations/`, apply with `pnpm db:deploy`):
- `0_init` — schema plus the `investment_uid_seq` sequence (unique IDs come from the sequence inside the registration transaction, never from row counts).
- `1_rls` — Supabase RLS policies (defense-in-depth; see `RUNBOOK.md` §12 for which mode runs where).
- `2_investment_requests` — the investor request → staff approval workflow.
- `3_leads` — public interest leads (`Lead` model, `NB-LEAD-XXXX` refs, staff `NEW → CONTACTED` pipeline).

## 6. Auth & roles
The prototype has **zero auth** — anyone who opens it can register, delete, and confirm records. That does not carry over. Minimum roles for v1:

- **Public (unauthenticated):** marketing pages (home, about, gallery), verify-by-code lookup (rate-limited per IP, audited), the "Become a Shareholder" lead form (`/interest` → `Lead`), and aggregate progress stats (total raised, % of target — no personal data).
- **Investor (phone/OTP via Supabase Auth):** sees only their own investments/receipts; can confirm their own pending record; submits investment requests that staff approve (`/portal/invest` → `InvestmentRequest` → admin queue). Confirming someone else's record must never be possible just by knowing the code.
- **Staff/Finance (admin):** registers deposits, reviews the approval queue (`/admin/requests`), works the interest-lead pipeline (`/admin/leads`), edits runtime share price / incentive / targets (`/admin/settings`), sees the full register — never deletes a record (financial data isn't deleted; a `voided` status would be the pattern if that capability is ever needed).

Confirmation requires an authenticated investor session plus an ownership check, and knowing the verification code alone is never sufficient.

## 7. Conventions
- Unit tests for the money-math module and category derivation are mandatory. Integration tests for the register/confirm/verify API routes.
- Server Actions or Route Handlers for all mutations — no client-side Prisma.
- Zod (or equivalent) validation at every server entry point, mirroring the business rules table above.
- Every UI string lives in `messages/en.json` AND `messages/bn.json`, added in the same change; `pnpm check:i18n` enforces parity. Numbers are pre-formatted to strings before `t()` (see `FRONTEND.md` §4).
- Admin table filters and pagination are URL state (plain GET forms), not React state.
- `pnpm lint` (ESLint + `check:i18n` + `check:env`), `pnpm test`, `tsc --noEmit`, and `pnpm build` must pass before any work is called done.
- No new npm dependency without flagging the name and version to the human first.
- `done_by_zcode/`, `reference/`, and `screenshots/` are read-only reference material (excluded from tsconfig and ESLint). Never import from them, never build against them, never delete them.

## 8. Environment & secrets
Real `.env` files are never read, printed, or committed; `.env.example` is the only environment file kept in the repository; secrets are never sent to third-party model APIs. `pnpm check:env` fails on drift between `.env.example` and what the code actually reads.

The expected variables (documented with purpose in `.env.example` and `RUNBOOK.md` §3): `DATABASE_URL`, optional `DIRECT_URL` (pooled-connection override for migrations), optional `NEOBEE_DB_PROVIDER` (`supabase` | `generic`), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`, optional `SEED_ALLOW` (production seeding override), optional `DEMO_LOGIN` (demo login outside development).

## 9. Project-level skills
This repo should have the following skills available to the coding agent (see the "Skills" section at the end of each prompt file for how each is used):

- `frontend-design` — required for the frontend prompt; governs design-token discipline so the UI stays faithful to the palette extracted from the prototype instead of drifting toward generic AI-app defaults.
- `pdf` — for generating the investor's digital money receipt as a real server-rendered PDF (the prototype only does browser print-to-PDF, which isn't good enough for an audit-grade receipt).
- `xlsx` — for staff/finance exports of the shareholder register and transaction ledger for audits and board reporting.
- `docx` (optional, lower priority) — only if/when formal share certificates or board letters need to be generated as Word documents.

In addition, create two **custom project skills** early, since this project has enough non-obvious domain logic that it's worth writing down once and having every agent session reference it instead of re-deriving it:

- `.claude/skills/neobee-money-math/SKILL.md` — the constants table in section 3, the category thresholds, incentive formula, and ID/code format, written as a skill so it's pulled in automatically whenever an agent touches money code.
- `.claude/skills/neobee-ledger-conventions/SKILL.md` — the Investment/Transaction/InstallmentSchedule relationship, the "ledger rows are immutable, corrections are new rows" rule, and the required audit fields.

Both custom skills now exist at those paths, created 2026-08-20.

## 10. Guardrails

Enforced on every change — no exceptions for small diffs:

- **No commit, no push, no force-push without the human's explicit go-ahead.** Work happens in the working tree or on a feature branch; the human reviews the diff first.
- **No destructive database operations** — no `prisma migrate reset`, no `DROP`/`TRUNCATE`, no overwriting seed data. Migrations must be additive or explicitly approved; apply with `pnpm db:deploy`.
- **No new npm dependency without flagging the name and version first.** No hand-editing lockfiles.
- **No disabling lint rules or type-checks to force a green build** (no blanket `eslint-disable`, no `@ts-ignore` to make errors vanish).
- **No deploy commands** (Vercel, production migrations, DNS/dashboard changes) without explicit confirmation.
- **Secrets stay out of context**: never open, print, or forward real `.env` values, keys, tokens, or connection strings — including into subagent prompts. `.env.example` is the only environment file that may be read.
- **Never edit generated code** (`lib/generated/` is Prisma output; change `prisma/schema.prisma` and run `pnpm db:generate`).
- **Never import from reference material** (`done_by_zcode/`, `reference/`, `screenshots/`) and never treat prototype copy as a spec override — `AGENTS.md` business rules win over anything in the prototypes.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->