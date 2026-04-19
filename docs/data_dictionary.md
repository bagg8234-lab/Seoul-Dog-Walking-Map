# 📋 데이터 정의서 (Data Dictionary)

> 반려견 산책로 위험도 분석 파이프라인에서 사용하는 Bronze / Silver 레이어의 테이블 및 컬럼 정의서입니다.

---

## 1. Bronze 레이어

OSM(OpenStreetMap) 및 VWorld 공간 데이터를 가공 없이 적재한 원천 레이어. geometry 컬럼은 모두 WKT 문자열(WGS84, EPSG:4326)로 저장된다.

---

### 1-1. `bronze.osm_edges` — 산책로 도로 네트워크

- **출처**: OpenStreetMap (osmnx 라이브러리)
- **파일**: `edges_final.geojson`
- **역할**: 전체 산책로 네트워크의 골격. 모든 분석의 기준 테이블.
- **도로 유형 참고**: [OSM highway 태그 문서](https://wiki.openstreetmap.org/wiki/Key:highway)

| **컬럼명** | **타입** | **결측치 / 전체** | **설명** |
|------------|----------|-------------------|----------|
| `id` | Long | 0 / 192,961 | OSM Way ID. Silver/Gold까지 유지되는 고유 식별자 |
| `u`, `v` | Long | 0 / 192,961 | 시작/끝 노드 ID. 경로 탐색 엔진 구축 시 필수 |
| `highway` | String | 0 / 192,961 | 도로 유형. `steps`는 계단 구간으로 별도 분류 |
| `length` | Double | 0 / 192,961 | 단위: 미터(m). 산책 경로 총 거리 산출에 사용 |
| `geometry` | String | 0 / 192,961 | WKT LineString (EPSG:4326) |
| `surface` | String | **163,496** / 192,961 | 노면 재질. 결측률 높아 브이월드 데이터로 보완 |
| `smoothness` | String | **191,725** / 192,961 | 노면 평탄도. 결측률 높아 브이월드 데이터로 보완 |
| `name` | String | 123,357 / 192,961 | 도로명. 결측 시 RAG 응답에서 "근처 산책로"로 지칭 |
| `width` | Double | 187,981 / 192,961 | 도로 폭(m). 결측률 높아 분석에서 제외 |

**`highway` 주요 값 설명**

| 값 | 설명 |
|----|------|
| `footway` | 지정된 보행 전용 도로 |
| `pedestrian` | 차량 통제된 보행자 도로 |
| `residential` | 주거지로 향하는 진입로 |
| `steps` | 계단 구간 |
| `living_street` | 보행자가 차량보다 우선권을 갖는 도로 |
| `track` | 농로 |
| `path` | 특정 용도가 지정되지 않은 경로 |

> ⭐ `surface`와 `smoothness` 결측치는 브이월드 토양 데이터와 결합해 보완한다.

---

### 1-2. `bronze.osm_leisure` — 공원 및 레저 시설

- **출처**: OpenStreetMap
- **파일**: `leisure_clean.geojson`
- **내용**: 공원, 반려견 놀이터 포인트 데이터

| **컬럼명** | **타입** | **결측치 / 전체** | **설명** |
|------------|----------|-------------------|----------|
| `leisure` | String | 0 / 349 | 시설 종류 (`park`, `dog_park`) |
| `name` | String | 0 / 349 | 시설 명칭 |
| `geometry` | String | 0 / 349 | WKT Point (EPSG:4326) |

---

### 1-3. VWorld 토양·지형 데이터 (5종)

- **출처**: VWorld 공간정보 오픈플랫폼
- **형식**: Shapefile (.shp)
- **대상 지역**: 강남구 · 송파구 · 강동구

#### `bronze.vworld_slope` — 경사도

| **컬럼명** | **타입** | **결측치 / 전체** | **주요 값** | **설명** |
|------------|----------|-------------------|-------------|----------|
| `SOILSLOPE` | String | 0 / 303 | `0-2%`, `2-7%`, `7-15%`, `15-30%`, `30-60%`, `60-100%` | 경사도 등급 |
| `geometry` | String | 0 / 303 | - | WKT Polygon (EPSG:4326) |

#### `bronze.vworld_soil_type` — 토양 종류

| **컬럼명** | **타입** | **결측치 / 전체** | **주요 값** | **설명** |
|------------|----------|-------------------|-------------|----------|
| `DEEPSOIL` | String | 0 / 171 | `식질`, `식양질`, `사질`, `사양질`, `미사식양질`, `미사사양질`, `기타` | 토양 종류 |
| `geometry` | String | 0 / 171 | - | WKT Polygon (EPSG:4326) |

#### `bronze.vworld_gravel` — 자갈 함량

| **컬럼명** | **타입** | **결측치 / 전체** | **주요 값** | **설명** |
|------------|----------|-------------------|-------------|----------|
| `SUR_STON` | String | 0 / 91 | `>35`, `10-35`, `<10`, `기타` | 표층 자갈 함량 등급 |
| `geometry` | String | 0 / 91 | - | WKT Polygon (EPSG:4326) |

#### `bronze.vworld_soil_depth` — 유효 토심

| **컬럼명** | **타입** | **결측치 / 전체** | **주요 값** | **설명** |
|------------|----------|-------------------|-------------|----------|
| `VLDSOILDEP` | String | 0 / 381 | `100초과`, `50-100`, `20-50`, `기타` | 유효 토심 등급 |
| `geometry` | String | 0 / 381 | - | WKT Polygon (EPSG:4326) |

#### `bronze.vworld_drainage` — 배수 등급

| **컬럼명** | **타입** | **결측치 / 전체** | **주요 값** | **설명** |
|------------|----------|-------------------|-------------|----------|
| `SOILDRA` | String | 0 / 487 | `매우양호`, `양호`, `약간양호`, `약간불량`, `불량`, `매우불량`, `기타` | 토양 배수 등급 |
| `geometry` | String | 0 / 487 | - | WKT Polygon (EPSG:4326) |

---

## 2. Silver 레이어

Bronze 레이어의 OSM 도로 데이터와 VWorld 5종 공간 데이터를 공간 조인(`ST_Distance`)으로 결합하여 생성한 피처 테이블. 보행자 경로 분석 및 RAG 기반 챗봇의 핵심 입력 데이터로 활용된다.

---

### 2-1. `silver.walk_features` — 산책로 위험도 피처

전체 행 수: **136,034**

| **컬럼명** | **타입** | **결측치** | **설명** | **산출 방식** |
|------------|----------|------------|----------|---------------|
| `id` | Long | 0 | OSM Way ID | Bronze 원천값 유지 |
| `start_node` | Long | 0 | 시작 노드 ID | Bronze 원천값 유지 |
| `end_node` | Long | 0 | 종료 노드 ID | Bronze 원천값 유지 |
| `geometry` | String | 0 | WKT LineString (WGS84) | Bronze 원천값 유지 |
| `length` | Double | 0 | 경로 길이 (m) | Bronze 원천값 유지 |
| `highway` | String | 0 | 도로 유형 | Bronze 원천값 유지 |
| `surface` | String | 109,644 | 노면 재질 | Bronze 원천값. 결측 시 점수 산출에서 토양 데이터로 대체 |
| `avg_slope` | Double | 1,629 | 평균 경사도 (%) | VWorld SOILSLOPE 수치 변환. 결측 시 highway 유형별 기본값 |
| `slope_type` | String | 0 | 경사 분류 | avg_slope 기반 파생. 아래 분류 기준 참고 |
| `soil_type` | String | 74,238 | 토양 종류 | VWorld DEEPSOIL 공간 조인 |
| `gravel_content` | String | 74,238 | 자갈 함량 등급 | VWorld SUR_STON 공간 조인 |
| `soil_depth` | String | - | 유효 토심 등급 | VWorld VLDSOILDEP 공간 조인 |
| `drainage_class` | String | - | 배수 등급 | VWorld SOILDRA 공간 조인 |
| `heat_risk` | Int | 0 | 지면 열 위험도 (0~100) | 노면 재질 베이스 + 배수 등급 가산. surface 없으면 토성+배수로 대체 |
| `roughness_score` | Double | 0 | 노면 거칠기 점수 (0~100) | smoothness 실측값 우선. 없으면 자갈함량→토성→재질→highway 순 추론 후 경사도 가중치 적용 |
| `cushion_score` | Int | 0 | 보행감 점수 (0~100) | 토심 베이스 + 토성 보정. surface 없으면 highway 유형으로 추정 |
| `inferred_surface` | String | 0 | 추정 노면 유형 | surface 실측값 우선. 없으면 cushion·roughness 점수로 추론 |
| `final_safety_grade` | String | 0 | 최종 안전 등급 | roughness·heat_risk 위험 기준 우선 판정 후 긍정 등급 순 분류 |
| `filter_attributes` | Array | 0 | UI 필터링용 태그 배열 | 경사도·계단유무·푹신함·지면뜨거움·거친길 |
| `road_description` | String | 0 | RAG용 자연어 설명 | 분석 속성을 자연어로 조합. LLM 기반 경로 추천 챗봇의 지식 베이스 |

---

### 2-2. `silver.park` — 공원 및 반려견 놀이터

| **컬럼명** | **타입** | **Null** | **설명** |
|------------|----------|----------|----------|
| `id` | Long | N | 고유 ID (monotonically_increasing_id 생성) |
| `name` | String | Y | 공원 명칭. 없으면 "장소명 없음" |
| `leisure` | String | N | 여가 시설 유형 (`park`, `dog_park`) |
| `geometry` | String | N | WKT Polygon/MultiPolygon (WGS84) |
