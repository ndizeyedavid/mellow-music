-- Mellow Music — clean Postgres + pgvector schema
-- Create from blank. Idempotent. Falls back to TEXT if pgvector not installed locally
-- (Aiven has it, Windows local needs manual install) Python brute-force still works

DO $$ BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pgvector not available, falling back to TEXT embeddings';
END $$;

-- Songs: same shape as MySQL version, Postgres types.
CREATE TABLE IF NOT EXISTS songs (
    song_id VARCHAR(64) PRIMARY KEY,
    real_name VARCHAR(512) NOT NULL DEFAULT '',
    spotify_id VARCHAR(64) NOT NULL DEFAULT '',
    youtube_id VARCHAR(64) NOT NULL DEFAULT '',
    duration DOUBLE PRECISION NOT NULL DEFAULT 0,
    thumbnail TEXT,
    audio_url TEXT,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_songs_real_name ON songs (real_name);
CREATE INDEX IF NOT EXISTS idx_songs_spotify ON songs (spotify_id);
CREATE INDEX IF NOT EXISTS idx_songs_youtube ON songs (youtube_id);

CREATE TABLE IF NOT EXISTS aliases (
    song_id VARCHAR(64) NOT NULL REFERENCES songs(song_id) ON DELETE CASCADE,
    string VARCHAR(700) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_aliases_string ON aliases (string);
CREATE INDEX IF NOT EXISTS idx_aliases_song ON aliases (song_id);

CREATE TABLE IF NOT EXISTS spotify_apis (
    client_id VARCHAR(128) PRIMARY KEY,
    secret VARCHAR(256) NOT NULL,
    owner VARCHAR(128) NOT NULL DEFAULT ''
);

-- Taste events: anonymous server-side profile for collaborative + vector taste.
-- anonymous_id comes from frontend mellow_id (random UUID in localStorage).
CREATE TABLE IF NOT EXISTS taste_events (
    id BIGSERIAL PRIMARY KEY,
    anonymous_id VARCHAR(64) NOT NULL,
    song_id VARCHAR(64) NOT NULL REFERENCES songs(song_id) ON DELETE CASCADE,
    event_type VARCHAR(16) NOT NULL CHECK (event_type IN ('play','complete','skip','like','follow','save','playlist_add')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_taste_anon ON taste_events (anonymous_id);
CREATE INDEX IF NOT EXISTS idx_taste_song ON taste_events (song_id);
CREATE INDEX IF NOT EXISTS idx_taste_type ON taste_events (event_type);

-- Song embeddings: 384-dim all-MiniLM vectors for ANN search.
-- Try vector type first, fallback to TEXT (JSON) for local dev without extension.
DO $$ BEGIN
    CREATE TABLE IF NOT EXISTS song_embeddings (
        song_id VARCHAR(64) PRIMARY KEY REFERENCES songs(song_id) ON DELETE CASCADE,
        embedding vector(384) NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
EXCEPTION WHEN OTHERS THEN
    CREATE TABLE IF NOT EXISTS song_embeddings (
        song_id VARCHAR(64) PRIMARY KEY REFERENCES songs(song_id) ON DELETE CASCADE,
        embedding TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
END $$;
DO $$ BEGIN
    CREATE INDEX IF NOT EXISTS idx_song_embeddings_hnsw ON song_embeddings USING hnsw (embedding vector_cosine_ops);
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;
