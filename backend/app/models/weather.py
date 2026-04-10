from pydantic import BaseModel
from typing import Optional

class WeatherRequest(BaseModel):
    area_name: str

class WeatherResponse(BaseModel):
    # 기본 기온/메시지
    temp: Optional[str] = None
    sensible_temp: Optional[str] = None
    max_temp: Optional[str] = None
    min_temp: Optional[str] = None
    humidity: Optional[str] = None
    wind_dirct: Optional[str] = None
    wind_spd: Optional[str] = None
    precipitation: Optional[str] = None
    precpt_type: Optional[str] = None
    pcp_msg: Optional[str] = None
    sunrise: Optional[str] = None
    sunset: Optional[str] = None
    uv_index_lvl: Optional[str] = None
    uv_index: Optional[str] = None
    uv_msg: Optional[str] = None
    
    # 미세먼지 / 초미세먼지 / 통합대기 관련
    pm25_index: Optional[str] = None
    pm25: Optional[str] = None
    pm10_index: Optional[str] = None
    pm10: Optional[str] = None
    air_idx: Optional[str] = None
    air_idx_mvl: Optional[str] = None
    air_idx_main: Optional[str] = None
    air_msg: Optional[str] = None
    
    weather_time: Optional[str] = None
    msg: Optional[str] = None
