---
name: neobee-ledger-conventions
description: Covers the Investment / Transaction / InstallmentSchedule relationship, the immutable-ledger rule, the signed-amount convention, the denormalized amount cache, and required audit fields. Read this whenever an agent touches the ledger, transactions, corrections, refunds, audit logging, or the Investment amount field.
---

## Model relationships

An `Investor` links 1:1 to a Supabase Auth user and owns many `Investment` records. An `Investment` owns many `Transaction` rows (the ledger) and many `InstallmentSchedule` rows. `InstallmentSchedule` is deliberately a separate table and must never be folded into `Transaction`.

## Ledger rows are immutable

A `Transaction` row is never updated or deleted after creation. A correction is a NEW row that points at the original through a nullable `relatedTransactionId`. Reason: an audit trail that can be edited is not an audit trail.

No role may `DELETE` an `Investment` or a `Transaction`. If a record must be withdrawn, that is a status change plus a reason, never a deletion.

## Signed-amount convention

`Transaction.amount` is a signed integer.

| Type | Sign | Affects principal? | Meaning |
|------|------|-------------------|---------|
| `DEPOSIT` | positive | yes | Investor money received against shares |
| `REFUND` | negative | yes | Money returned to the investor |
| `CORRECTION` | either sign | yes | Fixes an earlier mistaken row; references it via `relatedTransactionId` |
| `DISTRIBUTION` | negative | NO | Profit or donation paid out to the investor |

## The principal-cache rule

`Investment.amount` is a denormalized, server-computed cache — it is NOT the source of truth once transactions exist. It equals the sum of that investment's `DEPOSIT`, `REFUND`, and `CORRECTION` rows. `DISTRIBUTION` rows are deliberately EXCLUDED, because a profit payout is not a reduction of the investor's principal — including it would make a fully-paid investor appear to have invested less.

Mechanical rule: recompute `Investment.amount` inside the same database transaction that writes the ledger row, from the ledger rows themselves. Never increment it in place, and never trust a figure computed at registration time and left alone afterward.

## Note on unbuilt types

Only `DEPOSIT` is exercised in v1. `REFUND`, `CORRECTION`, and `DISTRIBUTION` exist in the enum so that adding their workflows later is not a breaking migration. Do not build refund, correction, or distribution logic until it is specified.

## InstallmentSchedule is intentionally under-specified

It belongs to an `Investment` and carries a status, a due date, and an amount. `AGENTS.md` §3 lists the profit-sharing and donation-percentage mechanics as OPEN — not yet specified. Therefore: the schema exists so the eventual real mechanics do not require a destructive migration, but no distribution or profit-sharing LOGIC is to be written until a human specifies the rules. Anyone who finds themselves inventing a payout formula has left this skill's scope and must stop and ask.

## Audit logging is mandatory

Every state-changing operation writes an `AuditLog` row in the same database transaction as the change itself, so a failed write cannot leave an unlogged mutation or a logged phantom one. Required fields: the actor (staff id or investor id), the action, the target record type, the target record id, a timestamp, and the request IP when available.

Operations that must log:
- Registering an investment
- An investor confirming their record
- Any settings change by an administrator
- A public verification lookup
- Any file upload or deletion

Note: this is a financial product, so audit logging is not a feature that can be deferred or traded away for simplicity.

## Transaction boundaries

Any operation writing more than one table runs inside a single interactive database transaction. Registering an investment writes `Investment` + `Transaction` + `AuditLog` and recomputes the amount cache — all or nothing.

## Open questions must stop work

Business rules `AGENTS.md` §3 and §6 still leave open:
- Donation-percentage payout mechanics
- Profit-sharing and distribution mechanics
- Free-amount versus fixed-price investment (now settled as fixed-price with an admin-configurable price)

An agent hitting one of these must stop and ask rather than picking a plausible option.