# Neobee Hospital PLC — Operator Runbook

This guide is for the person setting up, deploying, and accepting the Neobee stakeholder portal.

## First-time setup

### 1. Create a Supabase project

1. Go to [https://app.supabase.com](https://app.supabase.com) and create a new project.
2. Pick a strong database password and save it in a password manager.
3. Wait for the project to finish provisioning.

### 2. Enable Email OTP auth

1. In your Supabase project, go to **Authentication → Providers**.
2. Find **Email** and enable it.
3. Turn on **Enable Email OTP** / “Email” sign-in (the portal is passwordless).
4. Configure the email template(s):
   - **Magic Link / OTP email**: the default template works for local testing.
   - For production, set up a custom SMTP sender under **Authentication → SMTP** so emails come from your domain instead of Supabase’s shared sender. Supabase’s default email sender has low rate limits and may land in spam.

### 3. Configure redirect URLs

1. Go to **Authentication → URL Configuration**.
2. Set **Site URL** to the value you will use for `NEXT_PUBLIC_SITE_URL`:
   - Local: `http://localhost:3000`
   - Production: your production domain, e.g. `https://neobee.example.com`
3. Add the callback redirect URL:
   - `${SITE_URL}/auth/callback`
   - For local: `http://localhost:3000/auth/callback`
   - For production: `https://neobee.example.com/auth/callback`

### 4. Copy connection strings and keys into `.env`

```bash
cp .env.example .env
```

Fill in the six values from Supabase:

```dotenv
# Supabase Postgres
DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"
DIRECT_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"

# Supabase project
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# App
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
```

- Use the **pooler/transaction** connection string for `DATABASE_URL` in serverless/production environments.
- Use the **direct** connection string for `DIRECT_URL` (Prisma migrations need a direct connection).
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only; never add it to `NEXT_PUBLIC_` vars.

### 5. Run migrations

For the first local setup, create the migration and apply it:

```bash
npx prisma migrate dev --name init
```

For subsequent deploys and production:

```bash
npx prisma migrate deploy
```

Then generate the Prisma client:

```bash
npx prisma generate
```

### 6. Seed the first admin

`/admin` is gated by rows in the `Admin` table, so you must create at least one admin before anyone can access the admin dashboard.

#### Option A — Prisma Studio (easiest)

```bash
npx prisma studio
```

1. Open `http://localhost:5555`.
2. Click the **Admin** model.
3. Click **Add record**.
4. Enter the operator’s email address.
5. Choose `ADMIN` or `SUPERADMIN` for `role`.
6. Save.

#### Option B — SQL

In the Supabase SQL Editor, run:

```sql
INSERT INTO "Admin" (email, role)
VALUES ('operator@example.com', 'ADMIN');
```

Replace `operator@example.com` with the real operator email.

> **How the admin link works**: the `Admin.authUserId` column starts empty. When that email address signs in via OTP for the first time, the login flow links the Supabase `user.id` to the matching `Admin` row by email. After that, the admin is fully authenticated.

### 7. Start the app

```bash
npm run dev
```

Open `http://localhost:3000`.

---

## Deploying to Vercel

1. Push the repository to GitHub/GitLab/Bitbucket.
2. Create a new Vercel project and import the repo.
3. In **Project Settings → Environment Variables**, add all six variables from `.env`:
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SITE_URL`
4. Set `NEXT_PUBLIC_SITE_URL` to the production domain, e.g. `https://neobee.example.com`.
5. Set `DATABASE_URL` to the **Supabase connection pooler / transaction** connection string (serverless-friendly). Use `DIRECT_URL` for migrations.
6. (Optional but recommended) Add a build command that runs migrations before the build:
   ```bash
   npx prisma migrate deploy && next build
   ```
   If you prefer, run `npx prisma migrate deploy` manually once after the database is created and before the first deploy goes live.
7. Ensure Supabase Auth redirect URLs include the production `/auth/callback` URL.

---

## Acceptance checklist

Run this end-to-end once real Supabase credentials are wired. Placeholder credentials will let the build pass, but the auth flow cannot complete.

1. **Sign up**
   - Visit `/signup`.
   - Fill in a real email, name, phone, NID, and number of shares.
   - Submit.
   - **Expected**: redirect to `/signup/success` showing an issued `NEO-####` and `NB-XXXXXX`; an OTP email arrives within a minute or two.

2. **Log in with OTP**
   - Visit `/login` and enter the same email.
   - Submit.
   - Enter the OTP from the email at `/login/verify`.
   - **Expected**: redirect to `/dashboard`.

3. **Stakeholder dashboard confirmation**
   - On `/dashboard`, locate the new investment.
   - **Expected**: shares, amount, category, and `Pending` status are correct.
   - Click **“confirm my details”**.
   - **Expected**: status flips to `Confirmed`; an `AuditLog` row is created with actor `"self"`.

4. **Receipt and PDF**
   - Open the digital receipt at `/dashboard/receipt/NEO-####`.
   - **Expected**: correct amount, amount-in-words, QR code, verification code, and branding footer.
   - Click **Download PDF** (or open `/dashboard/receipt/NEO-####/pdf`).
   - **Expected**: a branded PDF containing the same receipt data.

5. **Public verification**
   - Visit `/verify`.
   - Enter the `NB-XXXXXX` code, the `NEO-####` ID, or paste the raw QR string.
   - **Expected**: the page returns name, category, shares, amount, and status only. It must **not** expose phone, email, NID, payment reference, deposit method, deposit date, or notes.

6. **Admin dashboard**
   - Sign in as the seeded admin email via `/login`.
   - Visit `/admin`.
   - **Expected**: aggregate stats plus the new stakeholder in the table.
   - Test search/filter.
   - Click the stakeholder row to edit at `/admin/[investmentId]`.
   - Change the number of shares and save.
   - **Expected**: amount and category recomputed; an `AuditLog` row is created with actor equal to the admin’s ID.
   - Use **“Add stakeholder”** at `/admin/add` to create a record manually.
   - Use the **“Resend receipt”** action.
   - **Expected**: an audit row is logged for the resend.

7. **Horizontal access denied — stakeholder A cannot see stakeholder B’s receipt**
   - Logged in as stakeholder A, request `/dashboard/receipt/{someone-elses-NEO-id}`.
   - **Expected**: `404 Not Found` (not the other stakeholder’s receipt).

8. **Admin access denied — non-admin stakeholder**
   - Logged in as a stakeholder, visit `/admin`.
   - **Expected**: redirect to `/login` with an access-denied notice (or simply denied).

---

## Known deferrals

- **QR code content**: the QR currently encodes a prototype pipe-delimited string (`NEOBEE HOSPITAL PLC | VERIFY | CODE:...`) rather than a scannable `https://.../verify?code=...` URL. It is verifiable by copying the string into `/verify`, but it is not yet camera-scannable as a URL.
- **Admin dashboard language**: the admin interface is English-only for v1.
- **Resend receipt email**: “Resend receipt” logs an audit entry and attempts to email the stakeholder. Reliable delivery requires configuring a custom SMTP sender in Supabase; until then, it relies on Supabase’s default email sender.
- **Email sender**: email OTP uses Supabase’s built-in sender until SMTP is configured. For production volumes and deliverability, configure a custom SMTP provider.

---

## Admin password auth + soft-delete (added feature)

This release swaps the admin login from stakeholder-style email OTP to email+password, and adds soft-delete columns to `Stakeholder` and `Investment`.

### 1. Database migration for soft-delete

After pulling these changes, the schema gains `deletedAt DateTime?` on `Stakeholder` and `Investment` (with an index), plus an `authUserId String? @unique` on `Admin`. Apply the migration:

```bash
# Local — creates a new migration file and applies it
npx prisma migrate dev --name add-soft-delete-and-admin-auth

# Production / any pre-existing DB — apply pending migrations only
npx prisma migrate deploy
```

> **DIRECT_URL must be set** for `migrate dev` / `migrate deploy` to work. Prisma uses the direct (non-pooler) connection string when running migrations; `DATABASE_URL` (pooler/transaction) is for runtime queries.

Then regenerate the client (usually automatic with `migrate dev`, but explicit is fine):

```bash
npx prisma generate
```

Records that were hard-deleted before this change are, of course, still gone — soft-delete only protects records deleted from this point forward.

### 2. Seeding the first admin (email + password)

The admin no longer signs in via OTP. Instead, an admin must exist as **both**:

- (a) a Supabase Auth user with a password, and
- (b) an `Admin` row in Postgres with a matching email, linked via `authUserId`.

The `npm run seed:admin` script handles both halves in one go. It reads:

| Env var | Required | Default | Purpose |
| --- | --- | --- | --- |
| `SEED_ADMIN_EMAIL` | yes | — | The admin’s email / login. |
| `SEED_ADMIN_PASSWORD` | yes | — | The admin’s password (strong, not committed). |
| `SEED_ADMIN_ROLE` | no | `SUPERADMIN` | `ADMIN` or `SUPERADMIN`. |

Plus the usual runtime env vars: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` / `DIRECT_URL`.

Run it once per admin you want to provision (or re-run to reset a password — re-running upserts the link, but does not change the Supabase user’s existing password; to change a password, use `/admin/security` while signed in, or the reset flow):

```bash
SEED_ADMIN_EMAIL="you@example.com" \
SEED_ADMIN_PASSWORD="a-strong-password" \
SEED_ADMIN_ROLE="SUPERADMIN" \
npm run seed:admin
```

The script will:

1. Create the Supabase Auth user with `email_confirm: true` (so they can log in immediately, no verification email needed), or reuse an existing one if the email is already registered.
2. Upsert the `Admin` row with that email and pre-link `authUserId`.
3. Print a summary including whether the Supabase user and Admin row were created or already existed.

Then the admin signs in at `/admin/login` using email + the `SEED_ADMIN_PASSWORD` you set.

> ⚠️ **Keep `SEED_ADMIN_PASSWORD` out of source control.** Put it in your local `.env`, in a password manager, or in your Vercel project settings as a one-off environment variable when you run the seed — never in `package.json` or a committed `.env*` file. Use a strong, unique password; rotate it via `/admin/security` (or the forgot/reset flow) rather than re-running the seed with a new password.

> **Two separate logins:** `/admin/login` (password) is for admins only. `/login` (OTP) is still used by stakeholders and remains unrelated to the admin table.

### 3. 15-day login sessions (Supabase dashboard setting)

Session length is **not** controlled by code in this repo — it is a Supabase project setting. The intent is: log in once, stay signed in for ~15 days without re-entering an OTP or password, and let the short-lived access token be silently refreshed in the background.

In the Supabase dashboard for your project:

1. Go to **Authentication → Sessions** (sometimes labelled **Auth → Sessions / Time-box**).
2. Find the **Time-box user sessions** (a.k.a. session timebox / max session lifetime) setting and set it to **360 hours (15 days)**. This is the hard cap: after this many hours from sign-in, the user is forced to sign in again.
3. If you also want inactivity-based expiry, find the **Inactivity timeout** / refresh-token inactivity setting and set it to the same 15-day value (or whatever idle period you prefer). This logs the user out if the refresh token is not used for the configured window.
4. Leave the **Access token (JWT) expiry** at its short default (~3600s / 1 hour). That is fine and intentional: the access token is silently replaced by the refresh token while the session is active, so the user does not notice it.

> If the exact dashboard label names have changed (Supabase iterates on these), look for the setting described by **function** rather than exact label: “how long can a signed-in user keep their session alive without re-authenticating?” Set that to 15 days; leave the access-token expiry short.

Result: an admin signs in once and stays signed in for up to 15 days, even though the access token they carry is rotated every hour in the background.

### 4. Admin password flows (routes)

For the operator’s awareness, the new admin auth surface is:

| Route | Purpose |
| --- | --- |
| `/admin/login` | Email + password sign-in. |
| `/admin/forgot` | Request a password-reset email (Supabase `resetPasswordForEmail`). |
| `/admin/reset` | Set a new password from the reset link — must be opened from the reset email so a valid reset session is active. |
| `/admin/security` | Change the current admin’s password while signed in (requires the current password for confirmation). |

All three email-touching routes (`/admin/forgot`, `/admin/reset`, and the password-change confirmation emails) depend on Supabase email delivery being configured. If you have not already, set up **Authentication → SMTP** with a custom sender so reset / forgot emails actually arrive — the same caveat applies as for stakeholder OTP. Until then, emails will be sent from Supabase’s shared sender and may be slow or land in spam.
