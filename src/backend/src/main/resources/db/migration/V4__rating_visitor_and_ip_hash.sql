ALTER TABLE rating ADD COLUMN IF NOT EXISTS visitor_id VARCHAR(80);

CREATE UNIQUE INDEX IF NOT EXISTS uq_rating_song_visitor
    ON rating (song_id, visitor_id) WHERE visitor_id IS NOT NULL;

ALTER TABLE rating ADD COLUMN IF NOT EXISTS ip_hash VARCHAR(64);
