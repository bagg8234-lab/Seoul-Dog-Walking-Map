# 반려견 산책로 연동 백엔드 API 명세서

협업하는 프론트엔드/클라이언트 개발자가 참고하실 수 있도록, 새롭게 구성된 `POST` 형태의 주요 API 세 가지에 대해 정리된 문서입니다.

---

## 1. 실시간 날씨 데이터 단독 조회 API

특정 지역(서울 핫스팟/구)에 대한 현재 날씨, 강수량, 미세먼지 수치 등을 단독으로 분리하여 응답받을 수 있는 초경량 API 호출 규격입니다. 화면 우측 하단의 날씨 위젯 등에 유용하게 쓸 수 있습니다.

- **Endpoint**: `POST /api/trails/weather`
- **Content-Type**: `application/json`

### Request (요청 예시)
```json
{
  "area_name": "강동구청" 
}
```
*`area_name`: 서울시 도시데이터 API 기준에 포함된 핫스팟 혹은 "강동구청" 등 대표 관공서 명칭.*

### Response (응답 예시)
```json
{
  "temp": "15.2",
  "sensible_temp": "14.8",
  "max_temp": "18.0",
  "min_temp": "12.0",
  "humidity": "45",
  "wind_dirct": "서북서",
  "wind_spd": "2.4",
  "precipitation": "0.0",
  "precpt_type": "없음",
  "pcp_msg": "강수없음",
  "sunrise": "06:12",
  "sunset": "18:55",
  "uv_index_lvl": "보통",
  "uv_index": "4.5",
  "uv_msg": "보통",
  "pm25_index": "좋음",
  "pm25": "12",
  "pm10_index": "보통",
  "pm10": "38",
  "air_idx": "좋음",
  "air_idx_mvl": "42",
  "air_idx_main": "초미세먼지",
  "air_msg": "공기가 상쾌해요",
  "weather_time": "2026-04-10 12:00",
  "msg": "구름 조금"
}
```

---

## 2. 사용자 위치 기반 장소 추천 API

지도 상에서 탐색된 사용자 좌표 기준으로, 지정한 검색 반경 내에서 가까운 거리의 산책로/공원/애견시설 등을 계산하여 반환합니다.

- **Endpoint**: `POST /api/trails/recommend`
- **Content-Type**: `application/json`

### Request (요청 파라미터)
```json
{
  "user_lat": 37.550,
  "user_lng": 127.150,
  "max_distance_km": 10.0,
  "limit": 15,
  "view_type": "facility",
  "use_realtime_api": false
}
```
- `max_distance_km`: 탐색할 최대 반경(km) (예: 10.0~20.0)
- `limit`: 반환할 최소 결과 개수
- `view_type`: `"trail+park"`(산책로+공원), `"trail"`(산책로만), `"park"`(공원만), `"facility"`(애견시설-병원/놀이터/카페) 중 택 1.
- `use_realtime_api`: 결과 리스트 안에 있는 명칭들 기준으로 혼잡도를 실시간으로 불러와 `TrailInfo` 객체에 붙일 지 여부 (`true` 시 외부 요청 대기 시간 증가).

### Response (응답 예시)
```json
{
  "items": [
    {
      "type": "hospital",
      "trail_id": "HP_45",
      "trail_name": "강동 해랑동물병원",
      "is_pet_allowed": 1,
      "length_km": 0.0,
      "time_minute": 0,
      "start_lat": 37.545,
      "start_lng": 127.145,
      "distance_from_user": 0.52,
      "pg_location": "서울특별시 강동구 성내로 45",
      "pg_phone": "02-1234-5678",
      "pg_notes": "정상영업"
      // 그 외 pg_hours(운영시간), pg_fee(요금), pg_large_dog(대형견출입) 등 선택 필드는 null 표기
    },
    {
      "type": "trail",
      "trail_id": "TRL_12",
      "trail_name": "성내 유수지 산책길",
      "distance_from_user": 1.25
      // ... 산책로 전용 필드 생략 ...
    }
  ],
  "count": 2
}
```
*응답 내의 레거시 구조(예: weather_temp)는 Optional 필드로 반환되나, 가급적 **날씨 단독 조회 API**(위 1번 문서)를 통해 활용하는 것을 권장합니다.*

