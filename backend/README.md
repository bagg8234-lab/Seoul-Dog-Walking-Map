# 반려동물 산책로 추천 팀 프로젝트 백엔드 가이드

현재 디렉토리는 추천 서비스 API를 위한 FastAPI 백엔드 뼈대입니다. 팀원들은 이 구조 안에서 충돌 없이 각자의 서버 모듈을 얹어서 작업하시면 됩니다.

## 1. 사전 준비 (설치 및 가상환경)
프로젝트 구동을 위해 Python 3.9 이상의 환경을 권장합니다.

```bash
# 1. 가상환경 생성 및 활성화
python -m venv venv

# Windows (Command Prompt)
venv\Scripts\activate.bat
# Windows (PowerShell)
.\venv\Scripts\Activate.ps1
# Mac/Linux
source venv/bin/activate

# 2. 패키지 설치
pip install -r requirements.txt
```

## 2. 모듈 디렉토리 가이드
기능별 코드를 철저하게 분리하여 작업합니다.
* `app/main.py`: 서버 메인 진입점. (라우터 붙일 때 외에는 거의 안 건드립니다)
* `app/api/routes/`: 기능별 API 엔드포인트 정의. (예: `recommend.py` 등)
* `app/services/`: **비즈니스 로직 작성 공간 (가장 중요)**. 각자 팀원들이 자신의 폴더/파일을 파서 실제 로직(데이터 필터링, ML 모델 등)을 작성합니다.
* `app/models/`: 데이터 인터페이스 구조체(Pydantic) 보관 장소. 구조에 맞는 데이터 타입을 명시합니다.

## 3. 로컬 테스트 및 API 문서 확인
코드를 작성하고 실행하는 방법입니다.

```bash
# /backend 폴더 내에서 실행! (app 폴더 바깥쪽)
uvicorn app.main:app --reload
```

* Swagger API 문서: `http://localhost:8000/docs`
이 페이지로 가시면 현재 등록된 API 목록이 자동으로 정리되어 있으며 프론트엔드 연결 전 테스트를 해볼 수 있습니다.
