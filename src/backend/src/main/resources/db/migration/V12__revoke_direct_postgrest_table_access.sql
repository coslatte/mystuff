DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON TABLE song, comment, rating, contact_messages,
            contact_deliveries, contact_rate_limits, shared_track, flyway_schema_history
            FROM anon;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON TABLE song, comment, rating, contact_messages,
            contact_deliveries, contact_rate_limits, shared_track, flyway_schema_history
            FROM authenticated;
    END IF;
END
$$;
