# 🛠️ Small-Scale 개발자를 위한 구조 변경 가이드

프로젝트 규모 확장에 따라 백엔드 폴더 구조가 **Large-Scale(산책로)**과 **Small-Scale(루프 경로)**로 명확하게 분리되었습니다. 앞으로 기능을 추가하거나 수정할 때 아래 가이드를 참고해 주세요.

---

## 📂 변경된 폴더 구조 (Small-Scale)

기존에 `api/routes`, `services`, `models`에 흩어져 있던 파일들이 각각의 `small_scale` 서브 디렉토리로 이동되었습니다.

| 구분 | 기존 위치 | **변경 후 위치 (신규)** |
| :--- | :--- | :--- |
| **API** | `api/routes/loop_route.py` | `api/routes/small_scale/loop_route.py` |
| **Service** | `services/loop_route_service.py` | `services/small_scale/loop_route_service.py` |
| **Service** | `services/graph_builder.py` | `services/small_scale/graph_builder.py` |
| **Service** | `services/loop_router.py` | `services/small_scale/loop_router.py` |
| **Service** | `services/overlay_loader.py` | `services/small_scale/overlay_loader.py` |
| **Service** | `services/weight_calculator.py` | `services/small_scale/weight_calculator.py` |
| **Model** | `models/route.py` | `models/small_scale/route.py` |
| **Utility** | `services/incident_scraper.py` | `services/small_scale/incident_scraper.py` |

---

## 🔄 주요 변경 사항 및 주의사항

### 1. 임포트 경로 (Import Paths)
이제 모든 내부 파일 참조 시 중간에 `small_scale` 경로를 포함해야 합니다.
```python
# AS-IS (기존)
from app.models.route import LoopRouteResponse
from app.services.graph_builder import build_graph

# TO-BE (변경 후)
from app.models.small_scale.route import LoopRouteResponse
from app.services.small_scale.graph_builder import build_graph
```

### 2. 패키지 초기화 (`__init__.py`)
새로 생성된 모든 폴더에는 `__init__.py`가 포함되어 있으므로, Python 패키지로 정상 인식됩니다. 새로운 서브 폴더를 만들 때도 이를 잊지 마세요.

### 3. 유틸리티 스크립트 실행
`incident_scraper.py`나 전처리 스크립트처럼 `python` 명령어로 직접 실행하는 파일들은 폴더가 깊어짐에 따라 `project_root` 계산 로직이 수정되었습니다 (`os.path.dirname`이 하나 더 추가됨). 
파일을 다른 곳으로 옮길 때 이 경로 계산 로직이 깨지지 않는지 확인이 필요합니다.

---

## 🚀 앞으로의 개발 팁
- **기능 추가**: 소규모 루프 경로와 관련된 새로운 알고리즘이나 오버레이 로직은 `app/services/small_scale/` 아래에 구현해 주세요.
- **데이터 추가**: Small-Scale 전용 데이터 처리가 필요하다면 `app/services/preprocessing/` 폴더를 활용하여 로직을 분리하는 것을 추천합니다.

궁금한 점이 있다면 언제든 팀 내 공유 문서를 확인하거나 담당자에게 문의해 주세요!
