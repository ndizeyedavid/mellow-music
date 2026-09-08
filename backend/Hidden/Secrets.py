import os
from pathlib import Path

# Root folder location of the project
folderLocation = Path(__file__).parent.parent


def _env(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


class ServerSecrets:
    # Override with FERNET_KEY in production. The default below is a
    # non-secret placeholder for local development only.
    fernetKey = _env(
        "FERNET_KEY",
        "dev-only-insecure-fernet-key-replace-in-production",
    )


class CoreValues:
    appName = "MusicAPI"
    webRoute = "/"
    # Platforms inject PORT; WEB_PORT overrides locally.
    webPort = int(_env("PORT", "") or _env("WEB_PORT", "10020") or 10020)


class DBSecrets:
    # Vector branch: Postgres + pgvector clean slate.
    # Production uses PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE (or PGSSLMODE);
    # DB_* vars are kept as fallback. See DBHolder.
    DBHosts = [
        host.strip()
        for host in (_env("PGHOST", "") or _env("DB_HOSTS", "localhost")).split(",")
        if host.strip()
    ] or ["localhost"]
    DBUser = (_env("PGUSER", "") or _env("DB_USER", "") or "postgres").strip() or "postgres"
    DBPassword = (_env("PGPASSWORD", "") or _env("DB_PASSWORD", "") or "mellow@123").strip()
    DBName = (_env("PGDATABASE", "") or _env("DB_NAME", "") or "mellow_music").strip() or "mellow_music"


class RequiredFiles:
    webServerRunnable = "_server.py"
    webServerRequired = [
        "_server.py",
        "MusicAPI_servers.py",
        "Classes/Holders/DBTables.py",
        "Classes/Holders/FileInvolved.py",
        "Classes/Holders/UrlTypes.py",
        "Classes/Processors/DBHolder.py",
        "Classes/Processors/FileCache.py",
        "Classes/Processors/MySQLPool.py",
        "Classes/Processors/PostgresPool.py",
        "Classes/Processors/EmbeddingService.py",
        "Classes/Processors/SongData.py",
        "Classes/Processors/SongProcessor.py",
        "Classes/Processors/SpotifyAPI.py",
        "Classes/Processors/URLHandler.py",
        "Classes/Processors/WSGIElements.py",
        "Classes/Processors/YTDLP.py",
        "Hidden/dynamicWebsite.py",
        "Hidden/Secrets.py",
        "schema.sql",
    ]
