import os
from typing import Any, Dict, List, Optional, Tuple

from app.models.small_scale.route import DogProfile, WalkCondition, WeatherContext


CONGESTION_ORDER = {
    "여유": 0,
    "보통": 1,
    "약간 붐빔": 2,
    "붐빔": 3,
}


def _is_vulnerable_dog(dog: Optional[DogProfile]) -> bool:
    if dog is None:
        return False
    return bool(
        dog.size == "소형"
        or dog.joint_sensitive
        or dog.age_group == "노령견"
        or dog.is_long_back
    )


def _is_high_temp(weather: Optional[WeatherContext]) -> bool:
    if weather is None or weather.temperature_c is None:
        return False
    threshold = float(os.getenv("SCENARIO1_HOT_TEMP_C", "27"))
    return weather.temperature_c >= threshold


def _heat_risk_threshold() -> float:
    return float(os.getenv("SCENARIO1_HEAT_RISK_THRESHOLD", "60"))


def _heat_risk_threshold_mild() -> float:
    return float(os.getenv("SCENARIO1_HEAT_RISK_THRESHOLD_MILD", "70"))


def _cushion_score_threshold() -> float:
    return float(os.getenv("SCENARIO1_CUSHION_SCORE_THRESHOLD", "10"))


def _steep_limit() -> int:
    return int(os.getenv("SCENARIO1_STEEP_LIMIT", "6"))


def _stairs_limit() -> int:
    return int(os.getenv("SCENARIO1_STAIRS_LIMIT", "3"))


def _noise_threshold() -> float:
    return float(os.getenv("SCENARIO1_NOISE_THRESHOLD", "50"))


def _is_crowd_sensitive(walk: Optional[WalkCondition]) -> bool:
    if walk is None or not walk.crowd_preference:
        return False
    return walk.crowd_preference.strip() == "조용한 곳"


def _congestion_level_value(text: Optional[str]) -> int:
    if not text:
        return -1
    cleaned = str(text).strip()
    return CONGESTION_ORDER.get(cleaned, -1)


def _is_neutral_request(dog: Optional[DogProfile], walk: Optional[WalkCondition]) -> bool:
    """
    사용자가 사실상 '상관없음'으로 요청한 경우를 판별.
    이 경우 시나리오1 배제 규칙을 적용하지 않는다.
    """
    if dog is None and walk is None:
        return True

    dog_neutral = True
    if dog is not None:
        dog_neutral = not any([
            dog.joint_sensitive,
            dog.is_long_back,
            dog.is_brachycephalic,
            dog.noise_sensitive,
            dog.heat_sensitive,
            dog.size == "소형",
            dog.age_group == "노령견",
        ])

    walk_neutral = True
    if walk is not None:
        walk_neutral = (
            (walk.crowd_preference in (None, "상관없음"))
            and (walk.slope_preference in (None, "상관없음"))
        )

    return dog_neutral and walk_neutral


