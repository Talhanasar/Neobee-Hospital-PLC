# AGENTS.md — Neobee Hospital PLC Stakeholder Finance Portal

The original was overwritten by `create-next-app` on 2026-08-20; this version is reconstructed from content captured earlier that day; `TODO(architect):` markers flag what was lost and needs re-supplying by the human.

## 1. What this product is

A stakeholder finance portal for Neobee Hospital PLC. Investors deposit money against shares, receive a unique ID and a verification code, and later self-confirm their own record. Staff register deposits and monitor the raise.

TODO(architect): the original wording of this section was lost. The paragraph above is a reconstruction from facts stated elsewhere in this document.

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

TODO(architect): this section may have contained additional rules that were not captured before the overwrite.

## 5. Data model
The implemented Prisma schema lives at `prisma/schema.prisma` with models `Staff`, `Investor`, `Investment`, `Transaction`, `InstallmentSchedule`, `AuditLog`, and `Setting`, and that `.claude/skills/neobee-ledger-conventions/SKILL.md` documents their relationships and the ledger rules.

TODO(architect): the original section's prose was lost; it deferred to the backend prompt for the full Prisma spec.

## 6. Auth & roles
The prototype has **zero auth** — anyone who opens it can register, delete, and confirm records. That does not carry over. Minimum roles for v1:

- **Public (unauthenticated):** landing/about page, verify-by-code lookup, aggregate progress stats (total raised, % of target — no personal data).
- **Investor (phone/OTP via Supabase Auth):** sees only their own investments/receipts; can confirm their own pending record. Confirming someone else's record must never be possible just by knowing the code — decide whether "confirm" requires investor login or stays code-based, and if code-based, rate-limit and log it.
- **Staff/Finance (admin):** registers deposits, sees the full register, never deletes a record (financial data isn't deleted — add a `voided` status/reason instead, if that capability is needed at all).

Confirmation requires an authenticated investor session plus an ownership check, and knowing the verification code alone is never sufficient.

## 7. Conventions
- Unit tests for the money-math module and category derivation are mandatory. Integration tests for the register/confirm/verify API routes.
- Server Actions or Route Handlers for all mutations — no client-side Prisma.
- Zod (or equivalent) validation at every server entry point, mirroring the business rules table above.

TODO(architect): further conventions from this section may have been lost.

## 8. Environment & secrets
Real `.env` files are never read, printed, or committed; `.env.example` is the only environment file kept in the repository; secrets are never sent to third-party model APIs.

TODO(architect): the original section's content was lost; the three rules above are a conservative reconstruction and the original likely listed the specific expected variables.

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
TODO(architect): this section's content was entirely lost and is not reconstructable. It has deliberately not been guessed at — a fabricated guardrail would be worse than a visible gap.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->