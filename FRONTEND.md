# FRONTEND.md — Neobee Hospital PLC Stakeholder Finance Portal

## 1. Overview and how to run it

The frontend is a Next.js application for the Neobee Hospital PLC stakeholder finance portal. It supports public progress and verification views, investor authentication and receipts, and staff registration and ledger views.

| Concern | Choice |
|---------|--------|
| Framework | Next.js 16.3.1 |
| UI runtime | React 19.2.8 |
| Language | TypeScript with strict checking |
| Styling | Tailwind CSS v4 |
| Internationalisation | `next-intl` 4.13.7 |
| Package manager | pnpm 10.13.1 |
| Tests | Vitest |
| Backend clients used by the app | Prisma, Supabase, PDFKit, QRCode, Zod |

`next-intl@4.13.7` is the one dependency added for this pass. Nothing else was installed.

Run the scripts declared in `package.json`:

```sh
pnpm install
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm test
pnpm test:watch
```

The application reads these environment variable names when the corresponding services are called:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`

`pnpm build` deliberately succeeds without any of these values. Database-reading pages are marked `force-dynamic`, and the Supabase clients read configuration lazily when called.

Verification status at the time of writing is `tsc --noEmit` clean, `eslint` clean, `next build` successful, and `vitest` with 111 tests passing in 5 files. `pnpm lint` also runs the i18n parity and env parity guard scripts.

## 2. Design tokens

The tokens were re-themed 2026-09 from the warm honey set to the Clinical Blue hospital palette (client decision — the gold read promotional rather than medical). Source of truth: `app/globals.css`.

| Token | Value |
|-------|-------|
| `--color-ink` | `#0F1F2B` |
| `--color-ink-soft` | `#3E5666` |
| `--color-paper` | `#F7FAFC` |
| `--color-panel` | `#FFFFFF` |
| `--color-line` | `#D7E3EC` |
| `--color-honey` | `#0B6E99` |
| `--color-honey-deep` | `#0A4D6B` |
| `--color-honey-soft` | `#DCEEF6` |
| `--color-green` | `#1B7A4B` |
| `--color-green-soft` | `#E2F3E9` |
| `--color-amber` | `#9A6200` |
| `--color-amber-soft` | `#FCEFDB` |
| `--color-violet` | `#5B4B8A` |
| `--color-violet-soft` | `#ECE7F7` |
| `--color-blue` | `#1E5F8E` |
| `--color-blue-soft` | `#E2EEF6` |
| `--radius-card` | `14px` |
| `--breakpoint-md` | `760px` |

The first `@theme` block in `app/globals.css` defines these values. Tailwind CSS v4 turns `--color-*` entries into utilities such as `bg-*`, `text-*`, and `border-*`. The `@theme inline` block maps the `next/font` CSS variables onto `--font-display`, `--font-body`, and `--font-mono`.

The identity is flat: a card is a white panel with a 1px line border and a 14px radius, with no shadow. `shadow-*` is absent from the codebase by design.

The hexagon motif is implemented by `.hex` using `clip-path`. It is used as the large decorative watermark in `GoalBanner`, as the small accent in `StatCard`, and in the receipt logo SVG. The receipt logo uses the motif again as two nested polygons because the logo is an inline SVG rather than a `.hex` element.

The small set of hardcoded hex literals has a local reason rather than a missing token:

- `#FBE4E2` and `#B3261E` are the verify and register error background and text colors.
- `#0B6E99`, `#F7FAFC`, and `#0A4D6B` are the three fills in the receipt logo SVG (clinical-blue mirror of the tokens).

### 2.1 The reference-prototype utility layer (added by the design port)

The marketing design was ported 1:1 from the approved z.ai prototype; its utility vocabulary now lives alongside the tokens in `app/globals.css` and must be reused rather than reinvented:

- `.hex-bg` — faint hexagon lattice backdrop (hero, verify, interest, map placeholder card).
- `.hex` / `.hex-clip` / `.hex-clip-pointy` — hexagon clip paths (flat chips / image frames and icon tiles).
- `.nb-card`, `.nb-kicker`, `.nb-input` — the shared card, eyebrow-label, and input treatments.
- `.hex-float` / `.hex-float-slow` — floating decorative hexagon outlines; `.page-in` — route entrance.
- `.reveal` + `.reveal-in` — scroll reveal (driven by `components/ui/Reveal.tsx`, reduced-motion safe with a 2s fallback).
- `.scan-line` — verify viewfinder sweep; `.sec-flash` — About deep-link anchor flash; `.tnum` / `.num` — tabular mono numerals.

