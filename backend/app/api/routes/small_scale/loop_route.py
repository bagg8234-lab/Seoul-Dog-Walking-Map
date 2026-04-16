from fastapi import APIRouter
from app.models.small_scale.route import LoopRouteRequest, LoopRouteResponse
from app.services.small_scale.loop_route_service import generate_routes

router = APIRouter()


@router.post("/generate", response_model=LoopRouteResponse,
             summary="집 주변 소규모 루프 산책 경로 생성")
def create_loop_routes(request: LoopRouteRequest):
    """
    사용자의 위/경도와 목표 시간을 받아
    주변 도로 네트워크(OSM)에서 순환 산책 경로를 생성합니다.

    - 차도, 좁은 길, 계단을 자동으로 기피
    - 공원·놀이터 근처 경로를 우선 선택
    - 가중치 설정은 config/weights.yaml에서 조정 가능
    
    응답에는 두 가지 경로 정보가 포함됩니다:
    - routes: 필터 조건을 만족하는 추천 경로
    - rejected_routes: 필터 조건에 맞지 않아 제외된 경로 (시각화/검증용)
    """
    # 산책 시간 추천 로직 직접 처리
    if request.walk is not None:
        if request.user_lat is None and request.walk.latitude is not None:
            request.user_lat = request.walk.latitude
        if request.user_lng is None and request.walk.longitude is not None:
            request.user_lng = request.walk.longitude
        if request.target_minutes is None and request.walk.time_min is not None:
            request.target_minutes = request.walk.time_min
        # 프론트 표기값 보정
        if request.walk.crowd_preference == "혼잡도 상관없음":
            request.walk.crowd_preference = "상관없음"

    if request.target_minutes is None:
        # dog 정보가 있으면 추천 산책 시간 직접 계산
        if request.dog is not None:
            # 기본값 설정
            size = request.dog.size or "중형"
            age = request.dog.age_group or "성견"
            energy = request.dog.energy or "보통"
            constraint = (
                (request.dog.joint_sensitive is True)
                or (request.dog.is_long_back is True)
                or (request.dog.is_brachycephalic is True)
            )

            # 산책 시간 추천 로직 직접 작성
            # 기본값: 30분
            minutes = 30

            # 에너지 레벨 반영
            if energy == "매우 높음":
                minutes += 20
            elif energy == "높음":
                minutes += 10
            elif energy == "낮음":
                minutes -= 10
            elif energy == "매우 낮음":
                minutes -= 20

            # 나이 반영
            if age == "노령견":
                minutes -= 10
            elif age == "강아지":
                minutes -= 5

            # 크기 반영
            if size == "소형":
                minutes -= 5
            elif size == "대형":
                minutes += 5

            # 건강 제약 반영
            if constraint:
                minutes -= 10

            # 최소/최대값 제한
            if minutes < 10:
                minutes = 10
            if minutes > 90:
                minutes = 90

            request.target_minutes = minutes
        else:
            request.target_minutes = 30

    if request.user_lat is None or request.user_lng is None:
        raise ValueError("user_lat/user_lng 또는 walk.latitude/walk.longitude 중 하나는 반드시 필요합니다.")

    routes, rejected_routes, start_node, filter_info, no_match_found, no_match_message = generate_routes(
        user_lat=request.user_lat,
        user_lng=request.user_lng,
        target_minutes=request.target_minutes,
        num_routes=request.num_routes,
        dog_profile=request.dog,
        walk_condition=request.walk,
        weather_context=None,
        use_ai_explanation=True,
    )
    return LoopRouteResponse(
        routes=routes,
        rejected_routes=rejected_routes,
        requested_lat=request.user_lat,
        requested_lng=request.user_lng,
        start_lat=start_node[1],
        start_lng=start_node[0],
        count=len(routes),
        filter_info=filter_info,
        no_match_found=no_match_found,
        no_match_message=no_match_message,
    )
