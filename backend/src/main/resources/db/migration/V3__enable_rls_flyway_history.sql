-- Supabase linter: "Table public.flyway_schema_history is public, but RLS has not been enabled."
-- La tabla es interna de Flyway y no debe ser accesible via PostgREST (anon/authenticated).
-- ENABLE RLS sin policies = deniega todo acceso via API. El owner (postgres / Flyway) hace bypass de RLS igual.
ALTER TABLE IF EXISTS public.flyway_schema_history ENABLE ROW LEVEL SECURITY;

-- Defense in depth: revocar privilegios de API si los roles existen (existen en Supabase, no en Docker local).
REVOKE ALL ON TABLE public.flyway_schema_history FROM PUBLIC;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        EXECUTE 'REVOKE ALL ON TABLE public.flyway_schema_history FROM anon';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        EXECUTE 'REVOKE ALL ON TABLE public.flyway_schema_history FROM authenticated';
    END IF;
END $$;
