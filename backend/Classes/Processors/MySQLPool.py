import threading
from typing import Any

import mysql.connector
from mysql.connector import Error as MySQLError


class MySQLPool:
    """
    SSL-capable MySQL pool with the same execute() contract as pooledMySQL,
    which cannot do TLS (a hard requirement on managed hosts like Aiven).

    Contract:
      execute(statement, params=None, dbRequired=True, catchErrors=True)
      - `?` placeholders (translated to %s; the codebase has no literal `?`)
      - SELECT/SHOW/DESCRIBE/EXPLAIN -> list[dict] keyed by column name
        (possibly empty, never None)
      - anything else -> None (autocommit is on)
      - catchErrors=True -> swallow errors, return None
      - catchErrors=False -> raise
      - dbRequired=False -> connect without selecting a database

    Connections are checkout-guarded by a semaphore, health-checked with
    ping(reconnect=True) before use, and rebuilt once on OperationalError
    with a single retry — idle kills by managed DBs recover transparently.
    """

    _READ_PREFIXES = ("SELECT", "SHOW", "DESCRIBE", "DESC", "EXPLAIN")

    def __init__(
        self,
        user: str,
        password: str,
        dbName: str,
        host: str = "127.0.0.1",
        port: int = 3306,
        pool_size: int = 8,
        ssl_ca: str | None = None,
    ):
        self._base_config: dict[str, Any] = {
            "user": user,
            "password": password,
            "host": host,
            "port": int(port),
            "autocommit": True,
            "connection_timeout": 10,
            # TLS on always (managed hosts require it); verified only when
            # a CA is provided via DB_SSL_CA.
            "ssl_disabled": False,
        }
        if ssl_ca:
            self._base_config["ssl_ca"] = ssl_ca
            self._base_config["ssl_verify_cert"] = True
            self._base_config["ssl_verify_identity"] = True
        self._db_name = dbName
        self._guard = threading.Semaphore(max(1, int(pool_size)))
        self._idle: list[Any] = []
        self._idle_lock = threading.Lock()

    def _connect(self, with_db: bool):
        config = dict(self._base_config)
        if with_db:
            config["database"] = self._db_name
        return mysql.connector.connect(**config)

    def _checkout(self, with_db: bool):
        self._guard.acquire()
        try:
            with self._idle_lock:
                while self._idle:
                    conn = self._idle.pop()
                    try:
                        conn.ping(reconnect=True, attempts=1, delay=0)
                        return conn
                    except MySQLError:
                        try:
                            conn.close()
                        except Exception:
                            pass
            return self._connect(with_db)
        except Exception:
            self._guard.release()
            raise

    def _checkin(self, conn) -> None:
        """Return a healthy connection to the pool (releases one permit)."""
        try:
            with self._idle_lock:
                self._idle.append(conn)
        finally:
            self._guard.release()

    def _drop(self, conn) -> None:
        """Close a dead connection (releases one permit)."""
        try:
            conn.close()
        except Exception:
            pass
        finally:
            self._guard.release()

    @staticmethod
    def _is_read(statement: str) -> bool:
        first = statement.lstrip().upper()
        return first.startswith(MySQLPool._READ_PREFIXES)

    def execute(
        self,
        statement: str,
        params: list | None = None,
        dbRequired: bool = True,
        catchErrors: bool = True,
    ) -> None | list[dict[str, Any]]:
        query = statement.replace("?", "%s")
        args = tuple(params) if params else None
        conn = None
        try:
            conn = self._checkout(dbRequired)  # holds exactly one permit
        except Exception:
            if catchErrors:
                return None
            raise
        try:
            try:
                result = self._run(conn, query, args)
            except (MySQLError, ConnectionError, OSError):
                # Stale/killed connection: close it and rebuild once while
                # still holding our permit, then retry once.
                try:
                    conn.close()
                except Exception:
                    pass
                conn = self._connect(dbRequired)
                result = self._run(conn, query, args)
            self._checkin(conn)
            conn = None
            return result
        except Exception:
            if conn is not None:
                self._drop(conn)
                conn = None
            if catchErrors:
                return None
            raise
        finally:
            if conn is not None:
                # Safety net only — every path above already released.
                self._drop(conn)

    def _run(self, conn, query: str, args) -> None | list[dict[str, Any]]:
        cursor = conn.cursor(dictionary=True)
        try:
            cursor.execute(query, args) if args is not None else cursor.execute(query)
            if self._is_read(query):
                rows = cursor.fetchall()
                return [dict(row) for row in (rows or [])]
            return None
        finally:
            try:
                cursor.close()
            except Exception:
                pass
