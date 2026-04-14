import os
import json
import math
import importlib
from typing import Any, Dict, List, Optional

from app.core.config import settings

_PSYCOPG = None


VEHICLE_HEAVY_HIGHWAY = {
    "motorway", "trunk", "primary", "secondary", "tertiary",
    "motorway_link", "trunk_link", "primary_link", "secondary_link", "tertiary_link",
}

_INCIDENTS_CACHE: Optional[List[Dict[str, Any]]] = None


def _parse_filter_attributes(raw_value: Any) -> List[str]:
    if raw_value is None:
        return []
    if isinstance(raw_value, list):
        return [str(v).strip() for v in raw_value if str(v).strip()]

    text = str(raw_value).strip()
    if not text:
        return []

    # PostgreSQL text[] string: {급경사,계단없음}
    if text.startswith("{") and text.endswith("}"):
        inner = text[1:-1]
        if not inner:
            return []
        return [p.strip().strip('"') for p in inner.split(",") if p.strip()]

    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return [str(v).strip() for v in parsed if str(v).strip()]
    except Exception:
        pass

    return [text]


def _safe_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except Exception:
        return None


def _haversine_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _sample_path_points(path_nodes: List, graph, max_points: int = 25) -> List[tuple]:
    if not path_nodes:
        return []

    step = max(1, len(path_nodes) // max_points)
    sampled = []
    for n in path_nodes[::step]:
        sampled.append((graph.nodes[n]["x"], graph.nodes[n]["y"]))
    return sampled


def _load_incidents() -> List[Dict[str, Any]]:
    global _INCIDENTS_CACHE
    if _INCIDENTS_CACHE is not None:
        return _INCIDENTS_CACHE

    incidents_path = os.path.join(settings.DATA_DIR, "seoul_incidents.json")
    if not os.path.exists(incidents_path):
        _INCIDENTS_CACHE = []
        return _INCIDENTS_CACHE

    try:
        with open(incidents_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            _INCIDENTS_CACHE = data if isinstance(data, list) else []
    except Exception:
        _INCIDENTS_CACHE = []

    return _INCIDENTS_CACHE


def collect_incident_profile(path_nodes: List, graph, hazard_radius_m: float = 100.0) -> Dict[str, Any]:
    incidents = _load_incidents()
    points = _sample_path_points(path_nodes, graph)

    profile = {
        "hazard_used": False,
        "has_hazard": False,
        "hazard_count": 0,
        "hazard_hits": [],
        "nearest_hazard_distance_m": None,
        "nearest_hazard_type": None,
    }

    if not incidents or not points:
        return profile

    nearest_distance = float("inf")
    for incident in incidents:
        ilat = incident.get("lat")
        ilng = incident.get("lng")
        if ilat is None or ilng is None:
            continue

        incident_type = str(incident.get("acc_type") or "돌발").strip()
        radius = hazard_radius_m
        if incident_type in {"사고", "통제"}:
            radius = 140.0
        elif incident_type in {"공사", "행사"}:
            radius = 110.0

        best_dist = float("inf")
        for lon, lat in points:
            dist = _haversine_m(lon, lat, float(ilng), float(ilat))
            if dist < best_dist:
                best_dist = dist

        if best_dist < nearest_distance:
            nearest_distance = best_dist
            profile["nearest_hazard_type"] = incident_type
            profile["nearest_hazard_distance_m"] = round(best_dist, 1)

        if best_dist <= radius:
            profile["hazard_used"] = True
            profile["has_hazard"] = True
            profile["hazard_count"] += 1
            profile["hazard_hits"].append({
                "acc_id": incident.get("acc_id"),
                "acc_type": incident_type,
                "acc_info": incident.get("acc_info", ""),
                "lat": ilat,
                "lng": ilng,
                "distance_m": round(best_dist, 1),
            })

    if profile["hazard_count"] == 0 and nearest_distance != float("inf"):
        profile["nearest_hazard_distance_m"] = round(nearest_distance, 1)

    return profile


def collect_graph_route_profile(path_nodes: List, graph) -> Dict[str, Any]:
    highways = []
    has_stairs = False
    stair_count = 0

    for i in range(len(path_nodes) - 1):
        u = path_nodes[i]
        v = path_nodes[i + 1]
        edge_data = graph.get_edge_data(u, v)
        if not edge_data:
            continue

        key = list(edge_data.keys())[0]
        data = edge_data[key]

        highway = str(data.get("highway") or "unknown").lower().strip()
        highways.append(highway)

        if highway == "steps" or data.get("near_stairs", False):
            has_stairs = True
            stair_count += 1

    vehicle_edges = sum(1 for h in highways if h in VEHICLE_HEAVY_HIGHWAY)
    vehicle_ratio = (vehicle_edges / len(highways)) if highways else 0.0

    return {
        "source": "graph",
        "has_stairs": has_stairs,
        "stair_count": stair_count,
        "highways": sorted(set(highways)),
        "vehicle_ratio": vehicle_ratio,
        "sampled_edges": len(highways),
    }


def _collect_pg_feature_profile(path_nodes: List, graph, search_buffer_meter: int = 30) -> Dict[str, Any]:
    """
    PostgreSQL walk_features 테이블에서 경로 프로파일 수집.
    주의: sdot_avg_noise는 테이블에 없을 수 있으므로 선택적 처리.
    혼잡도는 실시간 API에서 가져오고 여기선 스킵.
    """
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        return {"source": "postgres", "used": False, "reason": "DATABASE_URL not set"}

    global _PSYCOPG
    if _PSYCOPG is None:
        try:
            _PSYCOPG = importlib.import_module("psycopg")
        except Exception:
            return {"source": "postgres", "used": False, "reason": "psycopg not installed"}

    points = []
    for n in path_nodes[:: max(1, len(path_nodes) // 20)]:
        lat = graph.nodes[n]["y"]
        lng = graph.nodes[n]["x"]
        points.append((lng, lat))

    if not points:
        return {"source": "postgres", "used": False, "reason": "no points"}

    min_lng = min(p[0] for p in points)
    min_lat = min(p[1] for p in points)
    max_lng = max(p[0] for p in points)
    max_lat = max(p[1] for p in points)

    result = {
        "source": "postgres",
        "used": False,
        "has_steep": False,
        "has_stairs": False,
        "steep_count": 0,
        "stair_count": 0,
        "has_hot_surface_grade": False,
        "max_heat_risk": None,
        "min_cushion_score": None,
        "max_noise": None,
        "congest_levels": [],
    }

    try:
        with _PSYCOPG.connect(database_url) as conn:
            with conn.cursor() as cur:
                # filter_attributes, final_safety_grade, heat_risk, cushion_score 조회
                # sdot_avg_noise는 테이블에 없을 수 있으므로 생략
                try:
                    cur.execute(
                        """
                        SELECT filter_attributes, final_safety_grade, heat_risk, cushion_score,
                               sdot_avg_noise, AREA_CONGEST_LVL
                        FROM public.walk_features
                        WHERE geom IS NOT NULL
                          AND ST_Intersects(
                                geom,
                                ST_MakeEnvelope(%s, %s, %s, %s, 4326)
                          )
                        LIMIT 1000
                        """,
                        (min_lng, min_lat, max_lng, max_lat),
                    )
                    use_extended_cols = True
                except Exception:
                    # 환경별 컬럼 편차를 허용하기 위해 기본 컬럼으로 폴백
                    cur.execute(
                        """
                        SELECT filter_attributes, final_safety_grade, heat_risk, cushion_score
                        FROM public.walk_features
                        WHERE geom IS NOT NULL
                          AND ST_Intersects(
                                geom,
                                ST_MakeEnvelope(%s, %s, %s, %s, 4326)
                          )
                        LIMIT 1000
                        """,
                        (min_lng, min_lat, max_lng, max_lat),
                    )
                    use_extended_cols = False
                rows = cur.fetchall()

                heat_values = []
                cushion_values = []
                noise_values = []
                congest_levels = set()

                for row in rows:
                    attrs = _parse_filter_attributes(row[0])
                    safety_grade = str(row[1] or "")
                    heat_risk = _safe_float(row[2])
                    cushion_score = _safe_float(row[3])
                    noise = _safe_float(row[4]) if use_extended_cols else None
                    area_congest_lvl = str(row[5]).strip() if use_extended_cols and row[5] is not None else None

                    if any("급경사" in a for a in attrs):
                        result["has_steep"] = True
                        result["steep_count"] += 1
                    if any("계단" in a and "없음" not in a for a in attrs):
                        result["has_stairs"] = True
                        result["stair_count"] += 1
                    if "주의 (여름철 화상 주의)" in safety_grade:
                        result["has_hot_surface_grade"] = True
                    if heat_risk is not None:
                        heat_values.append(heat_risk)
                    if cushion_score is not None:
                        cushion_values.append(cushion_score)
                    if noise is not None:
                        noise_values.append(noise)
                    if area_congest_lvl:
                        congest_levels.add(area_congest_lvl)

                if heat_values:
                    result["max_heat_risk"] = max(heat_values)
                if cushion_values:
                    result["min_cushion_score"] = min(cushion_values)
                if noise_values:
                    result["max_noise"] = max(noise_values)
                if congest_levels:
                    result["congest_levels"] = sorted(congest_levels)

                result["used"] = True
                result["walk_feature_rows"] = len(rows)

    except Exception as e:
        result["used"] = False
        result["reason"] = str(e)

    return result


def collect_route_profile(path_nodes: List, graph) -> Dict[str, Any]:
    """
    경로의 통합 프로파일 수집.
    
    데이터 우선순위:
    - has_steep, has_stairs, has_hot_surface_grade, max_heat_risk: PostgreSQL walk_features
    - vehicle_ratio, highways: OSM 엣지 그래프
    
    주의:
    - 혼잡도는 weather_context에서 가져올 것 (실시간 API 기반)
    - sdot_avg_noise는 미사용 (테이블 미정)
    """
    graph_profile = collect_graph_route_profile(path_nodes, graph)
    pg_profile = _collect_pg_feature_profile(path_nodes, graph)
    incident_profile = collect_incident_profile(path_nodes, graph)

    merged = {
        "has_steep": pg_profile.get("has_steep", False),
        "has_stairs": graph_profile.get("has_stairs", False) or pg_profile.get("has_stairs", False),
        "steep_count": int(pg_profile.get("steep_count", 0) or 0),
        "stair_count": int(graph_profile.get("stair_count", 0) or 0) + int(pg_profile.get("stair_count", 0) or 0),
        "has_hot_surface_grade": pg_profile.get("has_hot_surface_grade", False),
        "max_heat_risk": pg_profile.get("max_heat_risk"),
        "min_cushion_score": pg_profile.get("min_cushion_score"),
        "max_noise": pg_profile.get("max_noise"),
        "congest_levels": pg_profile.get("congest_levels", []),
        "vehicle_ratio": graph_profile.get("vehicle_ratio", 0.0),
        "highways": graph_profile.get("highways", []),
        "db_used": pg_profile.get("used", False),
        "db_reason": pg_profile.get("reason"),
        "has_hazard": incident_profile.get("has_hazard", False),
        "hazard_used": incident_profile.get("hazard_used", False),
        "hazard_count": incident_profile.get("hazard_count", 0),
        "hazard_hits": incident_profile.get("hazard_hits", []),
        "nearest_hazard_distance_m": incident_profile.get("nearest_hazard_distance_m"),
        "nearest_hazard_type": incident_profile.get("nearest_hazard_type"),
    }

    return merged
