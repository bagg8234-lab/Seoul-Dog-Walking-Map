import os
import json
import urllib.request
from dotenv import load_dotenv

# .env 로드
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# API Key 가져오기
api_key = os.environ.get("SeOUL_DATA_CENTER_API_KEY")
if not api_key:
    print("Error: SeOUL_DATA_CENTER_API_KEY not found in .env")
    exit(1)

# 데이터 저장 디렉토리 생성
data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "walkwayData", "PTP019401", "SDE_DODREAMWAY"))
os.makedirs(data_dir, exist_ok=True)

# API 호출 URL
url = f"http://openapi.seoul.go.kr:8088/{api_key}/json/SdeDoDreamWay04L/1/1000/"

print(f"Fetching from: {url}")
try:
    with urllib.request.urlopen(url) as response:
        data = json.loads(response.read().decode('utf-8'))
        
        # 파일 저장
        output_file = os.path.join(data_dir, "SdeDoDreamWay04L.json")
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        
        count = data.get("SdeDoDreamWay04L", {}).get("list_total_count", 0)
        print(f"Successfully saved {count} records to {output_file}")

        # Note: OpenAPI JSON/XML for this dataset usually only returns one X/Y coordinate per row (centroid/marker), not full line geometry.
        # Check first record to confirm
        rows = data.get("SdeDoDreamWay04L", {}).get("row", [])
        if rows:
            print(f"Sample Record: {rows[0]}")
            
except Exception as e:
    print(f"Error fetching data: {e}")
