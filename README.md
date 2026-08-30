# Neobee Hospital PLC — Stakeholder Finance Portal

A production-grade **stakeholder finance portal** for Neobee Hospital PLC — a proposed
private hospital in Chattogram, Bangladesh, raising share capital from individual
shareholders. The public side is a marketing site with **zero fundraising figures**;
investors sign in by **phone/OTP** to review and confirm their own deposits and print
**digital money receipts with QR verification**; staff run the register, the approval
queue, interest leads, and runtime settings.

Built with **Next.js 16 (App Router)**, **TypeScript**, **Prisma 7 + Postgres**,
**Supabase (Auth / Storage)**, **next-intl (`en` + `bn`)** and **Tailwind CSS v4**.
The visual design is ported 1:1 from the approved reference prototype — its design
tokens are **locked** (see below).

---

## Read this first

| Doc | What it holds |
|---|---|
| `AGENTS.md` | Business rules (single source of truth), money-handling laws, domain model, auth/roles. Read before touching backend code. |
| `FRONTEND.md` | Design tokens (locked), i18n + numerals rules, full component and route maps. Read before touching UI. |
| `RUNBOOK.md` | Environment, databases, migrations, seeds, tests, RLS modes, known gaps. |
| `.claude/skills/neobee-money-math/SKILL.md` | Money constants, category thresholds, incentive formula, ID/code formats. Auto-loaded when money code is touched. |
| `.claude/skills/neobee-ledger-conventions/SKILL.md` | Ledger immutability rules, transaction relationships, audit requirements. |

---

## Quick start

```bash
# 1. Install + generate the Prisma client (lib/generated is gitignored — always required)
pnpm install
pnpm db:generate

# 2. Environment — copy the example and fill in real values
cp .env.example .env

# 3. Database — apply migrations, then seed demo data
pnpm db:deploy
pnpm db:seed

# 4. Run
pnpm dev            # http://localhost:3000 → redirects to /en
```

`pnpm test`, `pnpm lint`, and `pnpm test:integration` need **no** `.env` — they run
without any database or Supabase credentials. A real `.env` is only needed to run the
app or migrate a database. Full setup paths (ephemeral local Postgres, Docker Supabase)
are in `RUNBOOK.md`.

---

## Route map

All page routes live under the locale segment `/[locale]` (`en`, `bn`).

| Route | Zone | Access |
|---|---|---|
| `/[locale]` | Marketing — hero, at-a-glance, project, promises | Public |
| `/[locale]/about` | Marketing — origin, partnership, leadership, values, visit | Public |
| `/[locale]/gallery` | Marketing — filterable gallery with lightbox | Public |
| `/[locale]/interest` | Lead capture — "Become a Shareholder" form | Public, rate-relevant, audited |
| `/[locale]/verify` | Utility — receipt code / UID lookup + demo viewfinder | Public, rate-limited per IP |
| `/[locale]/login` | Auth — phone/OTP sign-in (+ demo buttons in dev) | Public |
| `/[locale]/register` | Auth — investor registration (+ `/register/profile`) | Public |
| `/[locale]/portal` | Investor — own investments, confirm, receipts | Investor (ownership-checked) |
| `/[locale]/portal/invest` | Investor — submit an investment request | Investor |
| `/[locale]/portal/receipts/[id]` | Investor — digital money receipt | Investor, own records only |
| `/[locale]/admin` | Staff — dashboard, shareholder register | Staff |
| `/[locale]/admin/register` | Staff — register a deposit (issues ID/receipt/QR) | Staff |
| `/[locale]/admin/requests[/id]` | Staff — investor request approval queue | Staff |
| `/[locale]/admin/leads` | Staff — interest-lead pipeline (NEW → CONTACTED) | Staff |
| `/[locale]/admin/settings` | Staff — share price, incentive, targets | Staff |
| `/[locale]/admin/receipts/[id]` | Staff — receipt for any record | Staff |
| `/api/investments/verify` | API — public verify lookup (rate-limited, audited) | Public |

---

## Architecture

```
app/
  [locale]/
    (site)/            # marketing + verify + portal + admin (shared header/footer)
      page.tsx         # homepage (server) + components/home client islands
      about/ gallery/ verify/ interest/
      portal/          # investor zone (auth-gated)
      admin/           # staff zone (requireStaff in layout)
    (auth)/            # login / register — own minimal shell
  api/investments/     # register / confirm / receipt / verify route handlers
components/
  ui/                  # design-system primitives (Button, Card, badges, Money, Num,
                       #  bits.tsx = HexLogo/HexOutline/Kicker/SectionHead/Btn/HexQr,
                       #  icons.tsx = inline SVG icon set — no icon dependency)
  layout/              # SiteHeader/NavPills, SiteFooter, LanguageSwitcher, BackToTop
  home/ about/ gallery/ interest/ verify/   # page islands (client where interactive)
  admin/ auth/ portal/ receipt/             # zone components
  share-card.ts        # canvas-drawn shareable PNG cards (device-only, no upload)
lib/
  money.ts requests.ts investments.ts leads.ts settings.ts receipt.ts …
  generated/prisma/    # Prisma client — gitignored, run `pnpm db:generate`
messages/
  en.json bn.json      # next-intl catalogs — 519 keys each, parity enforced
prisma/
  schema.prisma        # Staff, Investor, Investment, InvestmentRequest, Transaction,
                       # InstallmentSchedule, AuditLog, Setting, Lead
  migrations/          # 0_init, 1_rls, 2_investment_requests, 3_leads
scripts/               # guard + tooling (check-i18n, check-env, migrate, ephemeral-pg)
public/images/         # render/site/event imagery used by marketing pages
```