---

## 3. 사용자 맞춤형 루프 산책 경로 생성 API

사용자의 위치, 반려견 프로필(크기, 나이, 민감도), 산책 조건(경사도 선호, 혼잡도 선호), 현재 날씨/혼잡도를 기반으로 **필터링된 루프 형태의 산책 경로**를 생성합니다.

이 API는 **배제된 경로들도 함께 반환**하여, 프론트엔드에서 시각화하고 필터링이 제대로 작동했는지 검증할 수 있습니다.

- **Endpoint**: `POST /api/loops/generate`
- **Content-Type**: `application/json`

### Request (요청 예시)
```json
{
  "user_lat": 37.514,
  "user_lng": 127.105,
  "target_minutes": 30,
  "num_routes": 3,
  "dog_profile": {
    "size": "중형",
    "age_group": "성견",
    "energy": "보통",
    "is_long_back": false,
    "is_brachycephalic": true,
    "noise_sensitive": false,
    "heat_sensitive": true,
    "joint_sensitive": false
  },
  "walk_condition": {
    "crowd_preference": "상관없음",
    "slope_preference": "평지 위주",
    "range_preference": "집 주변",
    "time_min": 30
  },
  "weather_context": {
    "temperature_c": 28.5,
    "area_congest_lvl": "보통"
  },
  "use_ai_explanation": true
}
```

**필드 설명:**
- `target_minutes` (int): 목표 산책 시간 (5~120분)
- `num_routes` (int): 생성할 경로 수 (1~5)
- `dog_profile` (객체, Optional): 반려견 정보
  - `size`: 소형/중형/대형
  - `age_group`: 강아지/성견/노령견
  - `energy`: 낮음/보통/높음
  - `is_long_back`: 장허리종 여부
  - `is_brachycephalic`: 단두종 여부
  - `noise_sensitive`: 소음 민감 여부
  - `heat_sensitive`: 더위 민감 여부
  - `joint_sensitive`: 관절 민감 여부
- `walk_condition` (객체, Optional): 산책 조건
  - `crowd_preference`: 조용한 곳/상관없음
  - `slope_preference`: 평지 위주/상관없음
  - `time_min`: 산책 시간(분)
- `weather_context` (객체, Optional): 현재 날씨/혼잡도
  - `temperature_c`: 기온(°C)
  - `area_congest_lvl`: 여유/보통/약간 붐빔/붐빔
- `use_ai_explanation` (bool): Azure OpenAI를 이용한 설명 생성 여부

### Response (응답 예시)
```json
{
  "routes": [
    {
      "route_id": 1,
      "estimated_minutes": 31.5,
      "total_distance_m": 2580,
      "waypoint_count": 8,
      "polyline": [
        [37.514, 127.105],
        [37.515, 127.106],
        [37.516, 127.107]
      ],
      "route_warnings": [],
      "route_explanation": "이 경로는 더위에 민감한 우리 아이를 위해 그늘진 공원 지역을 최우선으로 선택했습니다."
    }
  ],
  "rejected_routes": [
    {
      "route_id": 2,
      "estimated_minutes": 28.0,
      "total_distance_m": 2300,
      "waypoint_count": 7,
      "polyline": [
        [37.516, 127.107],
        [37.517, 127.108],
        [37.518, 127.109]
      ],
      "reject_reasons": [
        "단두종/더위민감 조건으로 heat_risk 임계 초과 구간 배제"
      ]
    },
    {
      "route_id": 3,
      "estimated_minutes": 32.0,
      "total_distance_m": 2400,
      "waypoint_count": 9,
      "polyline": [
        [37.515, 127.104],
        [37.516, 127.103],
        [37.517, 127.102]
      ],
      "reject_reasons": [
        "조건을 만족하는 경로가 부족함으로 생성된 추가 후보 경로"
      ]
    }
  ],
  "requested_lat": 37.514,
  "requested_lng": 127.105,
  "start_lat": 37.5142,
  "start_lng": 127.1055,
  "count": 1,
  "filter_info": {
    "summary": "단두종/더위민감 조건으로 heat_risk 지수가 높은 구간을 배제했습니다.",
    "applied_rules": [
      "단두종/더위민감: heat_risk >= 60 배제",
      "고온 시 여름철 화상 주의 구간 배제"
    ],
    "activated_rules": "R2(고온), R3(단두종/더위민감)",
    "no_match_found": false
  },
  "no_match_found": false,
  "no_match_message": null
}
```

