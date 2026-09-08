import os
import threading
from typing import Any

import psycopg
from psycopg.rows import dict_row

try:
    from pgvector.psycopg import register_vector
except ImportError:
    register_vector = None  # type: ignore


class PostgresPool:
    """
    Postgres pool with the same execute() contract as the old pooledMySQL
    (so SongProcessor needs zero changes beyond the import).

    Contract:
      execute(statement, params=None, dbRequired=True, catchErrors=True)
      - `?` placeholders (translated to %s)
      - SELECT/SHOW -> list[dict] (possibly empty, never None)
      - anything else -> None (autocommit)
      - catchErrors=True -> swallow errors, return None
      - catchErrors=False -> raise
    """

    _READ_PREFIXES = ("SELECT", "SHOW", "WITH")

    def __init__(
        self,
        user: str,
        password: str,
        dbName: str,
        host: str = "127.0.0.1",
        port: int = 5432,
        pool_size: int = 10,
        sslmode: str | None = None,
    ):
        self._conninfo = self._build_conninfo(user, password, dbName, host, port, sslmode)
        self._guard = threading.Semaphore(max(1, int(pool_size)))
        self._idle: list[Any] = []
        self._idle_lock = threading.Lock()

    @staticmethod
    def _build_conninfo(user, password, dbName, host, port, sslmode):
        # Aiven recommends sslmode=require; local dev can be disable/prefer.
        mode = (sslmode or os.getenv("PGSSLMODE") or os.getenv("DB_SSLMODE") or "prefer").strip() or "prefer"
        # psycopg connection string
        parts = [
            f"host={host}",
            f"port={int(port)}",
            f"dbname={dbName}",
            f"user={user}",
            f"password={password}",
            f"sslmode={mode}",
        ]
        ca = (os.getenv("DB_SSL_CA") or "").strip()
        if ca:
            parts.append(f"sslrootcert={ca}")
        return " ".join(parts)

    def _checkout(self):
        self._guard.acquire()
        try:
            with self._idle_lock:
                while self._idle:
                    conn = self._idle.pop()
                    try:
                        if conn.closed:
                            continue
                        with conn.cursor() as cur:
                            cur.execute("SELECT 1")
                        return conn
                    except Exception:
                        try:
                            conn.close()
                        except Exception:
                            pass
                conn = psycopg.connect(self._conninfo, row_factory=dict_row, autocommit=True)
                if register_vector is not None:
                    try:
                        register_vector(conn)
                    except Exception:
                        pass
                return conn
        except Exception:
            self._guard.release()
            raise

    def _checkin(self, conn) -> None:
        try:
            with self._idle_lock:
                self._idle.append(conn)
        finally:
            self._guard.release()

    def _drop(self, conn) -> None:
        try:
            conn.close()
        except Exception:
            pass
        finally:
            self._guard.release()

    @staticmethod
    def _is_read(statement: str) -> bool:
        return statement.lstrip().upper().startswith(PostgresPool._READ_PREFIXES)

    def execute(
        self,
        statement: str,
        params: list | None = None,
        dbRequired: bool = True,  # kept for compat, ignored for Postgres
        catchErrors: bool = True,
    ) -> None | list[dict[str, Any]]:
        # MySQL `?` -> Postgres `%s` (no literal `?` in our queries)
        query = statement.replace("?", "%s")
        # Postgres doesn't allow `TRUE/FALSE` as bare booleans in WHERE like MySQL does;
        # our queries use `{'TRUE' if ...}` trick — replace with TRUE/FALSE literals.
        args = tuple(params) if params else None
        conn = None
        try:
            conn = self._checkout()
        except Exception:
            if catchErrors:
                return None
            raise
        try:
            try:
                result = self._run(conn, query, args)
            except Exception:
                # Stale connection: drop and retry once with fresh conn (still holding permit)
                try:
                    conn.close()
                except Exception:
                    pass
                conn = psycopg.connect(self._conninfo, row_factory=dict_row, autocommit=True)
                if register_vector is not None:
                    try:
                        register_vector(conn)
                    except Exception:
                        pass
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
                self._drop(conn)

    def _run(self, conn, query: str, args) -> None | list[dict[str, Any]]:
        with conn.cursor(row_factory=dict_row) as cur:
            if args is not None:
                cur.execute(query, args)
            else:
                cur.execute(query)
            if self._is_read(query):
                rows = cur.fetchall()
                return [dict(r) for r in (rows or [])]
            return None