Shared primitives for the marketing design live in `components/ui/bits.tsx`: `HexLogo`, `HexOutline`, `HexAvatar`, `Kicker`, `SectionHead`, `Btn` (variants `primary | outline | ghost | soft`, sizes `sm | md | lg`, via `btnClasses()` for `Link`-styled buttons), `Field`, `PseudoQr`, `HexQr`. Icons are inline SVG components in `components/ui/icons.tsx` (lucide geometry) — **there is deliberately no icon npm dependency; add new icons there rather than installing a library.**

## 3. Internationalisation

The internationalisation files are:

| File | Role |
|------|------|
| `i18n/routing.ts` | Defines locales `en` and `bn`, default locale `en`, and the `NEOBEE_LOCALE` cookie with a one-year `maxAge`. |
| `i18n/request.ts` | Resolves a valid locale and dynamically loads `messages/{locale}.json`. |
| `i18n/navigation.ts` | Exports locale-aware `Link`, `redirect`, `usePathname`, `useRouter`, and `getPathname`. |
| `proxy.ts` | Uses `createMiddleware(routing)` for locale-segment routing. On Next.js 16 this file is named `proxy.ts`, not `middleware.ts`; `next-intl` still exports `createMiddleware`. |
| `next.config.ts` | Wraps the Next config with the `next-intl` plugin. |

The message namespace list in `messages/en.json` is:

`meta`, `brand`, `nav`, `footer`, `common`, `categories`, `statuses`, `landing`, `about`, `gallery`, `progress`, `receipt`, `qr`, `methods`, `verify`, `interest`, `admin`, `login`, `register`, `invest`, `portal`, `auth`.

Both catalogs contain 519 keys, verified in parity by `pnpm check:i18n`.

Every internal link uses `Link` from `@/i18n/navigation`. Locale-aware redirects use the object shape `redirect({ href, locale })`.

## 4. The numerals decision

Western Arabic numerals, `0`–`9`, are used in both locales for every amount, ID, share count, code, and percentage. Only labels and prose are translated.

This is deliberate for three reasons:

1. `IBM Plex Mono` has no Bengali digit glyphs.
2. Bangladeshi financial and receipt documents use Arabic numerals regardless of language.
3. `next-intl` documents no numbering-system override, while `Intl.NumberFormat('bn-BD')` emits Bengali digits, `০`–`৯`, by default.

The consequence is important: a raw number passed as an ICU interpolation value gets formatted in the active locale. Numbers are therefore pre-formatted to strings before reaching `t()`:

- Currency uses `` `৳${formatBdt(n)}` ``.
- Counts use `n.toLocaleString('en-IN')`.

ICU's `#` inside a plural block has the same defect. `landing.sharesLabel` therefore takes a `{display}` placeholder for the rendered value while `{count}` only selects the plural branch.

`Intl.NumberFormat`, `useFormatter`, and `getFormatter` appear nowhere in the codebase. A passing build cannot detect a regression here; the defect appears visually in the `bn` locale.

All currency renders through `components/ui/Money.tsx`, which wraps `formatBdt` from `lib/money.ts`. Non-currency numerics render through `components/ui/Num.tsx`.

## 5. Components

A file without a `'use client'` directive is a Server Component or is server-compatible in the current tree. The components marked `'use client'` are Client Components.