**응답 필드 설명:**
- `routes`: 필터 조건을 만족하는 추천 경로 리스트
  - `route_id`: 경로 고유 식별자
  - `polyline`: 경로 좌표 배열 [[위도, 경도], ...]
  - `route_explanation`: 경로 추천 이유 (use_ai_explanation=true일 때만 생성)
- `rejected_routes`: **필터링으로 제외된 경로들** (시각화/검증용)
  - `route_id`: 경로 고유 식별자
  - `reject_reasons`: 배제 사유 리스트
  - 예: "취약견 조건으로 급경사 구간 배제", "소음 민감 조건으로 차량 비중이 높은 구간 배제"
- `filter_info`: 적용된 필터링 규칙 정보
  - `activated_rules`: 활성화된 규칙 (R1: 취약견, R2: 고온, R3: 단두종/더위, R4: 소음, R5: 혼잡도)
- `no_match_found`: 조건을 만족하는 경로가 없으면 true (fallback 경로 제공)

### 시각화 가이드

거부된 경로들(`rejected_routes`)을 지도에 표시하여 필터링이 제대로 작동했는지 검증할 수 있습니다:

- **추천 경로**: 초록색 실선으로 표시
- **거부된 경로**: 빨간색 점선으로 표시
- **각 팝업**: 거부 사유를 명확하게 표시

상세한 가이드는 [FILTERING_VISUALIZATION_GUIDE.md](./FILTERING_VISUALIZATION_GUIDE.md)를 참고하세요.

### 예외 상황

#### 조건을 만족하는 경로가 없을 때
```json
{
  "routes": [ /* fallback 경로 3개 */ ],
  "rejected_routes": [ /* 모든 생성 경로 */ ],
  "no_match_found": true,
  "no_match_message": "조건에 맞는 경로가 없습니다 (단두종/더위민감: heat_risk >= 60 배제). 아래는 필터 미적용 기본 경로입니다.",
  "count": 3
}
```

#### 사용자가 모든 필터를 "상관없음"으로 선택했을 때
```json
{
  "routes": [ /* 필터링 없이 상위 3개 경로 */ ],
  "rejected_routes": [],
  "filter_info": {
    "activated_rules": "없음",
    "summary": "시간/거리/루프 구조 중심의 중립 설명"
  },
  "count": 3
}
```

---

## 배제 규칙 참고

| 규칙 | 조건 | 영향받는 필터 |
|-----|------|--------------|
| R1 | 경로에 급경사(20%+) 또는 계단 구간 포함 | 소형견, 관절약함, 노령견, 장허리종 |
| R2 | 지표면 온도 높음 + 현재 기온 27°C 이상 | 고온날씨 |
| R3 | heat_risk 지수 ≥ 60 | 단두종, 더위민감 |
| R4 | 차량 비중 ≥ 45% | 소음민감 |
| R5 | 지역 혼잡도 "약간 붐빔" 이상 | 혼잡도민감 + crowd_preference="조용한 곳" |

---

## 성능 유의사항

- **첫 요청**: 그래프 초기 로딩으로 2~5초 소요
- **이후 요청**: 캐시된 그래프 사용으로 500ms~1초 소요
- **경로 생성**: 100개 후보 중 중복 제거 후 필터링으로 최대 2초 추가
