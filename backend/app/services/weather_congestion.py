import urllib.request
import urllib.parse
import json
from app.core.config import settings

def fetch_city_data(area_name: str):
    """
    서울 실시간 도시 데이터 API 통신 함수
    주어진 장소 이름(area_name)으로 날씨 및 혼잡도 정보를 요쳥합니다.
    (주의: 서울시가 지정한 115 핫스팟과 이름이 일치해야만 데이터가 반환됨)
    """
    try:
        # 한글 이름 URL 인코딩 처리
        encoded_area = urllib.parse.quote(area_name)
        # XML 대신 JSON 포맷으로 요청
        url = f"http://openapi.seoul.go.kr:8088/{settings.SEOUL_CITY_API_KEY}/json/citydata/1/5/{encoded_area}"
        
        req = urllib.request.Request(url)
        # Timeout을 짧게 주어 메인 스레드 블로킹 방지 (3초)
        res = urllib.request.urlopen(req, timeout=3)
        data = json.loads(res.read().decode('utf-8'))
        
        # 값이 정상적으로 있으면 CITYDATA 최상단 객체를 리턴
        if "CITYDATA" in data:
            return data["CITYDATA"]
        return None
    except Exception as e:
        print(f"CityData API Error for {area_name}: {e}")
        return None

def fetch_disaster_messages():
    """
    공공데이터포털(data.go.kr) 행정안전부 재난문자 API를 1분/버튼 단위로 실시간 조회
    """
    if settings.DISASTER_API_KEY == "PLEASE_ENTER_YOUR_API_KEY_HERE":
        return [{"sn":"1", "crt_dt":"방금", "msg_cn":"[테스트] API 키가 입력되지 않았습니다. config.py에 키를 입력하세요.", "rcptn_rgn_nm":"서울 강동구", "emrg_step_nm":"안전안내", "dst_se_nm":"안내"}]
        
    try:
        url = "http://apis.data.go.kr/1741000/DisasterMsg3/getDisasterMsg1List"
        # 쿼리 파라미터 조합 (요청 포맷 준수)
        params = {
            "serviceKey": settings.DISASTER_API_KEY,
            "pageNo": "1",
            "numOfRows": "10",
            "type": "json"
        }
        
        query_string = urllib.parse.urlencode(params)
        # 중요: serviceKey는 이미 인코딩된 상태로 제공되는 경우가 많으므로 이중 인코딩을 조심해야 할 수도 있음.
        # 일반적인 urllib.parse.urlencode 사용. 만약 에러 시 로컬에서 키 자체를 붙여서 테스트
        
        req = urllib.request.Request(url + "?" + query_string)
        res = urllib.request.urlopen(req, timeout=3)
        data = json.loads(res.read().decode('utf-8'))
        
        results = []
        # 파싱 로직 (공공데이터포털 JSON 구조: response.body.items.item 등 보통 사용)
        if "DisasterMsg" in data:
            # 해당 API의 표준 포맷을 가정 (행안부 API 명세 준수)
            items = data["DisasterMsg"][1]["row"]
            for item in items:
                # 서울/강동구 필터링 로직 등도 가능하나 여기선 전부 파싱
                results.append({
                    "sn": str(item.get("sn", "")),
                    "crt_dt": str(item.get("create_date", item.get("crt_dt", ""))),
                    "msg_cn": str(item.get("msg", item.get("msg_cn", ""))),
                    "rcptn_rgn_nm": str(item.get("location_name", item.get("rcptn_rgn_nm", ""))),
                    "emrg_step_nm": str(item.get("send_platform", item.get("emrg_step_nm", ""))),
                    "dst_se_nm": str(item.get("send_platform", item.get("dst_se_nm", "")))
                })
        return results
    except Exception as e:
        print(f"Disaster Message API Error: {e}")
        return []