def evaluate_route_rules(
    profile: Dict[str, Any],
    dog: Optional[DogProfile],
    walk: Optional[WalkCondition],
    weather: Optional[WeatherContext],
) -> Tuple[bool, List[str], List[str]]:
    """
    시나리오1 규칙 평가.
    
    - 취약견: 급경사/계단 배제 (DB 기반)
    - 고온: 여름철 화상 주의 배제 (DB 기반)
    - 단두종/더위민감: heat_risk 임계값 배제 (DB 기반)
    - 소음민감: 차량 비중 높은 구간 회피 (그래프 기반, sdot_avg_noise는 미사용)
    - 혼잡도민감: weather_context의 실시간 혼잡도 기반 필터 (API 기반)
    """
    reject_reasons: List[str] = []
    warnings: List[str] = []

    # 돌발/통제 구간은 사용자의 다른 선호와 무관하게 우선 회피한다.
    if profile.get("has_hazard"):
        hazard_hits = profile.get("hazard_hits") or []
        if hazard_hits:
            first_hit = hazard_hits[0]
            hazard_type = first_hit.get("acc_type", "돌발상황")
            hazard_info = first_hit.get("acc_info", "")
            if hazard_info:
                reject_reasons.append(f"돌발/통제({hazard_type}) 구간 배제: {hazard_info}")
            else:
                reject_reasons.append(f"돌발/통제({hazard_type}) 구간 배제")
        else:
            reject_reasons.append("돌발/통제 구간 배제")

    # 사용자가 '상관없음' 조합으로 입력한 경우에는 돌발상황 외의 배제 규칙을 적용하지 않는다.
    if _is_neutral_request(dog, walk):
        return len(reject_reasons) == 0, reject_reasons, warnings

    if _is_vulnerable_dog(dog):
        steep_count = int(profile.get("steep_count") or 0)
        stair_count = int(profile.get("stair_count") or 0)

        if steep_count > _steep_limit():
            reject_reasons.append(f"취약견 조건으로 급경사 {steep_count}개 초과 구간 배제")
        elif steep_count > 0:
            warnings.append(f"급경사 {steep_count}개가 포함되어 있지만 허용 범위 내입니다")

        if stair_count > _stairs_limit():
            reject_reasons.append(f"취약견 조건으로 계단 {stair_count}개 초과 구간 배제")
        elif stair_count > 0:
            warnings.append(f"계단 {stair_count}개가 포함되어 있지만 허용 범위 내입니다")

        if stair_count > 0 and steep_count > 0:
            warnings.append("취약견 우선순위는 계단 > 급경사로 적용됩니다")

        min_cushion_score = profile.get("min_cushion_score")
        if min_cushion_score is not None and float(min_cushion_score) <= _cushion_score_threshold():
            warnings.append(
                f"노면 쿠션 점수가 낮은 구간(cushion_score <= {_cushion_score_threshold():.0f})이 일부 포함됩니다"
            )

    if _is_high_temp(weather) and profile.get("has_hot_surface_grade"):
        reject_reasons.append("고온 조건에서 여름철 화상 주의 구간 배제")

    if dog and (dog.is_brachycephalic or dog.heat_sensitive):
        max_heat_risk = profile.get("max_heat_risk")
        if max_heat_risk is not None:
            # 단두종+더위민감 동시 true면 더 엄격한 60, 아니면 70 기준 적용
            threshold = _heat_risk_threshold() if (dog.is_brachycephalic and dog.heat_sensitive) else _heat_risk_threshold_mild()
            if float(max_heat_risk) >= threshold:
                reject_reasons.append(f"단두종/더위민감 조건으로 heat_risk {threshold:.0f} 이상 구간 배제")

    # 소음민감: 차량 비중 + sdot_avg_noise(50+) 동시 충족 시 배제
    if dog and dog.noise_sensitive:
        vehicle_heavy = float(profile.get("vehicle_ratio") or 0.0) >= 0.45
        max_noise = profile.get("max_noise")
        noisy = max_noise is not None and float(max_noise) >= _noise_threshold()

        if vehicle_heavy and noisy:
            reject_reasons.append("소음 민감 조건으로 차량 많은 구간 + 소음 50 이상 구간 배제")
        elif vehicle_heavy:
            warnings.append("차량이 많은 구간이 포함되어 소음 민감 조건에 불리할 수 있습니다")

    # 혼잡도민감: DB AREA_CONGEST_LVL 우선, 없으면 weather 컨텍스트 사용
    if _is_crowd_sensitive(walk):
        route_levels = profile.get("congest_levels") or []
        route_reject = any(_congestion_level_value(level) >= _congestion_level_value("약간 붐빔") for level in route_levels)

        if route_reject:
            reject_reasons.append("혼잡도 민감 조건으로 약간 붐빔 이상 구간 배제")
        elif weather and weather.area_congest_lvl:
            level = _congestion_level_value(weather.area_congest_lvl)
            if level >= _congestion_level_value("약간 붐빔"):
                reject_reasons.append("혼잡도 민감 조건으로 약간 붐빔 이상 구간 배제")

    if walk and walk.slope_preference == "평지 위주" and profile.get("has_steep"):
        warnings.append("평지 위주 선호와 일부 경사 구간이 충돌했습니다")

    passed = len(reject_reasons) == 0
    return passed, reject_reasons, warnings


def build_filter_info(
    dog: Optional[DogProfile],
    walk: Optional[WalkCondition],
    weather: Optional[WeatherContext],
    total_routes: int,
    accepted_routes: int,
    rejected_by_route: Dict[int, List[str]],
    db_used_any: bool,
    db_reason_samples: List[str],
    hazard_used_any: bool = False,
    hazard_reason_samples: Optional[List[str]] = None,
) -> Dict[str, Any]:
    applied_rules = []

    if hazard_used_any:
        applied_rules.append("돌발/통제 구간 회피")
    if _is_vulnerable_dog(dog):
        applied_rules.append(
            f"취약견(소형/관절/노령/장허리): 계단>{_stairs_limit()}개 우선, 급경사>{_steep_limit()}개 배제"
        )
    if _is_high_temp(weather):
        applied_rules.append("고온 시 여름철 화상 주의 구간 배제")
    if dog and (dog.is_brachycephalic or dog.heat_sensitive):
        applied_rules.append(
            f"단두종+더위민감 동시: heat_risk >= {_heat_risk_threshold():.0f}, 그 외: >= {_heat_risk_threshold_mild():.0f} 배제"
        )
    if dog and dog.noise_sensitive:
        applied_rules.append(f"차량 많은 구간 + sdot_avg_noise >= {_noise_threshold():.0f} 배제")
    if _is_crowd_sensitive(walk):
        applied_rules.append("약간 붐빔 이상 구간 배제 (AREA_CONGEST_LVL 우선)")

    warnings: List[str] = []
    if not db_used_any:
        warnings.append("PostgreSQL 경로 특성 조회를 사용하지 못해 일부 규칙이 보수적으로 동작했습니다")
    if db_reason_samples:
        warnings.append(f"DB 조회 상태: {db_reason_samples[0]}")
    if hazard_reason_samples:
        warnings.append(f"돌발 회피 상태: {hazard_reason_samples[0]}")

    summary = f"시나리오1 필터 적용: {total_routes}개 후보 중 {accepted_routes}개 채택"

    return {
        "summary": summary,
        "applied_rules": applied_rules,
        "total_candidates": total_routes,
        "accepted": accepted_routes,
        "rejected": total_routes - accepted_routes,
        "rejected_by_route": rejected_by_route,
        "warnings": warnings,
    }
