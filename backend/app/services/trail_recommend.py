import pandas as pd
import math
from app.models.trail import TrailInfo
from app.core.config import settings

# 앱 전역 설정에서 데이터 경로 가져오기
ABS_DATA_PATH = settings.PET_TRAIL_CSV

def haversine(lat1, lon1, lat2, lon2):
    """
    두 위경도 좌표점 사이의 직선 거리를 km 단위로 반환
    """
    R = 6371.0 # 지구 반지름 (km)
    
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)

    dlon = lon2_rad - lon1_rad
    dlat = lat2_rad - lat1_rad

    a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c

def get_recommended_trails(user_lat: float, user_lng: float, max_distance_km: float, limit: int = 5):
    """
    사용자 위치 기반으로 강동구(SGNG_CD=740), 반려견 동반 가능(Pet_AP=1) 산책로 추천
    """
    try:
        # 데이터가 없을 시 에러 방지
        df = pd.read_csv(ABS_DATA_PATH)
    except FileNotFoundError:
        print(f"Error: CSV 파일을 찾을 수 없습니다. 경로를 확인해주세요. ({ABS_DATA_PATH})")
        return []

    # 1. MVP용 필터링: 강동구 (SGNG_CD == 740) & 반려견 출입 가능 (Pet_AP == 1)
    # 추후 740 제한을 풀면 서울 전체 조회가 가능합니다.
    filtered_df = df[(df['SGNG_CD'] == 740) & (df['Pet_AP'] == 1)].copy()

    recommendations = []
    
    # 2. 거리 계산 로직 (시작 좌표 XCRD(경도), YCRD(위도) 기준)
    for _, row in filtered_df.iterrows():
        start_lat = float(row.get('PNTM_YCRD', 0))
        start_lng = float(row.get('PNTM_XCRD', 0))
        
        # 거리가 유효하지 않으면 패스
        if start_lat == 0 or start_lng == 0:
            continue
            
        dist = haversine(user_lat, user_lng, start_lat, start_lng)
        
        # 3. 최대 지정 거리 내에 있는 산책로만 리스트업
        if dist <= max_distance_km:
            trail = TrailInfo(
                trail_id=str(row['TRL_ID']),
                trail_name=str(row['TRL_NM']),
                is_pet_allowed=int(row['Pet_AP']),
                length_km=float(row.get('km', 0)),
                time_minute=int(row.get('minute', 0)),
                start_lat=start_lat,
                start_lng=start_lng,
                end_lat=float(row.get('TRMNA_YCRD', 0)),
                end_lng=float(row.get('TRMNA_XCRD', 0)),
                distance_from_user=round(dist, 2)
            )
            recommendations.append(trail)

    # 4. 사용자와 가까운 순서대로 정렬하여 반환
    recommendations.sort(key=lambda x: x.distance_from_user)
    
    return recommendations[:limit]
