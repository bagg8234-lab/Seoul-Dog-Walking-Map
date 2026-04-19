# 🐾 Pet-Walk: 반려동물 산책로 위험도 분석 및 추천 시스템

반려동물과 함께 쾌적하고 안전한 산책을 즐길 수 있도록, **지형 정보(경사도·바닥 재질), 실시간 기상 데이터, 인근 시설 정보**를 종합 분석하여 최적의 산책로를 추천하는 백엔드 시스템입니다.

---

## 🏗 전체 시스템 아키텍처

![전체 아키텍처](./image/전체_아키텍처.png)

| 구분 | 서비스 | 역할 |
|------|--------|------|
| 데이터 수집 | Azure Data Factory | OSM, V-World, 서울 API, S-DoT 자동 수집 |
| 데이터 처리 | Azure Databricks (Apache Sedona) | 공간 조인 및 지표 산출 |
| 데이터 저장 | Azure Blob Storage (raw / silver / gold) | 계층형 데이터 레이크 |
| DB | Azure Database for PostgreSQL (PostGIS) | 공간 데이터 적재 및 서빙 |
| 백엔드 | FastAPI + Azure Web App | API 서버 (컨테이너 배포) |
| AI | Azure OpenAI (GPT-4o / GPT-4o-mini) | 산책로 추천 자연어 응답 |

---

## 🛠 데이터 파이프라인

### 1. 데이터 수집 (Azure Data Factory)

Azure Data Factory를 활용하여 4개 소스에서 공공 데이터를 자동 수집합니다.

![Data Factory 파이프라인](./image/datafactory_pipeline.png)
![Data Factory 연결 서비스](./image/datafactory_Linked_serivce.png)

- **OSM (Geofabrik)**: 도로 중심선 및 보행로 네트워크 (PBF 포맷)
- **V-World**: 토양 재질, 자갈 함량, 배수 등급 등 지형 특성
- **서울 열린데이터 광장 API**: 반려동물 동반 카페, 동물병원 시설 정보
- **S-DoT**: 산책로 인근 실시간 소음·진동 데이터

### 2. 데이터 처리 (Azure Databricks)

Azure Databricks에서 Apache Sedona를 활용하여 13만 개 이상의 도로 데이터에 대해 공간 조인(Spatial Join)을 수행하고, 반려견 특성을 고려한 핵심 지표를 산출합니다.

- **열 위험도**: 기온·복사열·토양 흡열 특성 기반
- **거칠기 점수**: 바닥 재질·자갈 함량 기반
- **쿠션 지수**: 토양 깊이·배수 등급 기반

#### ⚡ 성능 최적화 (트러블슈팅)

| 구분 | 내용 |
|------|------|
| 문제 | 단일 노드 환경에서 대규모 공간 조인 시 메모리 포화로 작업 강제 종료 |
| 해결 | 클러스터 4노드 확장 + 소규모 토양 레이어에 Broadcast Join 적용 |
| 결과 | 연산 시간 **14분 → 7분 (50% 단축)**, 안정적 파이프라인 확보 |

### 3. 데이터 저장 (계층형 레이크)

Azure Blob Storage를 Raw → Silver → Gold 계층으로 구성하여 데이터 품질을 단계적으로 관리합니다.

### 4. 데이터베이스 설계 (PostgreSQL + PostGIS)

![ERD](./image/ERD.png)

서비스 확장을 고려하여 산책로 특성(`walk_features`)과 환경 정보(`walk_environment`)를 분리 설계하였으며, PostGIS를 활용해 `LINESTRING` 공간 데이터를 서울시 좌표계에 정확히 매핑했습니다.

---

## 🚀 백엔드 서비스

### 시스템 배포 흐름

```mermaid
graph LR
    A[Local Code] -- "git push" --> B[GitHub Repository]
    B -- "Manual Trigger" --> C[GitHub Actions]
    C -- "Docker Build & Push" --> D[Azure Container Registry]
    D -- "Pull & Deploy" --> E[Azure Web App]

    subgraph "Azure Cloud"
    D
    E
    end
```

비용 최적화를 위해 **수동 배포(Workflow Dispatch)** 방식을 채택했습니다.

### 폴더 구조

```text
SecondProjectTeam3/
├── .github/workflows/    # CI/CD 워크플로 (Azure 배포)
├── backend/
│   └── app/
│       ├── api/          # API 엔드포인트 (추천, 지도, 안전 정보)
│       ├── core/         # 환경 설정
│       ├── models/       # Pydantic 데이터 모델
│       ├── services/     # 비즈니스 로직 (경사도 계산, 경로 탐색 등)
│       └── main.py
├── data/                 # 공간 정보 데이터셋 (SHP, GPX, GeoJSON)
├── Dockerfile
└── requirements.txt
```

### 로컬 실행

```bash
pip install -r requirements.txt
cd backend
uvicorn app.main:app --reload
# API 문서: http://127.0.0.1:8000/docs
```

---

## 📦 기술 스택

![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)
![Azure](https://img.shields.io/badge/Azure-0078D4?style=flat-square&logo=microsoftazure&logoColor=white)
![Apache Spark](https://img.shields.io/badge/Apache%20Spark-E25A1C?style=flat-square&logo=apachespark&logoColor=white)
