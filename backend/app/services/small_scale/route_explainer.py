import json
import os
import urllib.request
from typing import Dict, List, Optional

from app.models.small_scale.route import LoopRouteInfo
from app.core.config import settings


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

    endpoint = settings.AZURE_OPENAI_ENDPOINT
    deployment = settings.AZURE_OPENAI_DEPLOYMENT
    api_key = settings.AZURE_OPENAI_API_KEY
    api_version = settings.AZURE_OPENAI_API_VERSION or "2024-10-21"

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
                "content": (
                    "당신은 반려견 산책 코스의 특징을 잡아내는 전문 가이드입니다. "
                    "제공된 데이터를 바탕으로 각 코스의 매력을 다채롭고 생생하게 설명하세요."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.4,
        "max_tokens": 500,
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

    print("[DEBUG] build_route_explanations 진입")
    if not routes:
        print("[DEBUG] build_route_explanations: routes 없음, 빈 리스트 반환")
        print("[DEBUG] build_route_explanations 탈출")
        return []


    fallback = _fallback_explanations(routes, filter_summary, xai_context, route_profiles)

    # --- 새 프롬프트: 설명 구조/예시/지침 제거, 비교 기반 자유 설명 ---
    import statistics
    route_profiles = route_profiles or [{} for _ in routes]

    # 경로별 주요 feature 추출
    features = []
    for idx, (route, profile) in enumerate(zip(routes, route_profiles), start=1):
        features.append({
            "index": idx,
            "distance_m": route.total_distance_m,
            "estimated_minutes": route.estimated_minutes,
            "has_steep": bool(profile.get("has_steep")),
            "has_stairs": bool(profile.get("has_stairs")),
            "vehicle_ratio": float(profile.get("vehicle_ratio", 0) or 0.0),
            "max_heat_risk": profile.get("max_heat_risk", None),
            "warnings": route.route_warnings or [],
        })

    # 전체 경로 통계 계산
    def stat(key):
        vals = [f[key] for f in features if isinstance(f[key], (int, float))]
        return {
            "mean": statistics.mean(vals) if vals else None,
            "min": min(vals) if vals else None,
            "max": max(vals) if vals else None,
        }

    stats = {
        "distance_m": stat("distance_m"),
        "estimated_minutes": stat("estimated_minutes"),
        "vehicle_ratio": stat("vehicle_ratio"),
        "max_heat_risk": stat("max_heat_risk"),
    }

    persona_intro = (xai_context or {}).get("persona_intro", "우리 아이")
    user_conditions = (xai_context or {}).get("user_conditions", "없음")
    activated_rules = (xai_context or {}).get("activated_rules", "없음")
    target_minutes = (xai_context or {}).get("target_minutes", "미지정")

    prompt = (
        f"당신은 반려견 산책 코스의 특징을 잡아내는 전문 가이드입니다.\n"
        f"아래는 여러 산책 경로의 데이터입니다. 각 경로의 특성을 다른 경로들과 비교하여, 각 경로만의 차별적 장점이나 분위기를 창의적으로 설명해 주세요.\n"
        f"설명은 반드시 JSON 배열로만 반환하세요. (예시, 지침, 문장 구조 제한 없이 자유롭게)\n"
        f"각 설명은 해당 경로가 다른 경로에 비해 어떤 점이 두드러지는지, 또는 상대적으로 어떤 분위기/장점이 있는지 중심으로 작성하세요.\n"
        f"반려견 특징: {persona_intro}\n"
        f"사용자 입력 요약: {user_conditions}\n"
        f"활성 규칙: {activated_rules}\n"
        f"목표 시간: {target_minutes}분\n"
        f"경로별 데이터(JSON): {json.dumps(features, ensure_ascii=False)}\n"
        f"전체 경로 통계(JSON): {json.dumps(stats, ensure_ascii=False)}\n"
    )

    import traceback
    try:
        print("[DEBUG] _call_azure_openai 호출 직전")
        response_text = _call_azure_openai(prompt)
        print("[DEBUG] _call_azure_openai 응답:", response_text)
        import re
        def clean_json_response(response_text):
            # ```json ... ``` 또는 ``` ... ``` 제거
            return re.sub(r"^```(?:json)?|```$", "", response_text.strip(), flags=re.MULTILINE).strip()
        cleaned_response = clean_json_response(response_text)
        parsed = json.loads(cleaned_response)
        if isinstance(parsed, list) and len(parsed) == len(routes):
            def extract_text(item):
                if isinstance(item, dict) and "description" in item:
                    return str(item["description"]).strip()
                return str(item).strip()
            cleaned = [extract_text(item) for item in parsed]
            if all(cleaned):
                print("[AI 설명 생성 성공]", cleaned)
                print("[DEBUG] build_route_explanations 탈출 (AI 설명)")
                return cleaned
        print("[DEBUG] build_route_explanations 탈출 (fallback)")
        return fallback
    except Exception:
        print("[DEBUG] build_route_explanations except 진입")
        print(traceback.format_exc())
        print("[DEBUG] build_route_explanations 탈출 (except)")
        return fallback
