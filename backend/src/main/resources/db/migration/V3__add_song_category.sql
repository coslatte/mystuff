ALTER TABLE song ADD COLUMN IF NOT EXISTS category VARCHAR(20) NOT NULL DEFAULT 'official';

ALTER TABLE song DROP CONSTRAINT IF EXISTS chk_song_category;
ALTER TABLE song ADD CONSTRAINT chk_song_category CHECK (category IN ('wip', 'official'));
