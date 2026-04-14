"""
soil_service.py
===============
바닥 재질 정보를 PostgreSQL walk_features 테이블에서 조회합니다.
기존 JSON 캐시 파일(soil_cache.json) 방식을 DB 방식으로 대체합니다.

walk_features 주요 컬럼:
  - soil_type  (text) : 토양/바닥 재질 (예: 사양질, 식양질 등)
  - road_descri (text): 도로/산책로 이름
"""

from typing import List
from app.models.large_scale.trail import TrailInfo
from app.core.db import fetch_all

_soil_cache: dict | None = None


def _load_soil_cache_from_db() -> dict:
    """
    walk_features 테이블에서 바닥 재질 정보를 로드하여
    {trail_name: soil_type} 형태의 딕셔너리로 반환합니다.
    """
    rows = fetch_all("""
        SELECT
            trail_name,
            soil_type
        FROM trail_features
        WHERE trail_name IS NOT NULL
          AND soil_type  IS NOT NULL
    """)

    cache = {}
    for row in rows:
        name = str(row["trail_name"]).strip()
        cache[name] = str(row["soil_type"]).strip()

    print(f"[soil_service] DB에서 바닥재질 {len(cache)}건 로드 완료")
    return cache


def load_soil_cache() -> dict:
    """인메모리 캐시 반환 (최초 1회만 DB 조회)"""
    global _soil_cache
    if _soil_cache is None:
        try:
            _soil_cache = _load_soil_cache_from_db()
        except Exception as e:
            print(f"[soil_service] DB 로드 실패, 빈 캐시로 폴백: {e}")
            _soil_cache = {}
    return _soil_cache


def inject_soil_info(items: List[TrailInfo]):
    cache = load_soil_cache()
    if not cache:
        return

    for item in items:
        if item.type not in ["trail", "park"]:
            continue

        soil_data = cache.get(item.trail_name)

        if not soil_data:
            for cache_name, data in cache.items():
                if item.trail_name in cache_name or cache_name in item.trail_name:
                    soil_data = data
                    break

        item.soil_type = soil_data if soil_data else "정보 없음"
