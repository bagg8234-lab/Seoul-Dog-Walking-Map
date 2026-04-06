from fastapi import FastAPI
from fastapi.responses import FileResponse
import os
from app.api.routes import recommend

app = FastAPI(
    title="Pet Walkway Recommendation API",
    description="반려견 산책로 및 공원 추천을 위한 백엔드 API (MVP 버전)",
    version="1.0.0"
)

# 사용자님이 만드신 산책로 추천 라우터를 '/api/trails' 주소로 등록 (엔드포인트 그룹핑)
app.include_router(recommend.router, prefix="/api/trails", tags=["Trails Recommendation"])

@app.get("/")
def read_root():
    return {"message": "Pet Walkway Recommendation API is running!"}

@app.get("/map", summary="임시 테스트용 프론트엔드 맵 페이지")
def serve_map():
    html_path = os.path.join(os.path.dirname(__file__), "../index.html")
    return FileResponse(html_path)
