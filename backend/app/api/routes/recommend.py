from fastapi import APIRouter
from app.models.trail import TrailRecommendationRequest, TrailRecommendationResponse
from app.services.trail_recommend import get_recommended_trails

router = APIRouter()

@router.post("/recommend", response_model=TrailRecommendationResponse, summary="사용자 위치 기반 산책로 추천")
def recommend_trails(request: TrailRecommendationRequest):
    """
    사용자의 현재 위도(Y)와 경도(X)를 받아서
    반려견 출입이 가능한 강동구 산책로 목록을 가장 가까운 순서대로 반환합니다.
    (추후 경사도, 혼잡도 필터링 변수가 추가될 부분입니다)
    """
    trails = get_recommended_trails(
        user_lat=request.user_lat, 
        user_lng=request.user_lng, 
        max_distance_km=request.max_distance_km,
        limit=request.limit
    )
    
    return TrailRecommendationResponse(
        items=trails,
        count=len(trails)
    )
