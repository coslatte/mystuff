CREATE TABLE IF NOT EXISTS song (
    id          BIGSERIAL PRIMARY KEY,
    title       VARCHAR(200) NOT NULL,
    artist      VARCHAR(200) NOT NULL,
    audio_url   VARCHAR(500),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comment (
    id          BIGSERIAL PRIMARY KEY,
    song_id     BIGINT NOT NULL REFERENCES song(id) ON DELETE CASCADE,
    author      VARCHAR(100) NOT NULL,
    content     VARCHAR(1000) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rating (
    id          BIGSERIAL PRIMARY KEY,
    song_id     BIGINT NOT NULL REFERENCES song(id) ON DELETE CASCADE,
    stars       INT NOT NULL CHECK (stars BETWEEN 1 AND 5),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comment_song_id ON comment(song_id);
CREATE INDEX IF NOT EXISTS idx_rating_song_id ON rating(song_id);
