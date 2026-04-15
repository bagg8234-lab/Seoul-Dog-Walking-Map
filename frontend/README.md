````md
# Pet Walk App

반려견 맞춤 산책 경로 추천 앱입니다.  
사용자의 위치, 산책 조건, 반려견 정보를 바탕으로 산책 경로를 추천하고,  
홈 화면에서 경로 확인, 산책 시작/종료, 산책 기록 저장 기능을 제공합니다.

---

## 바로 실행 요약

```bash
npm install
npx expo start
````

실행 후 확인할 것:

* 추천 기능 테스트 전 `마이페이지`에서 강아지 정보를 먼저 저장해야 합니다.
* 백엔드 API 주소는 `app/(tabs)/index.tsx`, `app/(tabs)/recommend.tsx`에서 확인합니다.
* 이전 테스트 데이터가 남아 있으면 `마이페이지 > 앱 데이터 초기화`를 실행합니다.

---

## 1. 프로젝트 개요

이 앱은 다음 기능을 제공합니다.

* 반려견 정보 입력 및 저장
* 현재 위치 또는 주소 기반 출발 위치 설정
* 산책 시간 / 혼잡도 / 경사 조건 선택
* 추천 경로 요청
* 홈 화면에서 추천 경로 지도 표시
* 산책 시작 / 종료
* 산책 종료 시 기록 저장
* 날씨 / 미세먼지 표시
* 공원 / 산책로 / 편의시설 / 사고 및 통제 정보 표시

---

## 2. 기술 스택

### Frontend

* React Native
* Expo
* Expo Router
* TypeScript

### 주요 라이브러리

* `react-native-maps`
* `@gorhom/bottom-sheet`
* `expo-location`
* `@react-native-async-storage/async-storage`

### Backend

* FastAPI
* Azure App Service 배포 서버 사용

---

## 3. 프로젝트 폴더 구조

```bash
app/
  (tabs)/
    _layout.tsx      # 하단 탭 구성
    index.tsx        # 홈 화면
    recommend.tsx    # 추천 조건 입력 화면
    record.tsx       # 산책 기록 화면
    mypage.tsx       # 반려견 정보 입력/수정 화면

  _layout.tsx
  modal.tsx

assets/              # 이미지 등 정적 파일
components/          # 공통 컴포넌트 (현재 사용 적음)
constants/           # 상수 (현재 사용 적음)
hooks/               # 커스텀 훅
scripts/             # 실행용 스크립트
store/
  dogProfile.ts      # 반려견 정보 전역 저장
