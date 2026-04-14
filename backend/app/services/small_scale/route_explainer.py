import json
import os
import urllib.request
from typing import Dict, List, Optional

from app.models.small_scale.route import LoopRouteInfo


def _parse_active_rules(value: str) -> set:
    if not value or value == "없음":
        return set()
    return {token.strip() for token in str(value).split(",") if token.strip()}


def _format_time_status(route_minutes: float, target_minutes: Optional[object]) -> str:
    try:
        target_value = float(target_minutes)
        delta = float(route_minutes) - target_value
    except Exception:
        return f"예상 {route_minutes:.1f}분"

    if abs(delta) < 1.0:
        return f"{target_value:.0f}분 목표와 거의 비슷한 {route_minutes:.1f}분"
    if delta > 0:
        return f"목표보다 약 {delta:.1f}분 더 걸리는 {route_minutes:.1f}분"
    return f"목표보다 약 {abs(delta):.1f}분 짧은 {route_minutes:.1f}분"


def _route_highlights(profile: Dict[str, object]) -> List[str]:
    highlights: List[str] = []
    has_steep = bool(profile.get("has_steep"))
    has_stairs = bool(profile.get("has_stairs"))

    if has_steep and has_stairs:
        highlights.append("경사와 계단이 모두 있어 보폭 조절이 필요")
    elif has_steep:
        highlights.append("경사 구간이 있어 오르막 부담이 있음")
    elif has_stairs:
        highlights.append("계단 구간이 있어 관절 부담 주의")
    else:
        highlights.append("경사 부담이 비교적 적은 동선")

    max_heat_risk = profile.get("max_heat_risk")
    if profile.get("has_hot_surface_grade"):
        highlights.append("여름철 노면 화상 주의 구간 포함")
    elif isinstance(max_heat_risk, (int, float)):
        if max_heat_risk >= 60:
            highlights.append("한낮에는 노면 열감이 높은 편")
        elif max_heat_risk <= 30:
            highlights.append("노면 열 부담이 비교적 낮은 편")

    vehicle_ratio = float(profile.get("vehicle_ratio", 0) or 0.0)
    if vehicle_ratio >= 0.45:
        highlights.append("차량 통행이 비교적 많은 구간")
    elif vehicle_ratio <= 0.20:
        highlights.append("차량 통행이 적어 비교적 한적한 구간")

    highways = profile.get("highways", []) or []
    if highways:
        highlights.append(f"도로 유형 {len(highways)}종 혼합")

    return highlights


def _fallback_explanations(
    routes: List[LoopRouteInfo],
    filter_summary: str,
    xai_context: Optional[Dict[str, str]] = None,
    route_profiles: Optional[List[Dict[str, object]]] = None,
) -> List[str]:
    explanations = []
    target_minutes = (xai_context or {}).get("target_minutes")
    persona_intro = (xai_context or {}).get("persona_intro", "우리 아이를 위해")
    user_conditions = (xai_context or {}).get("user_conditions", "없음")
    active_rules = _parse_active_rules((xai_context or {}).get("activated_rules", "없음"))
    route_profiles = route_profiles or [{} for _ in routes]

    for idx, r in enumerate(routes):
        profile = route_profiles[idx] if idx < len(route_profiles) else {}
        time_status = _format_time_status(r.estimated_minutes, target_minutes)
        highlights = _route_highlights(profile)

        head = f"{persona_intro} 이 경로는 {time_status}이며 총 {int(r.total_distance_m)}m입니다."
        body = " ".join([f"{h}." for h in highlights[:2]])
        tail = "현재 입력 조건을 기준으로 무리가 덜한 선택지입니다." if active_rules else "중립 조건에서 시간과 이동 균형을 맞춘 경로입니다."
        base = f"{head} {body} {tail}".strip()

        explanations.append(base)
    return explanations


