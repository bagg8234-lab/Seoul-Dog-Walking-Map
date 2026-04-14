"""
loop_route_service.py
=====================
SmallScale 루프 경로 생성 서비스.

서버 첫 요청 시 그래프를 빌드하고 메모리에 캐싱합니다.
이후 요청은 캐싱된 그래프를 사용하므로 빠르게 응답합니다.
"""

import os
import math
import yaml

from app.core.config import settings
from app.services.small_scale.graph_builder import build_graph, keep_significant_components
from app.services.small_scale.overlay_loader import apply_all_overlays
from app.services.small_scale.weight_calculator import apply_weights_to_graph
from app.services.small_scale.loop_router import generate_loop_routes
from app.models.small_scale.route import LoopRouteInfo

# === 전역 캐싱 (서버 수명 동안 1회만 로드) ===
_G_weighted = None
_config = None


def _haversine_m(lon1, lat1, lon2, lat2):
    """두 WGS84 좌표 사이의 거리(m)."""
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _ensure_graph_loaded():
    """그래프가 메모리에 없으면 빌드합니다 (1회만 실행)."""
    global _G_weighted, _config

    if _G_weighted is not None:
        return

    print("🔄 SmallScale 그래프 빌드 시작...")

    # config 로드
    config_path = os.path.join(settings.BACKEND_DIR, "config", "weights.yaml")
    with open(config_path, 'r', encoding='utf-8') as f:
        _config = yaml.safe_load(f)
    print(f"   ⚙️ 설정 로드: {config_path}")

    # 그래프 빌드
    edges_path = os.path.join(settings.DATA_DIR, "osm", "edges_clean.geojson")
    G = build_graph(edges_path)
    G = keep_significant_components(G, min_nodes=100)

    # 오버레이
    stairs_path = os.path.join(settings.DATA_DIR, "osm", "stairs.geojson")
    leisure_path = os.path.join(settings.DATA_DIR, "osm", "leisure_clean.geojson")
    G = apply_all_overlays(G, stairs_path, leisure_path, _config)

    # 가중치
    _G_weighted = apply_weights_to_graph(G, _config)
    print("✅ SmallScale 그래프 빌드 완료 (메모리 캐싱됨)")


def _find_nearest_node(G, lat, lon):
    """주어진 좌표에서 가장 가까운 그래프 노드를 반환."""
    best_node = None
    best_dist = float('inf')
    for node in G.nodes():
        nx_val = G.nodes[node]['x']
        ny_val = G.nodes[node]['y']
        dist = _haversine_m(lon, lat, nx_val, ny_val)
        if dist < best_dist:
            best_dist = dist
            best_node = node
    return best_node


def generate_routes(user_lat, user_lng, target_minutes=30, num_routes=3):
    """
    API에서 호출되는 메인 함수.

    Returns
    -------
    tuple: (list[LoopRouteInfo], start_node_tuple)
    """
    _ensure_graph_loaded()

    start_node = _find_nearest_node(_G_weighted, user_lat, user_lng)

    raw_routes = generate_loop_routes(
        _G_weighted, start_node,
        target_minutes=target_minutes,
        num_routes=num_routes,
        config=_config,
    )

    result = []
    user_coord = [user_lat, user_lng]

    for idx, r in enumerate(raw_routes):
        # 1. 로컬 라우터에서 생성한 고품질(Geometry 포함) 폴리라인 사용
        # 사용자 실제 위치와의 연결성을 위해 시작/끝에 유저 좌표 삽입
        full_polyline = [user_coord] + r['polyline'] + [user_coord]

        result.append(LoopRouteInfo(
            route_id=idx + 1,
            estimated_minutes=r['estimated_minutes'],
            total_distance_m=r['total_distance_m'],
            waypoint_count=r['waypoint_count'],
            polyline=full_polyline,
        ))

    return result, start_node
