"""
loop_router.py (Reset Version)
==============================
로컬 그래프 데이터만을 사용하여 경로를 생성하는 안정적인 초기 버전입니다.
외부 API(OSRM)나 복잡한 계단 검출 기능을 제거하고, "선이 완벽하게 그려지는 것"에 집중합니다.
"""

import networkx as nx
import random
import math

def _haversine_m(lon1, lat1, lon2, lat2):
    """두 WGS84 좌표 사이의 거리(m)."""
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _get_reachable_nodes(G, start_node):
    """시작 노드와 연결된 주 컴포넌트 노드 반환."""
    for comp in nx.connected_components(G):
        if start_node in comp: return comp
    return {start_node}


def _assemble_polyline(G, node_path):
    """
    노드 경로를 받아 각 엣지의 'geometry' 좌표를 순서대로 병합합니다.
    (도로의 굴곡을 그대로 따라가게 함)
    """
    full_coords = []
    for i in range(len(node_path) - 1):
        u, v = node_path[i], node_path[i+1]
        edge_data = G.get_edge_data(u, v)
        if not edge_data: continue
        
        # 첫 번째 엣지 데이터 사용
        key = list(edge_data.keys())[0]
        geom = edge_data[key].get('geometry', [])
        
        if not geom:
            # geometry가 없으면 직선 (lat, lon)
            step = [[u[1], u[0]], [v[1], v[0]]]
        else:
            # GeoJSON (lon, lat) -> Leaflet (lat, lon) 변환
            step = [[p[1], p[0]] for p in geom]
            
            # 방향 정렬 (v와 가까운 쪽이 끝점이 되도록)
            d_start = (step[0][0]-u[1])**2 + (step[0][1]-u[0])**2
            d_end = (step[-1][0]-u[1])**2 + (step[-1][1]-u[0])**2
            if d_start > d_end:
                step.reverse()
        
        if not full_coords:
            full_coords.extend(step)
        else:
            full_coords.extend(step[1:]) # 중복점 제거
            
    return full_coords


def generate_loop_routes(G, start_node, target_minutes=30, num_routes=3, config=None):
    """
    시작점에서 일정 거리 떨어진 지점을 찍고 돌아오는 가장 단순한 로컬 루프 생성.
    """
    if config is None: config = {}
    walking_speed = config.get('loop', {}).get('walking_speed_mps', 1.0)
    revisit_penalty = 1000 # 돌아오는 길 중첩 방지

    # 목표 반경 (편도 약 15~20분 거리)
    target_radius = (target_minutes * 60 * walking_speed) / 2.2
    
    reachable = _get_reachable_nodes(G, start_node)
    sx, sy = G.nodes[start_node]['x'], G.nodes[start_node]['y']
    
    routes = []
    attempts = 0
    while len(routes) < num_routes and attempts < 100:
        attempts += 1
        
        # 랜덤 타겟 선정
        angle = random.uniform(0, 2 * math.pi)
        dist = target_radius * random.uniform(0.8, 1.2)
        tx = sx + (dist / 111000.0) * math.cos(angle) / math.cos(math.radians(sy))
        ty = sy + (dist / 111000.0) * math.sin(angle)
        
        # 가장 가까운 노드 찾기 (전체 탐색 대신 랜덤 샘플링)
        candidates = random.sample(list(reachable), min(500, len(reachable)))
        node_b = min(candidates, key=lambda n: (G.nodes[n]['x']-tx)**2 + (G.nodes[n]['y']-ty)**2)
        
        if node_b == start_node: continue

        # 로컬 그래프에서 경로 탐색
        subG = G.copy() # 가중치 수정을 위해 복사
        try:
            # 가는 길 (A -> B)
            path_ab = nx.shortest_path(subG, source=start_node, target=node_b, weight='weight')
            
            # 돌아오는 길을 위한 페널티 부여
            for i in range(len(path_ab)-1):
                u, v = path_ab[i], path_ab[i+1]
                for k in subG[u][v]:
                    subG[u][v][k]['weight'] = subG[u][v][k].get('weight', 10) + revisit_penalty
            
            # 오는 길 (B -> A)
            path_ba = nx.shortest_path(subG, source=node_b, target=start_node, weight='weight')
            
            full_path = path_ab + path_ba[1:]
            
            # 거리 계산
            total_dist = 0.0
            for i in range(len(full_path)-1):
                u, v = full_path[i], full_path[i+1]
                total_dist += G[u][v][0].get('length', 10.0)
            
            est_minutes = round(total_dist / walking_speed / 60, 1)
            
            # 도로 추종 폴리라인 생성
            road_polyline = _assemble_polyline(G, full_path)
            
            routes.append({
                "path_nodes": full_path,
                "polyline": road_polyline,
                "estimated_minutes": est_minutes,
                "total_distance_m": round(total_dist, 1),
                "waypoint_count": 1,
                "stair_points": [] 
            })
            
        except nx.NetworkXNoPath:
            continue

    print(f"Reset Loop generation: {len(routes)} routes found.")
    return routes
