-- Mellow Music database schema.
-- Applied automatically at backend startup (idempotent).
-- Charset is utf8mb4 throughout: titles and lyrics are multilingual.

CREATE TABLE IF NOT EXISTS songs (
    song_id VARCHAR(64) NOT NULL PRIMARY KEY,
    real_name VARCHAR(512) NOT NULL DEFAULT '',
    spotify_id VARCHAR(64) NOT NULL DEFAULT '',
    youtube_id VARCHAR(64) NOT NULL DEFAULT '',
    duration DOUBLE NOT NULL DEFAULT 0,
    thumbnail TEXT,
    audio_url MEDIUMTEXT,
    last_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_songs_real_name (real_name(191)),
    INDEX idx_songs_spotify (spotify_id),
    INDEX idx_songs_youtube (youtube_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS aliases (
    song_id VARCHAR(64) NOT NULL,
    string VARCHAR(700) NOT NULL,
    INDEX idx_aliases_string (string(191)),
    INDEX idx_aliases_song (song_id),
    CONSTRAINT fk_aliases_song FOREIGN KEY (song_id)
        REFERENCES songs (song_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS spotify_apis (
    client_id VARCHAR(128) NOT NULL PRIMARY KEY,
    secret VARCHAR(256) NOT NULL,
    owner VARCHAR(128) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
