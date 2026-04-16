"""
graph_db_loader.py
==================
PostgreSQL DB에서 edge/node 정보를 읽어 NetworkX MultiGraph 생성
"""

import networkx as nx
from typing import Optional
import os
import importlib

from app.core.config import settings

def _load_psycopg():
    try:
        return importlib.import_module("psycopg")
    except Exception:
        return None

def build_graph_from_db(
    edge_table: str = "walk_features",
    node_table: Optional[str] = None,
    database_url: Optional[str] = None,
    precision: int = 6,
) -> nx.MultiGraph:
    """
    DB에서 edge/node 정보를 읽어 NetworkX MultiGraph 생성
    edge_table: 엣지 테이블명 (walk_features)
    node_table: 노드 테이블명 (선택)
    """
    psycopg = _load_psycopg()
    if psycopg is None:
        raise ImportError("psycopg가 설치되어 있지 않습니다.")
    database_url = database_url or os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL 환경변수 또는 인자 필요")

    G = nx.MultiGraph()
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            # 노드 정보가 별도 테이블에 있으면 먼저 추가
            if node_table:
                cur.execute(f"SELECT id, x, y FROM {node_table}")
                for row in cur.fetchall():
                    node_id, x, y = row
                    G.add_node(node_id, x=x, y=y)

            # walk_features 테이블에서 edge 정보 읽기
            cur.execute(
                f"SELECT id, start_node, end_node, "
                f"ST_X(ST_PointN(geometry, 1)) AS x1, ST_Y(ST_PointN(geometry, 1)) AS y1, "
                f"ST_X(ST_PointN(geometry, ST_NumPoints(geometry))) AS x2, ST_Y(ST_PointN(geometry, ST_NumPoints(geometry))) AS y2, "
                f"length, surface, smoothness, highway, soil_type, gravel_content, soil_depth, drainage_class, "
                f"avg_slope, slope_type, heat_soil_val, heat_drain_val, heat_risk, "
                f"measured_roughness, inferred_roughness, base_roughness, roughness_score, cushion_score, "
                f"inferred_surface, final_safety_grade, filter_attributes, road_description "
                f"FROM {edge_table}"
            )
            for row in cur.fetchall():
                (
                    edge_id, start_node, end_node, x1, y1, x2, y2, length, surface, smoothness, highway, soil_type, gravel_content, soil_depth, drainage_class,
                    avg_slope, slope_type, heat_soil_val, heat_drain_val, heat_risk,
                    measured_roughness, inferred_roughness, base_roughness, roughness_score, cushion_score,
                    inferred_surface, final_safety_grade, filter_attributes, road_description
                ) = row
                start_coord = (round(x1, precision), round(y1, precision))
                end_coord = (round(x2, precision), round(y2, precision))
                if start_coord not in G:
                    G.add_node(start_coord, x=start_coord[0], y=start_coord[1])
                if end_coord not in G:
                    G.add_node(end_coord, x=end_coord[0], y=end_coord[1])
                edge_attrs = {
                    'start_node': start_node,
                    'end_node': end_node,
                    'length': length,
                    'surface': surface,
                    'smoothness': smoothness,
                    'highway': highway,
                    'soil_type': soil_type,
                    'gravel_content': gravel_content,
                    'soil_depth': soil_depth,
                    'drainage_class': drainage_class,
                    'avg_slope': avg_slope,
                    'slope_type': slope_type,
                    'heat_soil_val': heat_soil_val,
                    'heat_drain_val': heat_drain_val,
                    'heat_risk': heat_risk,
                    'measured_roughness': measured_roughness,
                    'inferred_roughness': inferred_roughness,
                    'base_roughness': base_roughness,
                    'roughness_score': roughness_score,
                    'cushion_score': cushion_score,
                    'inferred_surface': inferred_surface,
                    'final_safety_grade': final_safety_grade,
                    'filter_attributes': filter_attributes,
                    'road_description': road_description,
                    'osm_id': edge_id,
                    'geometry': None,  # 필요시 WKB/GeoJSON 파싱
                }
                G.add_edge(start_coord, end_coord, **edge_attrs)
    print(f"[DB] 그래프 생성 완료: nodes {len(G.nodes):,}, edges {len(G.edges):,}")
    return G