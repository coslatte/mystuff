CREATE TABLE contact_messages (
    id UUID PRIMARY KEY,
    submission_id UUID NOT NULL UNIQUE,
    fingerprint VARCHAR(64) NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(254) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE contact_deliveries (
    message_id UUID NOT NULL REFERENCES contact_messages(id) ON DELETE CASCADE,
    channel VARCHAR(16) NOT NULL CHECK (channel IN ('EMAIL', 'TELEGRAM')),
    state VARCHAR(32) NOT NULL DEFAULT 'PENDING'
        CHECK (state IN ('PENDING', 'PROCESSING', 'PROVIDER_ACCEPTED', 'FAILED', 'REQUIRES_REVIEW')),
    payload TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    first_attempt_at TIMESTAMPTZ,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    lease_token UUID,
    lease_expires_at TIMESTAMPTZ,
    provider_id VARCHAR(200),
    failure_code VARCHAR(100),
    outcome_uncertain BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (message_id, channel)
);

CREATE INDEX contact_delivery_due ON contact_deliveries(next_attempt_at)
    WHERE state IN ('PENDING', 'PROCESSING');

CREATE TABLE contact_rate_limits (
    scope VARCHAR(80) NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    count INTEGER NOT NULL CHECK (count > 0),
    PRIMARY KEY (scope, window_start)
);

-- Contact data is backend-only even when Supabase exposes the public schema.
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_rate_limits ENABLE ROW LEVEL SECURITY;
