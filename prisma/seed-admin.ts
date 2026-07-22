/**
 * prisma/seed-admin.ts
 *
 * One-shot seed for the first (or any additional) admin user.
 *
 * What this script does:
 *   1. Reads SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD / SEED_ADMIN_ROLE from env.
 *   2. Creates (or reuses) a Supabase Auth user with that email + password,
 *      using the SERVICE ROLE key (server-side only — must never reach client).
 *   3. Upserts an Admin row in Postgres with the matching email, role, and
 *      the Supabase user id, so /admin/login works immediately.
 *
 * How to run:
 *   - Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in your shell (or .env loaded
 *     into the shell) and run:  npm run seed:admin
 *   - This is a STANDALONE script. It is NOT Prisma's auto-seed (package.json
 *     has no `prisma.seed` entry). Run it manually as needed.
 *
 * IMPORTANT: never log the password, and never commit a real
 * SEED_ADMIN_PASSWORD to source control.
 */

// SERVICE ROLE key is server-only here. It must NEVER reach client code.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PrismaClient, AdminRole } from "@prisma/client";

type CreateResult =
  | { kind: "created"; userId: string }
  | { kind: "existing"; userId: string };

async function ensureSupabaseAuthUser(
  supabase: SupabaseClient,
  email: string,
  password: string,
): Promise<CreateResult> {
  // Try to create the user first.
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (data?.user?.id) {
    return { kind: "created", userId: data.user.id };
  }

  // If create failed because the user already exists, fall back to listing
  // users and finding a match by email.
  const message = error?.message ?? "";
  const isAlreadyExists =
    /already registered/i.test(message) ||
    /already exists/i.test(message) ||
    /already been registered/i.test(message) ||
    // Supabase sometimes returns this code-shape via the underlying GoTrue error.
    /user_exists/i.test(message);

  if (!isAlreadyExists) {
    // Real failure — surface it.
    throw new Error(
      `Supabase createUser failed: ${error?.message ?? "unknown error"}`,
    );
  }

  // Look up the existing user. listUsers paginates; for our seed-scale usage
  // (one or a handful of admins) iterating a few pages is fine.
  let page = 1;
  const perPage = 100;
  // Hard cap on pages to avoid an infinite loop if something is wrong.
  const maxPages = 50;
  while (page <= maxPages) {
    const { data: list, error: listErr } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (listErr) {
      throw new Error(
        `Supabase listUsers failed: ${listErr.message}`,
      );
    }
    const users = list?.users ?? [];
    const match = users.find(
      (u) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
    );
    if (match?.id) {
      return { kind: "existing", userId: match.id };
    }
    if (users.length < perPage) {
      break;
    }
    page += 1;
  }

  throw new Error(
    `Supabase reported the user already exists, but could not find ${email} in listUsers.`,
  );
}

async function main(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const roleRaw = (process.env.SEED_ADMIN_ROLE ?? "SUPERADMIN").trim();

  if (!email || !password) {
    // Do NOT print the password value, even if one is set.
    console.error(
      [
        "Missing required env vars.",
        "Set the following before running this script:",
        "  SEED_ADMIN_EMAIL   — the admin's email address",
        "  SEED_ADMIN_PASSWORD — the admin's login password (use a strong value)",
        "Optional:",
        "  SEED_ADMIN_ROLE    — ADMIN or SUPERADMIN (default: SUPERADMIN)",
        "",
        "Example:",
        '  SEED_ADMIN_EMAIL="you@example.com" \\',
        '  SEED_ADMIN_PASSWORD="a-strong-password" \\',
        "  npm run seed:admin",
      ].join("\n"),
    );
    process.exit(1);
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      [
        "Missing Supabase env vars.",
        "This script needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
        "(plus DATABASE_URL / DIRECT_URL for the Admin row upsert).",
      ].join("\n"),
    );
    process.exit(1);
  }

  // Validate role against the enum so we fail fast with a clear message.
  const roleUpper = roleRaw.toUpperCase();
  if (roleUpper !== "ADMIN" && roleUpper !== "SUPERADMIN") {
    console.error(
      `Invalid SEED_ADMIN_ROLE "${roleRaw}". Must be ADMIN or SUPERADMIN.`,
    );
    process.exit(1);
  }
  const role = roleUpper as AdminRole;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  const prisma = new PrismaClient();

  try {
    // 1) Make sure the Supabase Auth user exists.
    const authResult = await ensureSupabaseAuthUser(supabase, email, password);
    const authUserId = authResult.userId;

    // 2) Upsert the Admin row, pre-establishing the authUserId link.
    const existing = await prisma.admin.findUnique({ where: { email } });
    const admin = await prisma.admin.upsert({
      where: { email },
      create: { email, role, authUserId },
      update: { authUserId, role },
    });

    const supabaseLine =
      authResult.kind === "created"
        ? "Supabase user: created"
        : "Supabase user: existing";
    const adminLine = existing
      ? "Admin row: updated"
      : "Admin row: created";

    console.log("Admin seed complete.");
    console.log(`  Email:           ${admin.email}`);
    console.log(`  Role:            ${admin.role}`);
    console.log(`  authUserId:      ${admin.authUserId ?? authUserId}`);
    console.log(`  ${supabaseLine}`);
    console.log(`  ${adminLine}`);
    console.log("");
    console.log(
      `Sign in at /admin/login with the email + SEED_ADMIN_PASSWORD.`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`seed-admin failed: ${msg}`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
