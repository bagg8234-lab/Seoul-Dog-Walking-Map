# 🐶 반려동물 산책로 추천 시스템 (Pet Route) 개발 및 배포 가이드

본 문서는 반려동물 산책로 추천 프로젝트의 백엔드 시스템(FastAPI)을 클라우드 환경(Azure Web App)에 성공적으로 배포하기까지의 과정과, 향후 기능을 추가하거나 유지보수할 팀원들을 위한 핵심 가이드를 담고 있습니다.

---

## 1. 지금까지 진행된 주요 작업 내역 (Deployment History)

우리는 로컬에서만 동작하던 산책로 추천 모델을 무중단 배포 가능한 프로덕션 환경으로 끌어올렸습니다.

### 🌐 클라우드 배포 인프라 구축
- **Docker 컨테이너화**: 로컬 OS 환경에 구애받지 않도록 `python:3.10-slim` 기반의 Dockerfile을 작성하여 모든 공간분석 라이브러리(GDAL, GEOS 등) 인프라를 통일했습니다.
- **Azure Web App & ACR 연동**: 배포 자동화를 위해 Azure Container Registry(ACR)에 도커 이미지를 저장하고, 이를 Azure App Service(Web App for Containers)로 불러오도록 구성했습니다.
- **GitHub Actions (CI/CD) 파이프라인**: 코드를 메인 브랜치(`main`)에 Push하면, 자동으로 Docker 빌드가 진행되고 Azure로 배포되는 `azure-deploy.yml` 워크플로우를 완성했습니다.

### 🛠️ 백엔드 시스템(FastAPI) 최적화
- **CORS 활성화**: `CORSMiddleware`를 적용하여, 향후 프론트엔드/모바일 앱에서 도메인에 구애받지 않고 산책로 API(`GET /api/trails`, `GET /api/routes`)를 호출할 수 있도록 개방했습니다.
- **메모리 안정화 및 데이터 용량 처리**: 
  - Vworld 경로 데이터 등 초기 메모리를 크게 점유하는 초거대 SHP 파일 관리를 위해 Azure 서버를 **Premium V3(P1V3)** 스펙(RAM 8GB)으로 Scale-up 하였습니다.
  - GitHub의 100MB 단일 파일 용량 업로드 제한을 피하고자 `.gitignore`를 통해 무거운 원본 정적 데이터를 예외 처리하고 전처리된 캐시를 활용하도록 대응했습니다.

### 🐞 트러블슈팅(Troubleshooting) 요약
- **`ImagePullUnauthorizedFailure` 해결**: Azure 배포 센터(Deployment Center)에서 ACR 레지스트리의 '관리자 자격 증명' 연결을 정상화.
- **`ModuleNotFoundError` (Missing Dependencies)**: 도커 빌드 시 `SecondProjectTeam3/requirements.txt`와 내부 백엔드의 `requirements.txt`가 파편화되어 패키지(`pyshp`, `pyyaml`)가 누락되는 문제 해결.
- **`ContainerCreateFailure` 방어**: 오입력된 Azure '시작 명령(Startup Command)'(`gunicorn`)을 빈칸으로 리셋하여 Dockerfile 내부의 `uvicorn` 명령어가 정상 동작하도록 핫픽스 수행.

---

## 2. 🚀 향후 개발자를 위한 기능 추가 가이드

프로젝트에 새로운 API나 알고리즘 기능을 붙이실 분들은 아래의 프로세스를 엄격히 준수해 주시길 바랍니다.

### A. 새로운 파이썬 라이브러리(Module) 설치 시
가장 많은 에러가 발생하는 구간입니다. 기능을 추가하며 `pip install [패키지]`를 하셨다면, **반드시 최상단 폴더의 `requirements.txt`에 해당 패키지와 버전을 명시**해야 합니다.
> [!CAUTION]
> 이것을 빼먹으면, 본인 컴퓨터에서는 잘 돌아가는데 GitHub에 올리는 순간 Azure 서버가 켜지지도 않고 뻗어버리는(`ContainerCreateFailure`) 참사가 일어납니다.

### B. 로컬 도커(Docker) 검증 필수
작업을 마친 뒤 바로 GitHub에 Push하지 마시고, 내 컴퓨터에서 직접 Docker를 말아서 작동하는지 최종 테스트하세요. 클라우드 오류의 90%는 이 로컬 테스트에서 걸러낼 수 있습니다.
```bash
# 1. 도커 이미지 로컬에서 만들기
docker build -t pet-walk-test .

# 2. 로컬 도커 실행하기 (경로 모델이 터지진 않는지 확인)
docker run --rm -p 8000:8000 pet-walk-test
```
`Application startup complete.` 라는 메시지가 뜨면 Push 해도 안전합니다.