def _call_azure_openai(prompt: str) -> str:
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT")
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-10-21")

    if not endpoint or not deployment or not api_key:
        raise RuntimeError("Azure OpenAI environment variables are not configured")

    url = (
        endpoint.rstrip("/")
        + f"/openai/deployments/{deployment}/chat/completions?api-version={api_version}"
    )

    body = {
        "messages": [
            {
                "role": "system",
                "content": "당신은 반려견 산책 추천 설명 생성기입니다. 1~2문장으로 간결하고 안전 중심으로 설명하세요.",
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
        "max_tokens": 220,
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "api-key": api_key,
        },
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=8) as resp:
        payload = json.loads(resp.read().decode("utf-8"))

    return payload["choices"][0]["message"]["content"].strip()


def build_route_explanations(
    routes: List[LoopRouteInfo],
    filter_summary: str,
    xai_context: Optional[Dict[str, str]] = None,
    route_profiles: Optional[List[Dict[str, object]]] = None,
) -> List[str]:
    if not routes:
        return []

    fallback = _fallback_explanations(routes, filter_summary, xai_context, route_profiles)

    target_minutes = (xai_context or {}).get("target_minutes", "미지정")
    activated_rules = (xai_context or {}).get("activated_rules", "없음")
    user_conditions = (xai_context or {}).get("user_conditions", "없음")
    area_congest_lvl = (xai_context or {}).get("area_congest_lvl", "미지정")
    route_profiles = route_profiles or [{} for _ in routes]

    lines = []
    for idx, route in enumerate(routes, start=1):
        profile = route_profiles[idx - 1] if idx - 1 < len(route_profiles) else {}
        warning_text = ", ".join(route.route_warnings) if route.route_warnings else "없음"
        time_status = _format_time_status(route.estimated_minutes, target_minutes)
        vehicle_ratio = float(profile.get('vehicle_ratio', 0) or 0.0)
        if vehicle_ratio >= 0.45:
            traffic_desc = "차량 통행 많음"
        elif vehicle_ratio <= 0.20:
            traffic_desc = "차량 통행 적음"
        else:
            traffic_desc = "차량 통행 보통"

        heat_risk = profile.get('max_heat_risk')
        if profile.get('has_hot_surface_grade'):
            heat_desc = "여름 노면 주의"
        elif isinstance(heat_risk, (int, float)) and heat_risk >= 60:
            heat_desc = "노면 열감 높음"
        elif isinstance(heat_risk, (int, float)) and heat_risk <= 30:
            heat_desc = "노면 열감 낮음"
        else:
            heat_desc = "노면 열감 보통"

        lines.append(
            f"[{idx}] 경로번호={route.route_id}, 시간={time_status}, 거리={route.total_distance_m}m, 경고={warning_text}, "
            f"경사여부={'있음' if bool(profile.get('has_steep')) else '없음'}, 계단여부={'있음' if bool(profile.get('has_stairs')) else '없음'}, "
            f"노면특성={heat_desc}, 교통특성={traffic_desc}, 도로종류수={len(profile.get('highways', []) or [])}, 혼잡도={area_congest_lvl}"
        )

    prompt = (
        "너는 반려견 산책 경로 설명을 쓰는 도우미다.\n"
        "각 경로마다 실제 데이터에서 눈에 띄는 특징을 2개 이상 골라, 자연스럽고 읽기 쉬운 한국어 한 문단으로 설명해라.\n"
        "경로별 설명이 서로 다르게 느껴지도록 작성해라.\n"
        "'A/B/C 형식', 대괄호 번호, 슬래시 나열(예: 경사/계단/노면/차량...) 같은 고정 틀은 쓰지 마라.\n"
        "중요: heat_risk, vehicle_ratio, has_steep 같은 컬럼명/영문 키를 그대로 노출하지 마라.\n"
        "숫자 비율(raw value)을 그대로 보여주기보다 '한적함/보통/차량 많음' 같은 사용자 언어로 바꿔라.\n"
        "시간 설명은 반드시 목표 시간 대비 차이를 정확히 반영해라.\n"
        "과장된 단정 표현(완벽, 무조건, 절대 안전)은 금지한다.\n"
        "출력은 JSON 배열 문자열만 반환해라. 배열 길이는 경로 수와 동일해야 한다.\n\n"
        f"페르소나: {(xai_context or {}).get('persona_intro', '우리 아이를 위해')}\n"
        f"사용자 입력 요약: {user_conditions}\n"
        f"활성 규칙: {activated_rules}\n"
        f"목표 시간: {target_minutes}분\n"
        "각 경로 데이터:\n"
        + "\n".join(lines)
    )

    try:
        response_text = _call_azure_openai(prompt)
        parsed = json.loads(response_text)
        if isinstance(parsed, list) and len(parsed) == len(routes):
            cleaned = [str(item).strip() for item in parsed]
            if all(cleaned):
                return cleaned
        return fallback
    except Exception:
        return fallback