| Component | Type | Role |
|-----------|------|------|
| `components/admin/AdminNav.tsx` | Client | Client-side admin section navigation with active-route state. |
| `components/admin/LeadsTable.tsx` | Client | Interest-lead pipeline table; "mark contacted" server action per row. |
| `components/admin/RegisterForm.tsx` | Client | Staff investment registration form with calculated preview and field errors. |
| `components/admin/ShareholderTable.tsx` | Server | Filterable, paginated shareholder ledger table. |
| `components/about/SecFlash.tsx` | Client | About deep-link (`?sec=`) scroll + honey anchor flash. |
| `components/auth/LoginForm.tsx` | Client | Investor phone/OTP authentication form (hex step indicator, +880 addon). |
| `components/gallery/GalleryClient.tsx` | Client | Gallery filters, image grid with fade-in tiles, lightbox. |
| `components/home/GlanceStat.tsx` | Client | At-a-glance stat with count-up and About deep-link. |
| `components/home/ProjectCardDialog.tsx` | Client | Canvas-rendered "project at a glance" PNG dialog. |
| `components/interest/LeadForm.tsx` | Client | Public lead-capture form; server action + duplicate guard + NB-LEAD ref. |
| `components/layout/BackToTop.tsx` | Client | Bottom-left back-to-top affordance after 480px scroll. |
| `components/layout/LanguageSwitcher.tsx` | Client | Segmented EN/বাং locale switcher. |
| `components/layout/NavPills.tsx` | Client | Marketing header: hex brand, pill links, switcher, auth button, mobile menu. |
| `components/layout/SiteFooter.tsx` | Server | Four-column footer (brand, explore, utility, contact) + bottom bar. |
| `components/layout/SiteHeader.tsx` | Server | Reads session, renders `NavPills` with auth state. |
| `components/portal/ConfirmButton.tsx` | Client | Investor confirmation action with an armed confirmation state and error output. |
| `components/receipt/PrintButton.tsx` | Client | Print action for a receipt. |
| `components/receipt/QrModal.tsx` | Client | QR preview modal with keyboard and focus handling. |
| `components/receipt/Receipt.tsx` | Server | English bank-facing receipt rendered from `ReceiptData`. |
| `components/share-card.ts` | Client util | Canvas drawing of shareable PNG cards (project card; no upload). |
| `components/ui/bits.tsx` | Server-compatible | Reference-design primitives: HexLogo, HexOutline, HexAvatar, Kicker, SectionHead, Btn, Field, PseudoQr, HexQr. |
| `components/ui/icons.tsx` | Server-compatible | Inline SVG icon set (lucide geometry) — no icon dependency. |
| `components/ui/Button.tsx` | Server-compatible | Shared button styles and forwarded button component. |
| `components/ui/Card.tsx` | Server-compatible | Shared card and card-header containers. |
| `components/ui/CategoryBadge.tsx` | Server | Localised investment-category badge. |
| `components/ui/GoalBanner.tsx` | Server | Fundraising goal, progress bars, and summary metadata. |
| `components/ui/Money.tsx` | Server-compatible | BDT amount formatter and numeric presentation. |
| `components/ui/Num.tsx` | Server-compatible | Western-Arabic numeric presentation using `en-IN` grouping. |
| `components/ui/Reveal.tsx` | Client | Scroll-reveal wrapper (IntersectionObserver + 2s fallback, reduced-motion safe). |
| `components/ui/StatCard.tsx` | Server-compatible | Compact statistic panel. |
| `components/ui/StatusBadge.tsx` | Server | Localised pending or confirmed status badge. |
| `components/ui/use-count-up.ts` | Client hook | Eased count-up hook for stat displays. |
| `components/verify/ScanViewfinder.tsx` | Client | Demo viewfinder (hex QR, corner brackets, scan line, status chip). |
| `components/verify/VerifyLookup.tsx` | Client | Public verification-code or UID lookup and result display. |

## 6. Routes

These are the application page routes. The locale segment is represented by `[locale]`.

| Route | Rendering | Authorization |
|-------|-----------|---------------|
| `/[locale]` | Dynamic | Public — marketing homepage |
| `/[locale]/about` | Dynamic | Public — origin, partnership, leadership, values, visit |
| `/[locale]/gallery` | Dynamic | Public — filterable gallery + lightbox |
| `/[locale]/interest` | Dynamic | Public — lead-capture form (audited, server action) |
| `/[locale]/verify` | Dynamic | Public — code/UID lookup (rate-limited API) + demo viewfinder |
| `/[locale]/login` | Dynamic | Public |
| `/[locale]/register` | Dynamic | Public — investor registration (+ `/register/profile`) |
| `/[locale]/portal` | Dynamic | Investor |
| `/[locale]/portal/invest` | Dynamic | Investor — submit investment request (new shares or payment-done report) |
| `/[locale]/portal/account` | Dynamic | Investor — account details (name, NID, email; phone read-only) |
| `/[locale]/portal/password` | Dynamic | Investor — change password |
| `/[locale]/portal/receipts/[id]` | Dynamic | Investor; the investor must own the record |
| `/[locale]/admin` | Dynamic | Staff — dashboard, shareholder register |
| `/[locale]/admin/register` | Dynamic | Staff |
| `/[locale]/admin/requests` | Dynamic | Staff — approval queue |
| `/[locale]/admin/requests/[id]` | Dynamic | Staff — request review/approve/reject |
| `/[locale]/admin/leads` | Dynamic | Staff — interest-lead pipeline |
| `/[locale]/admin/settings` | Dynamic | Staff — share price, incentive, targets |
| `/[locale]/admin/receipts/[id]` | Dynamic | Staff |

