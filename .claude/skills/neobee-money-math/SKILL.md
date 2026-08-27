---
name: neobee-money-math
description: Covers Neobee's share price, category thresholds, entrepreneur incentive formula, UID and verification-code formats, and integer-money rules. Read this whenever an agent touches money calculations, share counts, category derivation, ID/code generation, or amount formatting in this repo.
---

All money is integer BDT (whole taka). Never use floats, JS `Decimal`, or paisa subunits — arithmetic in this domain never produces fractional taka.

## Configurable settings

| Setting key | Default value | Meaning |
|-------------|---------------|---------|
| `SHARE_PRICE` | 200000 | Price of one share in BDT (৳2,00,000) |
| `INCENTIVE_PER_SHARE` | 20000 | Bonus BDT per share, founding entrepreneurs only (৳20,000) |
| `TARGET_AMOUNT` | 3000000000 | Full project target in BDT (৳300 crore) |
| `TARGET_SHARES` | 15000 | Total shares at target |
| `FOUNDING_AMOUNT` | 100000000 | Founding-phase target in BDT (৳10 crore) |
| `TARGET_ENTREPRENEURS` | 50 | Founding entrepreneur slots |

## Fixed structural constants

| Constant | Value |
|----------|-------|
| Category `SHAREHOLDER` | 1 to 4 shares |
| Category `PREMIUM` | 5 to 9 shares |
| Category `DIRECTOR` | 10 or more shares |
| `ENTREPRENEUR_MIN_SHARES` | 10 |

## The price-snapshot rule

Because an administrator can change `SHARE_PRICE` and `INCENTIVE_PER_SHARE` at any time, every `Investment` row stores its own `sharePrice` and `incentivePerShare` at the moment of registration. All historical amounts are computed from the snapshot on the row, never from the current live setting. Recomputing a past investment against today's price would silently rewrite financial history, so a price change affects only investments registered after it.

Never import a live setting to recompute an existing record's amount.

## Pure-function contracts

Money math lives in one pure, server-side, fully unit-tested module. Every function takes the price/incentive it needs as an explicit parameter — it never reads a global or hits the database.

| Function | Signature | Behavior |
|----------|-----------|----------|
| `deriveCategory` | `deriveCategory(shares: number): Category` | Applies the thresholds above. Derived and stored server-side; a client-supplied category is always ignored. |
| `calculateAmount` | `calculateAmount(shares: number, sharePrice: number): number` | `shares * sharePrice`. |
| `calculateIncentive` | `calculateIncentive(shares: number, isEntrepreneur: boolean, incentivePerShare: number): number` | Returns `shares * incentivePerShare` when `isEntrepreneur` is true, otherwise `0`. |
| `generateVerificationCode` | `generateVerificationCode(): string` | Returns a verification code. |
| `amountInWords` | `amountInWords(amount: number): string` | Returns amount in words using Bangladeshi/Indian numbering system. |

## The entrepreneur rule

`isEntrepreneur` may only be true when `shares >= 10` (`ENTREPRENEUR_MIN_SHARES`). Validation must reject the flag below 10 shares. The smallest possible incentive is 10 × `INCENTIVE_PER_SHARE`.

## Fixed share price only

An investment is always a whole number of shares multiplied by the share price. There is no free-amount or partial-share investment. The price itself is administrator-configurable, but any single investment's amount is always an exact multiple of the share price in effect when it was registered.

## Identifier formats

- **Unique ID**: `NEO-0001` — prefix `NEO-` followed by sequential integer zero-padded to at least 4 digits.
- **Verification code**: `NB-XXXXXX` — prefix `NB-` followed by exactly 6 characters from alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. This alphabet excludes `I`, `O`, `0`, and `1` because these characters are routinely confused when typed by hand from a printed receipt.

Warning: The prototype generated both by scanning an in-memory array for collisions (`investments.some(...)`). That is unsafe on a real server under concurrent requests. UID must come from a database sequence; the verification code must rely on a database unique constraint with retry-on-conflict. Never a read-then-write check.

## Amount in words

Bangladeshi/Indian numbering — crore, lakh, thousand, hundred — not Western million/billion grouping.

| Amount | Words |
|--------|-------|
| 200000 | "Two lakh" |
| 2000000 | "Twenty lakh" |
| 100000000 | "Ten crore" |
| 3000000000 | "Three hundred crore" |
| 0 | "zero" |

This string is printed on a receipt that functions as a quasi-legal document, so the function is unit-tested rather than eyeballed.

## Testing requirements

- Category boundaries must be tested at exactly 4, 5, 9, and 10 shares.
- Incentive must be tested with and without the entrepreneur flag, and at the 10-share boundary.
- `amountInWords` must be tested at each place-value rollover and at zero.