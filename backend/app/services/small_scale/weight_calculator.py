"""
weight_calculator.py
====================
YAML config 기반 엣지 가중치 계산기.

기존의 하드코딩 방식을 제거하고, config/weights.yaml 값에 따라
모든 페널티/보너스를 동적으로 적용합니다.
"""

import networkx as nx


def _parse_width(width_raw):
    """width 문자열을 float(m)로 변환."""
    if width_raw is None:
        return None
    s = str(width_raw).strip().lower().replace('m', '').strip()
    try:
        return float(s)
    except ValueError:
        return None


def calculate_edge_weight(data, config):
    """
    단일 엣지의 비용(weight)을 계산합니다.
    
    Parameters
    ----------
    data : dict
        엣지 속성 딕셔너리 (highway, surface, width, length, near_stairs, near_leisure 등)
    config : dict
        weights.yaml에서 로드한 설정 딕셔너리
    
    Returns
    -------
    float
        계산된 가중치 (비용). 값이 클수록 기피됨.
    """
    base_cost = data.get('length', 10.0)

    # --- 1. 도로 유형(highway) 페널티 ---
    hw_config = config.get('highway_penalty', {})
    highway = data.get('highway', 'unknown')
    hw_penalty = hw_config.get(highway, hw_config.get('unknown', 1.2))

    # --- 2. 계단(stairs) 인접 페널티 ---
    stairs_config = config.get('stairs_penalty', {})
    st_penalty = stairs_config.get('multiplier', 10.0) if data.get('near_stairs', False) else 1.0

    # --- 3. 공원/놀이터(leisure) 보너스 ---
    leisure_config = config.get('leisure_bonus', {})
    near_leisure = data.get('near_leisure')
    if near_leisure == 'dog_park':
        l_bonus = leisure_config.get('dog_park_multiplier', 0.7)
    elif near_leisure == 'park':
        l_bonus = leisure_config.get('park_multiplier', 0.8)
    else:
        l_bonus = 1.0

    # --- 최종 비용: 단순 거리 * 도로페널티 * 계단페널티 * 보너스 ---
    final_cost = base_cost * hw_penalty * st_penalty * l_bonus

    return max(final_cost, 0.01)


def apply_weights_to_graph(G, config):
    """
    모든 엣지를 순회하며 config 기반 가중치(weight) 속성을 추가합니다.

    Parameters
    ----------
    G : nx.MultiGraph
        graph_builder에서 생성된 그래프
    config : dict
        weights.yaml에서 로드한 설정 딕셔너리

    Returns
    -------
    nx.MultiGraph
        weight 속성이 추가된 그래프
    """
    weight_stats = {'min': float('inf'), 'max': 0, 'sum': 0, 'count': 0}

    for u, v, key, data in G.edges(keys=True, data=True):
        cost = calculate_edge_weight(data, config)
        G[u][v][key]['weight'] = cost

        weight_stats['min'] = min(weight_stats['min'], cost)
        weight_stats['max'] = max(weight_stats['max'], cost)
        weight_stats['sum'] += cost
        weight_stats['count'] += 1

    avg = weight_stats['sum'] / weight_stats['count'] if weight_stats['count'] > 0 else 0
    print(f"Weight application complete: {weight_stats['count']:,} edges")
    print(f"   범위: {weight_stats['min']:.2f} ~ {weight_stats['max']:.2f} (평균: {avg:.2f})")

    return G