**Reference material — never import into the app:** `done_by_zcode/` (the generated
prototype this design was ported from), `reference/`, and `screenshots/`. They are
excluded from `tsc` and ESLint on purpose; do not delete, build against, or ship them.

---

## Design system (locked — do not change tokens)

Extracted from the approved reference prototype. Defined once in `app/globals.css`
(`@theme`). Tailwind v4 turns each `--color-*` into utilities (`bg-*`, `text-*`,
`border-*`).

```css
--color-ink:        #201D12;   /* text */
--color-ink-soft:   #5C5744;   /* secondary text */
--color-paper:      #FDFCF7;   /* page background */
--color-panel:      #FFFFFF;   /* cards */
--color-line:       #E9E4D4;   /* borders */
--color-honey:      #E9A215;   /* primary accent (fills, never small text) */
--color-honey-deep: #A96F05;   /* accent text / focus rings */
--color-honey-soft: #FBF0D6;   /* accent wash */
--color-green:      #2F7D5B;  --color-green-soft: #E4F1EA;
--color-amber:      #B26E00;  --color-amber-soft: #FBEED3;
--color-violet:     #5B4B8A;  --color-violet-soft: #ECE7F7;
--color-blue:       #1E5F8E;  --color-blue-soft:  #E2EEF6;
--radius-card: 14px;  --breakpoint-md: 760px;
```

Hard rules:

- **Flat panels** — cards are white with a `1px` line border and `14px` radius.
  `shadow-*` is absent from the codebase **by design**; do not introduce it.
- **Hexagon motif** — `.hex-bg` lattice backdrop, `.hex` / `.hex-clip` /
  `.hex-clip-pointy` clip paths, `.hex-float` animation. Small hexagon dots mark
  list items and kickers; pointy hexagons frame images and icon tiles.
- **Honey contrast law** — filled honey elements always carry `text-ink`; honey is
  never a text color below 24px; small accent text uses `honey-deep`; focus rings
  use `honey-deep`.
- **Typography** — Archivo (display), Inter (body), IBM Plex Mono (every numeral,
  ID, code, amount via `.num` / `.tnum`), Noto Sans Bengali (bn shaping).
- **Component classes** — `.nb-card`, `.nb-kicker`, `.nb-input`; entrance motion via
  `Reveal` (`components/ui/Reveal.tsx`) and `.page-in`; every animation honors
  `prefers-reduced-motion`.

---

## Content rules baked into the code

- **Marketing pages carry zero fundraising figures** — no ৳300 crore goal, no share
  price, no category names, no slot counts. Those live only in the portal and admin.
- **The ledger is append-only.** No delete action exists anywhere; corrections are new
  rows referencing the original. Leads are never deleted either — they progress
  `NEW → CONTACTED`.
- **Amounts are integers** (whole taka). Never introduce `float`/`Decimal` into money
  paths; all math lives in `lib/money.ts` (unit-tested).
- **Investment rows snapshot `sharePrice` and `incentivePerShare`** at registration.
  History is never recomputed against today's live settings.
- **Receipts are always English** (bank-facing document), regardless of viewer locale.
- **Numerals are Western digits (`0–9`) in both locales**; numbers are pre-formatted to
  strings *before* `t()` — a raw ICU number formats in the active locale and leaks
  Bengali digits into the mono type.
- **Every UI string goes through the catalogs.** Add keys to *both* `messages/en.json`
  and `messages/bn.json` in the same change; `pnpm check:i18n` fails on drift
  (currently 519 keys each).

---

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16.3.1 (App Router, Turbopack dev) |
| UI runtime | React 19 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 (`@theme` in `app/globals.css`) |
| i18n | next-intl 4 (`en`, `bn`; `proxy.ts` middleware) |
| Database | PostgreSQL via Prisma 7 (driver adapter `@prisma/adapter-pg`) |
| Auth | Supabase phone/OTP (`@supabase/ssr`), roles via `Staff` / `Investor` rows |
| Storage | Supabase Storage behind `lib/storage.ts` (adapter-style, MinIO-ready) |
| Receipts | PDFKit (server-rendered PDF), `qrcode` (QR data URLs) |
| Validation | Zod at every server entry point |
| Tests | Vitest (unit) + ephemeral-Postgres integration suite |

---

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server (http://localhost:3000) |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm lint` | ESLint **+** `check:i18n` **+** `check:env` — run before declaring done |
| `pnpm test` | 111 unit tests, no database required |
| `pnpm test:integration` | Route + RLS tests against a throwaway Postgres |
| `pnpm db:generate` | Regenerate the Prisma client (after any schema change) |
| `pnpm db:migrate` | Create + apply a new migration (dev) |
| `pnpm db:deploy` | Path-aware migration runner (Supabase / auto-shim / generic) |
| `pnpm db:seed` | Seed settings, staff, investors, demo investments |
| `pnpm check:i18n` | `en`/`bn` catalog key parity |
| `pnpm check:env` | `.env.example` ↔ `process.env` drift |

---

## Definition of done (for any change)

```bash
pnpm lint        # eslint + i18n parity + env parity — zero errors
pnpm test        # all unit tests pass
pnpm exec tsc --noEmit
pnpm build       # must succeed without real credentials
```

New user-facing UI also gets a visual pass against the reference design and a
functional click-through (see `AGENTS.md` §6 lifecycle). Nothing is committed or
pushed without the human's explicit go-ahead.
