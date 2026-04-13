import json
import os
from typing import List
from app.models.trail import TrailInfo
from app.core.config import settings

_soil_cache = None

def load_soil_cache():
    global _soil_cache
    if _soil_cache is not None:
        return _soil_cache
    
    cache_path = os.path.join(settings.DATA_DIR, "soil_cache.json")
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                _soil_cache = json.load(f)
                return _soil_cache
        except Exception as e:
            print(f"Error loading soil cache: {e}")
    
    _soil_cache = {}
    return _soil_cache

def inject_soil_info(items: List[TrailInfo]):
    cache = load_soil_cache()
    if not cache:
        return 

    for item in items:
        if item.type not in ["trail", "park"]:
            continue
            
        soil_data = cache.get(item.trail_name)
        
        if not soil_data:
            for cache_name, data in cache.items():
                if item.trail_name in cache_name or cache_name in item.trail_name:
                    soil_data = data
                    break
        
        if soil_data:
            item.soil_type = soil_data
        else:
            item.soil_type = "정보 없음"