```

---

## 4. 주요 화면 설명

### `app/(tabs)/index.tsx`

홈 화면입니다.

기능:

* 지도 표시
* 추천 경로 표시
* 공원 / 산책로 / 편의시설 / 사고 및 통제 표시
* 산책 시작 / 종료
* 산책 기록 저장
* 날씨 / 미세먼지 정보 표시

### `app/(tabs)/recommend.tsx`

추천 조건 입력 화면입니다.

기능:

* 출발 위치 입력
* 현재 위치 사용
* 산책 시간 / 추천 시간 선택
* 혼잡도 / 경사 조건 선택
* 반려견 정보 확인 후 추천 API 호출

### `app/(tabs)/mypage.tsx`

반려견 정보 입력 / 수정 화면입니다.

기능:

* 크기 선택
* 나이대 선택
* 체형/건강 특성 선택
* 저장 / 수정
* 앱 데이터 초기화

### `app/(tabs)/record.tsx`

산책 기록 화면입니다.

기능:

* 종료된 산책 기록 목록 표시
* 시작/종료 시각 확인

---

## 5. 실행 방법

### 1) 패키지 설치

```bash
npm install
```

설치 충돌이 나면 아래 명령어 사용:

```bash
npm install --legacy-peer-deps
```

### 2) Expo 실행

```bash
npx expo start
```

### 3) 실행 방법

* Android Emulator
* Expo Go
* Web

---

## 6. 환경 설정

현재 프론트엔드에서 API 주소는 파일 내부에 직접 작성되어 있습니다.

예시:

```ts
const API_BASE_URL = 'https://pet-walk.azurewebsites.net';
```

필요 시 아래처럼 로컬 서버 주소로 변경해서 테스트할 수 있습니다.

```ts
const API_BASE_URL = 'http://10.0.2.2:8000';
```

### 참고

* Android Emulator에서 로컬 FastAPI 사용 시: `10.0.2.2`
* 실제 휴대폰에서 로컬 FastAPI 사용 시: PC의 같은 Wi-Fi 대역 IP 사용
* 프론트엔드와 백엔드가 같은 네트워크에 있어야 합니다.

---

## 7. 백엔드 연결 방식

추천 화면에서 조건을 입력하면 아래 API로 요청을 보냅니다.

### 추천 경로 요청

* `POST /api/routes/generate`

### 날씨 정보

* `POST /api/trails/weather`

### 주변 산책로/공원/시설 조회

* `POST /api/trails/recommend`

### 사고 및 통제 조회

* `GET /api/trails/hazards`

---

## 8. 저장 데이터

앱은 `AsyncStorage`를 사용해 일부 데이터를 저장합니다.

주요 키:

* `currentLocation` : 현재 위치
* `recommendedRoutes` : 추천 경로 목록
* `selectedRoute` : 선택 확정된 경로
* `recommendMeta` : 날씨/추천 메타 정보
* `walkSession` : 현재 산책 세션
* `walkRecords` : 산책 기록

---

## 9. 추천 기능 동작 방식

추천 화면에서 사용자가 입력한 값으로 API 요청을 보냅니다.

입력 항목:

* 출발 위치
* 산책 시간 또는 추천 시간
* 혼잡도 선호
* 경사 선호
* 반려견 정보

### 시간 선택 방식

* `15분 / 30분 / 60분` 선택 시: 해당 시간으로 추천 요청
* `추천` 선택 시: 시간을 직접 보내지 않고 `null`로 보내며, 백엔드가 반려견 정보를 기준으로 적절한 산책 시간을 판단

예시:

```json
{
  "target_minutes": null,
  "use_recommend_time": true
}
```

---

## 10. 현재 테스트 기준

현재 홈 화면 초기 위치는 올림픽공원 근처 기준으로 테스트 중입니다.

위치 관련 로직 확인 파일:

* `app/(tabs)/index.tsx`
* `app/(tabs)/recommend.tsx`

추천 화면에서 `현재 위치 사용`을 누르면 저장된 위치 또는 기본 위치를 사용합니다.

---

## 11. 협업 시 참고

### 자주 수정하는 파일

* 홈 화면 기능 수정: `app/(tabs)/index.tsx`
* 추천 로직 수정: `app/(tabs)/recommend.tsx`
* 반려견 정보 수정: `app/(tabs)/mypage.tsx`
* 기록 화면 수정: `app/(tabs)/record.tsx`
* 탭 구조 수정: `app/(tabs)/_layout.tsx`

### 작업 전 확인할 것

* 현재 테스트용 `API_BASE_URL`이 무엇인지 확인
* `AsyncStorage` 데이터 초기화가 필요한지 확인
* 추천 테스트 전 반려견 정보가 저장되어 있는지 확인

---

## 12. 테스트 체크리스트

### 추천 기능

* [ ] 출발 위치 입력 가능
* [ ] 현재 위치 사용 가능
* [ ] 반려견 정보 미입력 시 마이페이지 이동 안내
* [ ] 추천 시간 / 직접 시간 선택 가능
* [ ] 추천 결과가 홈 화면에 표시됨

### 홈 화면

* [ ] 추천 경로 선택 가능
* [ ] 산책 시작 가능
* [ ] 산책 종료 가능
* [ ] 종료 후 기록 저장됨
* [ ] 공원 / 산책로 / 편의시설 / 사고 및 통제 표시 가능

### 기록 화면

* [ ] 산책 기록 목록 표시
* [ ] 시작/종료 시간 정상 표시

### 마이페이지

* [ ] 반려견 정보 저장 가능
* [ ] 저장 후 추천 화면에 반영됨
* [ ] 앱 데이터 초기화 가능

---

## 13. 초기화 방법

앱 데이터 초기화는 마이페이지에서 가능합니다.

초기화 시 삭제되는 항목:

* 저장된 반려견 정보
* 추천 경로
* 현재 위치
* 산책 기록
* 산책 세션 정보

---

## 14. 문제 해결

### 추천이 안 뜰 때

* 백엔드 서버 실행 여부 확인
* `API_BASE_URL` 확인
* 반려견 정보 입력 여부 확인
* 위치 설정 여부 확인

### 이전 데이터가 남아 있을 때

* 마이페이지 > 앱 데이터 초기화 실행

### 로컬 서버 연결이 안 될 때

* Android Emulator: `10.0.2.2`
* 실제 기기: PC 로컬 IP 사용
* 백엔드와 프론트가 같은 네트워크인지 확인

### 지도는 뜨는데 경로가 안 보일 때

* `recommendedRoutes` 저장 여부 확인
* 홈 화면에서 추천 결과를 불러오는 로직 확인
* 백엔드 응답 JSON 구조 확인

---

## 15. 개발 메모

현재 코드는 화면별 파일에 기능이 많이 모여 있는 구조입니다.
빠르게 기능을 구현하고 수정하기 위해 분리하지 않고 유지 중입니다.

현재 구조 특징:

* `index.tsx` : 홈 화면 기능 대부분 포함
* `recommend.tsx` : 추천 조건 입력 + 추천 API 요청 포함
* `mypage.tsx` : 반려견 정보 입력/저장/초기화 포함
* `record.tsx` : 산책 기록 조회 포함

추후 필요하면 컴포넌트 / 서비스 / 타입 / 스타일 분리 예정입니다.

---


