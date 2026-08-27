-- Supabase compatibility shim for vanilla Postgres
-- Provides the minimal Supabase Auth objects that 1_rls migration policies depend on.
-- Idempotent: safe to run multiple times.

-- 1. Roles used by RLS policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOINHERIT BYPASSRLS;
  END IF;
END
$$;

-- 2. auth schema and auth.uid() function
CREATE SCHEMA IF NOT EXISTS auth;

-- Supabase sets request.jwt.claims via a GUC when using the Supabase client.
-- On vanilla Postgres we simulate this with a session-local setting.
-- The function returns the 'sub' claim as text, or NULL if not set.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub';
$$;

-- Grant usage on auth schema to the roles that need it
GRANT USAGE ON SCHEMA auth TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon, service_role;

-- 3. Schema + table privileges.
-- Real Supabase grants table access to anon/authenticated/service_role; RLS then filters rows.
-- Without these grants, SET ROLE authenticated queries fail with "permission denied"
-- before any policy is evaluated. Default privileges cover tables the migrations
-- create AFTER this shim runs; the ON ALL TABLES grants (re-applied post-deploy)
-- cover anything that already exists.
GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO authenticated, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;