`/` is static (redirects to the default locale). The API routes under `app/api/investments/` are not page routes and are not included in this table.

## 7. Decisions taken that the brief left open

### Receipt language is always English

The receipt is always English, regardless of viewer locale. It is a bank-facing financial document. `amountInWords()` in `lib/money.ts` is English-only with no Bangla implementation, and the PDF path uses PDFKit built-in fonts that cannot render Bengali glyphs. A Bangla screen receipt paired with an English PDF for the same record would be worse than one consistent document.

The implementation pins the namespace with:

```ts
getTranslations({ locale: 'en', namespace: 'receipt' })
```

The `receipt` keys in `messages/bn.json` deliberately hold identical English text to keep key parity honest. They are never used for a Bangla receipt; a translator must not “fix” these keys.

**Human confirmation required:** TODO(architect): confirm that the bank-facing receipt must remain English for all viewer locales.

### Confirmation moved from `/verify` into the authenticated portal

The public verify endpoint deliberately returns no internal record `id`, so the page cannot call the confirm route. The old prototype let anyone holding a verification code confirm a record. Confirmation now requires investor authentication and a server-side ownership check. `/verify` shows the pending record and links to `/portal` to sign in.

**Human confirmation required:** TODO(architect): confirm the authenticated-portal confirmation policy and removal of public confirmation.

### Admin links are outside the global site header

Admin links are not in the global site header. Putting them there would force the header to read auth state on every request, which would opt the public landing page out of static rendering, and would advertise admin routes in public HTML. Admin has its own sub-navigation inside `app/[locale]/admin/layout.tsx`.

**Human confirmation required:** TODO(architect): confirm that admin navigation should remain confined to the admin layout.

### The ledger has no delete action

There is no delete action anywhere. The prototype had a row `✕` that destroyed a record client-side. The ledger is append-only and `AGENTS.md` forbids it.

**Human confirmation required:** TODO(architect): confirm the append-only ledger policy and permanent removal of delete UI.

### Filters and pagination use URL state

Filters and pagination are URL state, not React state. The admin table uses a plain GET form, so a filtered view is linkable, back-button correct, and works without JavaScript.

**Human confirmation required:** TODO(architect): confirm URL-state filtering and pagination as the intended admin interaction model.

### The register calculation panel is a preview

The register form's calculation panel is a preview only. The submitted amount and category are always recomputed server-side; a client-supplied category or amount is never trusted.

**Human confirmation required:** TODO(architect): confirm that the server-recomputed amount and category are the authoritative values.

## 8. Deviations from the reference prototype

- The `GoalBanner` decorative watermark uses a flat honey fill at 14% opacity instead of the reference's conic-gradient. The implementation is the `bg-honey` hexagon with `opacity-[0.14]`.
- The verify result card shows only the five fields returned by the public endpoint: UID, code, shares, amount, and deposit date, along with investor name, category, and status. The prototype's incentive, method, reference, and “confirmed on” rows are absent because the public result does not return them.
- The QR row action links to the record page with `?qr=1` rather than generating a QR data URL for every table row. The record page generates the QR data URL and opens the modal from that query value.

## 9. Bangla translation: native-speaker review required before launch

**The Bangla catalog was drafted in this pass and must be reviewed by a native speaker before launch.** This is investor-facing financial content, so accuracy matters more than for marketing copy.

The following were deliberately left untranslated:

