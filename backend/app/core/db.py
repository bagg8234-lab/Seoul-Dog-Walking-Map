"""
db.py
=====
PostgreSQL 연결을 관리하는 공통 모듈.
psycopg2를 사용하여 Azure DB for PostgreSQL에 연결합니다.
"""

import psycopg2
import psycopg2.extras
from app.core.config import settings


def get_connection():
    """
    PostgreSQL 연결 객체를 반환합니다.
    사용 후 반드시 conn.close()를 호출하거나 with 문을 사용하세요.
    """
    return psycopg2.connect(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        dbname=settings.DB_NAME,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        sslmode="require",  # Azure PostgreSQL은 SSL 필수
        connect_timeout=5
    )


def fetch_all(query: str, params=None) -> list[dict]:
    """
    SELECT 쿼리를 실행하고 결과를 dict 리스트로 반환합니다.
    """
    try:
        with get_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(query, params)
                return [dict(row) for row in cur.fetchall()]
    except Exception as e:
        print(f"[DB ERROR] {e}")
        return []
