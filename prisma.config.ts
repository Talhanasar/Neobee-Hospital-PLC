import { defineConfig } from "prisma/config";

try {
  // Prisma 7 stopped auto-loading .env, so load it manually when present.
  process.loadEnvFile();
} catch {
  // no .env file
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // DIRECT_URL is an optional override (pooled DATABASE_URL needs a direct
    // connection for Migrate); when unset, migrations use DATABASE_URL.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
  // Seeding is driven by `pnpm db:seed` (see package.json), which runs both
  // prisma/seed.ts and prisma/seed-demo.ts directly via tsx with env loaded.
  // Do not define migrations.seed here — it would create a competing path
  // through `prisma db seed` that cannot chain both scripts reliably.
});