---

## 3. 🚨 반드시 알아야 할 주의사항 (Gotchas)

> [!WARNING]
> **Azure 포털의 '시작 명령(Startup Command)'은 절대 건드리지 마세요!**
> Azure Web App의 `환경 설정 > 일반 설정 > 시작 명령` 칸에 뭔가를 적으면 도커에 내장된 `CMD` 명령어를 무시하고 덮어써버립니다. 현재 최적화된 uvicorn 명령어가 세팅되어 있으니 해당 칸은 **항상 영구적으로 빈칸**으로 두어야 합니다.

> [!TIP]
> **갑자기 서버 접속이 안 되고 에러가 나면 어떻게 하나요?**
> Azure 서버는 기본적으로 내부 파이썬 에러 로그를 꽁꽁 숨겨둡니다. 장애가 터지면 다음의 순서로 진짜 원인을 찾으세요.
> 1. Azure 포털 접속 -> 웹앱(Web App) 선택 메뉴 이동
> 2. `App Service 로그 (App Service logs)` 탭에서 **Application logging (File system)** 켜기.
> 3. `로그 스트림 (Log stream)` 탭으로 이동해서, 파이썬이 어떤 파일의 몇 번째 줄에서 비명을 질렀는지 실시간(Traceback)으로 확인.

> [!IMPORTANT]
> **데이터베이스 / 초대형 파일(SHP/CSV) 취급 주의**
> 수백 MB를 넘어가는 VWorld 폴리곤 데이터나 좌표 테이블을 `data/` 폴더 산하에 무심코 추가하고 Git Push를 날리면 깃허브 전체가 마비될 수 있습니다. 
> 반드시 `.gitignore`에 해당 확장자를 차단했는지 점검하시기 바랍니다. 외부 클라우드 Blob Storage의 도입이나, 가벼운 GeoJSON / Pickle 형태로 사이즈를 깎아서 커밋하는 것을 추천합니다.

---

## 4. 💸 클라우드 과금 관리 및 요금 폭탄 방지

클라우드는 컴퓨터 콘센트를 뽑듯이 버튼 하나 누른다고 요금이 멈추지 않습니다. 아래의 요금 관리 원칙을 반드시 숙지하세요.

> [!CAUTION]
> **웹 앱 '중지(Stop)' 버튼만 누르면 요금이 멈출까요? 절대 아닙니다!**
> 요금은 웹 앱 자체가 아니라, 웹 앱이 할당되어 있는 **App Service 계획(대여한 서버 컴퓨터 공간)** 단위로 청구됩니다. Premium(P1V3) 요금제 자리를 잡아놓은 상태라면, 안의 웹 앱을 잠시 끄더라도 월 대여료가 풀(Full)로 청구됩니다.

### ✅ 올바른 요금 절감 및 관리 시나리오

**1. 당분간 사용하지 않거나, 발표/시연 때만 잠깐 쓸 예정일 때 (Scale Down)**
* 요금을 멈추려면 관련된 `App Service 계획(App Service Plan)` 리소스로 직접 이동합니다.
* 좌측의 **[스케일 업(App Service 계획)]** 메뉴를 누른 뒤, 가격 책정 계층을 **개발 및 테스트 용도의 `Free (F1)` 또는 가장 싼 요금제**로 낮춰서 저장합니다.
* *참고: 무료 요금제에서는 메모리(RAM) 부족으로 웹 앱 서버가 구동 중 기절하겠지만, 어차피 안 쓰는 동안 요금을 아끼려는 목적이므로 완전히 무시하셔도 됩니다.*
* 나중에 정상 구동이나 시연이 필요할 때만 잠시 들어와서 비싼 요금제로 올려서 작동시키고, 볼일이 끝나면 다시 무료 티어로 잽싸게 내립니다.

**2. 프로젝트 보존을 위해 방치할 때 (완전 삭제 추천)**
* 도커 컨테이너 이미지를 올려둔 **Azure Container Registry(ACR)** 이라는 녀석도 고정 유지비가 계속 발생합니다. (Basic 계층 기준 하루 약 200원 전후)
* 당분간 서비스를 구동할 명분조차 없다면, 눈물을 머금고 이번에 만드신 **해당 기능의 리소스 그룹(Resource Group) 자체를 싹 다 삭제**하시는 것이 가장 안전한 지갑 지킴이입니다. 
* *걱정하지 마세요! 가장 중요한 소스코드와 배포 설정파일은 GitHub에 그대로 살아있으므로, 나중에 Azure 리소스만 다시 만들어서 클릭 한 번 띡 누르면 똑같은 운영 서버가 거짓말처럼 부활합니다.*
