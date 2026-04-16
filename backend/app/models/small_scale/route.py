from pydantic import BaseModel, Field, model_validator
from typing import List, Optional


class DogProfile(BaseModel):
    size: Optional[str] = Field(None, description="소형/중형/대형")
    age_group: Optional[str] = Field(None, description="강아지/성견/노령견")
    energy: Optional[str] = Field(None, description="낮음/보통/높음")
    is_long_back: bool = Field(False, description="장허리종 여부")
    is_brachycephalic: bool = Field(False, description="단두종 여부")
    noise_sensitive: bool = Field(False, description="소음 민감 여부")
    heat_sensitive: bool = Field(False, description="더위 민감 여부")
    joint_sensitive: bool = Field(False, description="관절 민감 여부")


class WalkCondition(BaseModel):
    address: Optional[str] = Field(None, description="사용자 주소")
    latitude: Optional[float] = Field(None, description="위도")
    longitude: Optional[float] = Field(None, description="경도")
    crowd_preference: Optional[str] = Field(None, description="조용한 곳/상관없음")
    slope_preference: Optional[str] = Field(None, description="평지 위주/상관없음")
    time_min: Optional[int] = Field(None, ge=5, le=180, description="산책 시간(분)")


class LoopRouteRequest(BaseModel):
    """소규모 루프 경로 추천 요청"""
    user_lat: Optional[float] = Field(None, description="출발점 위도", example=37.514)
    user_lng: Optional[float] = Field(None, description="출발점 경도", example=127.105)
    target_minutes: Optional[int] = Field(None, ge=5, le=120, description="목표 산책 시간(분)")
    num_routes: int = Field(3, ge=1, le=5, description="생성할 경로 수")

    # 신형 요청 포맷
    dog: Optional[DogProfile] = Field(None, description="반려견 고정 프로필")
    walk: Optional[WalkCondition] = Field(None, description="요청 시점 산책 조건")


    @model_validator(mode="after")
    def compute_target_minutes(self):
        # walk 정보 반영
        if self.walk:
            self.user_lat = self.user_lat or self.walk.latitude
            self.user_lng = self.user_lng or self.walk.longitude
            if self.target_minutes is None:
                self.target_minutes = self.walk.time_min

        # 추천 로직: None, 0, 5 미만 모두 잡기
        if self.target_minutes is None or self.target_minutes == 0 or (isinstance(self.target_minutes, int) and self.target_minutes < 5):
            if self.dog:
                minutes = 30
                energy_map = {"매우 높음": 20, "높음": 10, "보통": 0, "낮음": -10, "매우 낮음": -20}
                minutes += energy_map.get(self.dog.energy, 0)
                age_map = {"노령견": -10, "강아지": -5, "성견": 0}
                minutes += age_map.get(self.dog.age_group, 0)
                if self.dog.joint_sensitive or self.dog.is_long_back or self.dog.is_brachycephalic:
                    minutes -= 10
                if self.dog.size == "소형":
                    minutes -= 5
                elif self.dog.size == "대형":
                    minutes += 5
                self.target_minutes = max(10, min(90, minutes))
            else:
                self.target_minutes = 30
        return self


class WeatherContext(BaseModel):
    temperature_c: Optional[float] = Field(None, description="기온(C)")
    area_congest_lvl: Optional[str] = Field(None, description="혼잡도 텍스트")


class LoopRouteInfo(BaseModel):
    """개별 루프 경로 정보"""
    route_id: int
    estimated_minutes: float
    total_distance_m: float
    waypoint_count: int
    polyline: List[List[float]] = Field(..., description="경로 좌표 [[lat, lng], ...]")
    route_warnings: List[str] = Field(default_factory=list, description="경로별 주의사항")
    has_stairs: bool = Field(False, description="계단 포함 여부")
    route_explanation: Optional[str] = Field(None, description="경로 추천 사유 설명")


class RejectedRouteInfo(BaseModel):
    """필터링으로 거부된 경로 정보"""
    route_id: int
    estimated_minutes: float
    total_distance_m: float
    waypoint_count: int
    polyline: List[List[float]] = Field(..., description="경로 좌표 [[lat, lng], ...]")
    reject_reasons: List[str] = Field(..., description="거부 사유 목록")
    has_steep: bool = Field(False, description="급경사 포함 여부")
    has_stairs: bool = Field(False, description="계단 포함 여부")
    has_hot_surface_grade: bool = Field(False, description="여름철 화상 주의 구간 포함 여부")
    max_heat_risk: Optional[float] = Field(None, description="경로 내 최대 열 위험 지표")
    vehicle_ratio: float = Field(0.0, description="차량 비중")
    highways: List[str] = Field(default_factory=list, description="경로에 포함된 도로 종류")
    has_hazard: bool = Field(False, description="돌발상황 포함 여부")
    hazard_count: int = Field(0, description="경로 인근 돌발상황 수")
    nearest_hazard_distance_m: Optional[float] = Field(None, description="가장 가까운 돌발상황까지 거리(m)")
    nearest_hazard_type: Optional[str] = Field(None, description="가장 가까운 돌발상황 유형")


class LoopRouteResponse(BaseModel):
    """소규모 루프 경로 추천 응답"""
    routes: List[LoopRouteInfo]
    rejected_routes: List[RejectedRouteInfo] = Field(default_factory=list, description="필터링으로 제외된 경로들 (시각화/검증용)")
    requested_lat: float = Field(..., description="사용자가 요청한 실제 위도")
    requested_lng: float = Field(..., description="사용자가 요청한 실제 경도")
    start_lat: float = Field(..., description="그래프에서 스내핑된 위도")
    start_lng: float = Field(..., description="그래프에서 스내핑된 경도")
    count: int
    filter_info: dict = Field(default_factory=dict, description="시나리오1 필터 적용 결과")
    no_match_found: bool = Field(False, description="조건에 맞는 경로를 찾지 못했을 경우 true, 제공된 경로는 기본값")
    no_match_message: Optional[str] = Field(None, description="조건 미충족 상황 설명")