- Brand names: “Neobee Hospital PLC”, “NEOBEE”, and “NeoTech”.
- Person names.
- Place names: Panchlaish and Chattogram Medical College.
- All numerals and `৳` figures.
- The literal patterns `NB-XXXXXX`, `NEO-0001`, and `01700-000000`.
- The tokens “QR” and “PNG”.
- The entire `receipt` namespace.

TODO(architect): obtain native-speaker review sign-off for `messages/bn.json` before launch.

## 10. Accessibility

The implemented accessibility behavior includes:

- Global `:focus-visible` styling using `--color-honey`.
- `prefers-reduced-motion` handling that disables transitions and animations and turns off smooth scrolling.
- The QR modal's `role="dialog"`, `aria-modal`, `aria-labelledby`, Escape-to-close behavior, and focus restoration.
- A table `<caption>` and `scope="col"` on table headers.
- `role="progressbar"` with value attributes on both progress bars.
- `role="status"` with `aria-live="polite"` for status messages.
- `role="alert"` for errors.
- `aria-invalid` and `aria-describedby` on every register-form field that can show an error.

## 11. Print

The `@media print` rules in `app/globals.css` set the page margin to `14mm`, make the body white, hide `.no-print`, `header`, and `footer`, and make `.print-static` static with no background or padding. Descendants of `.print-static` have shadows removed. `.print-static` and its descendants use the line token for borders, while `.border-0` and `.border-none` remain borderless.

Receipt QR images are plain `<img>` elements with a single-line ESLint suppression rather than `next/image`. The optimizer cannot process a `data:` URI, and `next/image` wrapper markup breaks the print layout. The QR must render at an exact physical size to stay scannable.

## 12. Known gaps and what is not built

- ~~There is no admin UI for editing settings.~~ Resolved: the admin settings UI exists at `/admin/settings` (`SettingsForm` + server action) editing the runtime `Setting` rows.
- `lib/link-investor.ts` was added this pass to populate `Investor.authUserId` after OTP verification, which makes the portal reachable. It refuses to overwrite an existing different non-null `authUserId`, because that would be an account-takeover path. This new server-side behavior introduced by the frontend pass should be reviewed.
- The OTP flow has not been exercised against a live Supabase project with real SMS; the demo login buttons (seeded accounts) are the verified path. `scripts/check-env.mjs` also reported the configured anon key being rejected (HTTP 401) by the project URL on the reference machine — fix that pair before live OTP testing.
- The marketing pages were browser-verified (desktop EN + BN screenshots judged against the reference prototype, and the lead form exercised end to end). The portal and admin console have not had the same visual pass against the z.ai prototype's dashboard views.
- No component tests were added. The 111 passing tests are the backend unit tests (money, requests, validation, settings, receipt).
- The two blocking business rules from the backend pass remain unresolved: donation-percentage payout mechanics and profit-sharing/distribution mechanics.

## 13. Verification commands

Run these from `D:\Work\Neobee-web-app`:

```sh
pnpm install
pnpm lint
pnpm test
pnpm exec tsc --noEmit
pnpm build
```

Expected results:

- `pnpm lint` completes with zero errors (it also runs the i18n and env parity guards).
- `pnpm test` reports 111 passing tests in 5 files.
- `pnpm exec tsc --noEmit` completes cleanly.
- `pnpm build` succeeds without the database or Supabase environment variables because database-reading pages are dynamic and clients read configuration lazily.

Verify catalog key parity and the namespace roots with:

```sh
node -e "const f=o=>Object.entries(o).flatMap(([k,v])=>typeof v==='object'&&v?f(v).map(s=>k+'.'+s):[k]);const a=f(require('./messages/en.json'));const b=f(require('./messages/bn.json'));console.log('en keys',a.length,'bn keys',b.length,'parity',a.length===b.length&&a.every((k,i)=>k===b[i]));console.log(Object.keys(require('./messages/en.json')).join(', '))"
```

It must report 519 keys for each catalog and `parity true`, with the namespace roots `meta, brand, nav, footer, common, categories, statuses, landing, about, gallery, progress, receipt, qr, methods, verify, interest, admin, login, register, invest, portal, auth`.

Verify that the Bangla catalog contains no Bengali digit characters:

```sh
grep -c "[০-৯]" messages/bn.json
```

This must return `0`.
