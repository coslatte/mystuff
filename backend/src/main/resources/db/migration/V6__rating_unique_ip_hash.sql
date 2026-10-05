-- V4 added ip_hash but only constrained (song_id, visitor_id), so two
-- visitorIds from one network could each insert a row for the same song. This
-- closes that. Visitors sharing a NAT address now share a single vote per song.
--
-- Dedupe first: any database that accepted votes under V4 can already hold
-- several rows per (song_id, ip_hash), and a bare CREATE UNIQUE INDEX would
-- abort the migration on exactly those rows. The newest row wins; the discarded
-- ones were duplicates of the same physical visitor.
DELETE FROM rating r
    USING rating keep
    WHERE r.song_id = keep.song_id
      AND r.ip_hash IS NOT NULL
      AND r.ip_hash = keep.ip_hash
      AND (r.created_at, r.id) < (keep.created_at, keep.id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_rating_song_ip
    ON rating (song_id, ip_hash) WHERE ip_hash IS NOT NULL;