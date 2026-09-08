import os
import re
import time
from customisedLogs import CustomisedLogs

from Classes.Processors.PostgresPool import PostgresPool
from Hidden.Secrets import DBSecrets, folderLocation


class DBHolder:
    """
    Postgres + pgvector holder. Environment-first with legacy Secrets fallback.
    Supports both PG* and DB* env names (Aiven uses PG*, local uses DB_*).
    Clean start: drops are handled by schema.sql, not here.
    """
    MAX_ROUNDS = 6
    ROUND_DELAY_SECONDS = 5

    def __init__(self, logger: CustomisedLogs):
        self.logger: CustomisedLogs = logger
        self.db: PostgresPool = self.__connect_with_retry()
        self.initialised = True

    @staticmethod
    def __env(name: str, fallback: str = "") -> str:
        return (os.getenv(name) or fallback).strip()

    def __targets(self) -> list[tuple[str, int]]:
        # Prefer PG* (Aiven Postgres), fallback to DB* (legacy MySQL env)
        port_str = self.__env("PGPORT", "") or self.__env("DB_PORT", "5432") or "5432"
        try:
            port = int(port_str)
        except ValueError:
            port = 5432
        hosts_env = self.__env("PGHOST", "") or self.__env("DB_HOSTS", "") or self.__env("DB_HOST", "")
        if hosts_env:
            # PGHOST is single; DB_HOSTS may be comma-separated
            raw = hosts_env
            if "," in raw:
                return [(h.strip(), port) for h in raw.split(",") if h.strip()]
            return [(raw.strip(), port)]
        return [(host, port) for host in DBSecrets.DBHosts]

    def __credentials(self) -> tuple[str, str, str, str | None]:
        user = self.__env("PGUSER", "") or self.__env("DB_USER", DBSecrets.DBUser)
        password = self.__env("PGPASSWORD", "") or self.__env("DB_PASSWORD", DBSecrets.DBPassword)
        name = self.__env("PGDATABASE", "") or self.__env("DB_NAME", DBSecrets.DBName)
        sslmode = self.__env("PGSSLMODE", "") or self.__env("DB_SSLMODE", "") or "prefer"
        if not re.fullmatch(r"[A-Za-z0-9_]+", name):
            raise RuntimeError(f"Refusing unsafe DB_NAME: {name!r}")
        # Also set PGSSLMODE for PostgresPool's helper
        os.environ.setdefault("PGSSLMODE", sslmode)
        return user, password, name, sslmode

    def __connect_with_retry(self) -> PostgresPool:
        user, password, name, sslmode = self.__credentials()
        last_error: Exception | None = None
        for _round in range(self.MAX_ROUNDS):
            for host, port in self.__targets():
                try:
                    pool = PostgresPool(
                        user=user,
                        password=password,
                        dbName=name,
                        host=host,
                        port=port,
                        sslmode=sslmode,
                    )
                    pool.execute("SELECT 1", catchErrors=False)
                    self.__bootstrap(pool, name)
                    self.logger.log(self.logger.Colors.green_800, "DB", f"connected to: {host}:{port} db={name} (postgres)")
                    return pool
                except Exception as exc:
                    last_error = exc
                    self.logger.log(self.logger.Colors.red_500, "DB", f"failed: {host}:{port} ({exc})")
            time.sleep(self.ROUND_DELAY_SECONDS)
        self.logger.log(self.logger.Colors.red_800, "DB", "Unable to connect to DataBase")
        raise RuntimeError(f"Unable to connect to DataBase: {last_error}")

    def __bootstrap(self, pool: PostgresPool, name: str) -> None:
        schema_path = folderLocation / "schema.sql"
        try:
            with open(schema_path, "r", encoding="utf-8") as handle:
                sql = handle.read()
        except OSError as exc:
            raise RuntimeError(f"schema.sql missing at {schema_path}: {exc}")
        # Single execution keeps DO $$ blocks intact (splitting on ; would break them)
        pool.execute(sql, catchErrors=False)
        self.logger.log(self.logger.Colors.green_800, "DB", "schema ready (postgres + pgvector)")

    def useDB(self) -> PostgresPool:
        return self.db
