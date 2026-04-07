from fastapi import APIRouter
from app.models.trail import TrailRecommendationRequest, TrailRecommendationResponse, HazardResponse
from app.services.trail_recommend import get_recommended_trails

router = APIRouter()

@router.post("/recommend", response_model=TrailRecommendationResponse, summary="사용자 위치 기반 산책로 추천")
def recommend_trails(request: TrailRecommendationRequest):
    """
    사용자의 현재 위도(Y)와 경도(X)를 받아서
    반려견 출입이 가능한 강동구 산책로 목록을 가장 가까운 순서대로 반환합니다.
    (추후 경사도, 혼잡도 필터링 변수가 추가될 부분입니다)
    """
    trails, weather_info = get_recommended_trails(
        user_lat=request.user_lat, 
        user_lng=request.user_lng, 
        max_distance_km=request.max_distance_km,
        limit=request.limit,
        view_type=request.view_type,
        use_realtime_api=request.use_realtime_api
    )
    
    return TrailRecommendationResponse(
        items=trails,
        weather_temp=weather_info.get("temp") if weather_info else None,
        weather_pm10=weather_info.get("pm10") if weather_info else None,
        weather_msg=weather_info.get("msg") if weather_info else None,
        count=len(trails)
    )

@router.get("/hazards", response_model=HazardResponse)
def get_hazards():
    """
    지도에 렌더링할 100건의 캐싱된 돌발정보(TOPIS)와
    실시간 재난문자(행정안전부)를 하이브리드로 병합하여 반환합니다.
    """
    from app.services.weather_congestion import fetch_disaster_messages
    from app.core.config import settings
    import os
    import json
    
    incidents = []
    try:
        json_path = os.path.join(settings.DATA_DIR, "seoul_incidents.json")
        if os.path.exists(json_path):
            with open(json_path, "r", encoding="utf-8") as f:
                incidents = json.load(f)
    except Exception as e:
        print(f"Error reading incidents cache: {e}")
        
    disasters = fetch_disaster_messages()
    
    return HazardResponse(
        incidents=incidents,
        disasters=disasters
    )
