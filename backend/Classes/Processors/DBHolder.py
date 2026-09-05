import os
import re
import time
from customisedLogs import CustomisedLogs

from Classes.Processors.MySQLPool import MySQLPool
from Hidden.Secrets import DBSecrets, folderLocation


class DBHolder:
    """
    Builds an SSL-capable MySQL pool and bootstraps the schema.

    Configuration is environment-first (managed hosts) with the legacy
    Secrets.py values as local fallback:
      DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME / DB_SSL_CA
    (DB_HOSTS comma-separated overrides the legacy host list instead.)

    Cloud-safe: connection failure raises after bounded retries — it never
    blocks on input() or kills the process, so the platform can restart us.
    """
    MAX_ROUNDS = 6
    ROUND_DELAY_SECONDS = 5

    def __init__(self, logger:CustomisedLogs):
        """
        Connects synchronously so boot fails fast and loudly on bad config.
        :param logger: instance of customisedLogger
        """
        self.logger:None|CustomisedLogs = logger
        self.db:MySQLPool = self.__connect_with_retry()
        self.initialised = True

    @staticmethod
    def __env(name:str, fallback:str="") -> str:
        return (os.getenv(name) or fallback).strip()

    def __targets(self) -> list[tuple[str, int]]:
        """Ordered (host, port) candidates: env first, legacy list after."""
        port = int(self.__env("DB_PORT", "3306") or 3306)
        hosts_env = self.__env("DB_HOSTS", "")
        if hosts_env:
            return [(h.strip(), port) for h in hosts_env.split(",") if h.strip()]
        single = self.__env("DB_HOST", "")
        if single:
            return [(single, port)]
        return [(host, port) for host in DBSecrets.DBHosts]

    def __credentials(self) -> tuple[str, str, str, str | None]:
        user = self.__env("DB_USER", DBSecrets.DBUser)
        password = self.__env("DB_PASSWORD", DBSecrets.DBPassword)
        name = self.__env("DB_NAME", DBSecrets.DBName)
        ssl_ca = self.__env("DB_SSL_CA", "") or None
        if not re.fullmatch(r"[A-Za-z0-9_]+", name):
            raise RuntimeError(f"Refusing unsafe DB_NAME: {name!r}")
        return user, password, name, ssl_ca

    def __connect_with_retry(self) -> MySQLPool:
        """Try every host across bounded rounds, then raise (never exit())."""
        user, password, name, ssl_ca = self.__credentials()
        last_error: Exception | None = None
        for _round in range(self.MAX_ROUNDS):
            for host, port in self.__targets():
                try:
                    pool = MySQLPool(
                        user=user, password=password, dbName=name,
                        host=host, port=port, ssl_ca=ssl_ca,
                    )
                    pool.execute("SELECT 1", dbRequired=False, catchErrors=False)
                    self.__bootstrap(pool, name)
                    self.logger.log(self.logger.Colors.green_800, "DB", f"connected to: {host}:{port} db={name}")
                    return pool
                except Exception as exc:
                    last_error = exc
                    self.logger.log(self.logger.Colors.red_500, "DB", f"failed: {host}:{port} ({exc})")
            time.sleep(self.ROUND_DELAY_SECONDS)
        self.logger.log(self.logger.Colors.red_800, "DB", "Unable to connect to DataBase")
        raise RuntimeError(f"Unable to connect to DataBase: {last_error}")

    def __bootstrap(self, pool:MySQLPool, name:str) -> None:
        """Create the database (avnadmin-style privileged users) and schema."""
        try:
            pool.execute(f"CREATE DATABASE IF NOT EXISTS `{name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci", dbRequired=False, catchErrors=False)
        except Exception as exc:
            # Least-privilege users point at a pre-created DB — not fatal.
            self.logger.log(self.logger.Colors.yellow_500, "DB", f"CREATE DATABASE skipped: {exc}")
        schema_path = folderLocation / "schema.sql"
        try:
            with open(schema_path, "r", encoding="utf-8") as handle:
                statements = [s.strip() for s in handle.read().split(";") if s.strip()]
        except OSError as exc:
            raise RuntimeError(f"schema.sql missing at {schema_path}: {exc}")
        for statement in statements:
            pool.execute(statement, catchErrors=False)
        self.logger.log(self.logger.Colors.green_800, "DB", "schema ready")

    def useDB(self) -> MySQLPool:
        """
        Returns the pool (connected synchronously in __init__).
        :return:
        """
        return self.db
