import json
import os
import sys
import xml.etree.ElementTree as ET

current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(current_dir))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from app.core.config import settings

def parse_gpx_points(gpx_path: str) -> list[tuple[float, float]]:
    """GPX 파일에서 WGS84 위경도 추출"""
    pts = []
    try:
        tree = ET.parse(gpx_path)
        root = tree.getroot()
        ns = {'g': 'http://www.topografix.com/GPX/1/1'}
        for tp in root.findall('.//g:trkpt', ns):
            pts.append((float(tp.get('lon')), float(tp.get('lat'))))
    except Exception as e:
        print(f"  GPX 파싱 에러 {os.path.basename(gpx_path)}: {e}")
    return pts

def run_soil_preprocessing():
    try:
        import geopandas as gpd
        import pandas as pd
        from shapely.geometry import Point, LineString
    except ImportError:
        print("geopandas / shapely 누락. 설치 후 재시도하세요.")
        return

    WGS84 = "EPSG:4326"

    # 1. Vworld 재질(Soil) SHP 로드
    print("1. Vworld 토양정보 SHP 로드 및 좌표계 변환...")
    soil_shp = os.path.join(settings.DATA_DIR, "Vworld", "soil_type", "gangnam_songpa_gangdong_soil_type.shp")
    soil_gdf = gpd.read_file(soil_shp, encoding='utf-8')
    # PRJ 파일이 이미 존재하므로 to_crs를 통해 WGS84 변환
    soil_gdf = soil_gdf.to_crs(WGS84)
    print(f"   토양 폴리곤 {len(soil_gdf)}개, CRS → WGS84")

    # 2. 산책로 선형 SHP 로드
    print("2. 산책로 선형 SHP 로드...")
    trail_shp_path = os.path.join(
        settings.DATA_DIR, "PTP019401",
        "ECLGY_CLTUR_ST_2015_W_SHP", "ECLGY_CLTUR_ST_2015_W.shp"
    )
    trail_line_gdf = gpd.read_file(trail_shp_path, encoding='cp949')
    if trail_line_gdf.crs is None:
        trail_line_gdf.set_crs(WGS84, inplace=True)
    else:
        trail_line_gdf = trail_line_gdf.to_crs(WGS84)
    print(f"   선형 피처 {len(trail_line_gdf)}개")

    # 3. GPX 
    print("3. GPX 파일 로드...")
    gpx_dir = os.path.join(settings.DATA_DIR, "PTP019401", "서울둘레길 코스별 GPX 파일")
    gpx_lines = [] 
    if os.path.exists(gpx_dir):
        for f in os.listdir(gpx_dir):
            if f.endswith(".gpx"):
                pts = parse_gpx_points(os.path.join(gpx_dir, f))
                if len(pts) >= 2:
                    gpx_lines.append((f, LineString(pts)))
    print(f"   GPX 코스 {len(gpx_lines)}개")

    # 4. 산책로 CSV 로드
    print("4. 산책로 CSV 로드...")
    trail_df = pd.read_csv(settings.PET_TRAIL_CSV)
    trail_df_gdf = gpd.GeoDataFrame(
        trail_df,
        geometry=gpd.points_from_xy(trail_df.PNTM_XCRD, trail_df.PNTM_YCRD),
        crs=WGS84
    )

    def sample_line_soil(geom, n_samples=3) -> str | None:
        """선형(GPX/SHP) 내부에서 점멸 뽑아 제일 많은 재질 판단"""
        pts = [geom.interpolate(i / (n_samples - 1), normalized=True) for i in range(n_samples)]
        pts_gdf = gpd.GeoDataFrame(geometry=pts, crs=WGS84)
        joined = gpd.sjoin(pts_gdf, soil_gdf[['DEEPSOIL', 'geometry']], how='left', predicate='within')
        vals = joined['DEEPSOIL'].dropna().tolist()
        if not vals:
            return None
        from collections import Counter
        return Counter(vals).most_common(1)[0][0]

    # 5. SHP & GPX 분석
    print("5. 산책로 SHP & GPX 토양 매핑...")
    shp_cache = {}
    for idx, row in trail_line_gdf.iterrows():
        name = row.get('NAME', '').strip()
        if name:
            res = sample_line_soil(row.geometry)
            if res: shp_cache[name] = res

    gpx_cache = {}
    for fname, line_geom in gpx_lines:
        res = sample_line_soil(line_geom)
        if res: gpx_cache[fname.replace('.gpx', '')] = res

    print("6. 메인 산책로 CSV와 병합...")
    final_cache = {}
    for _, row in trail_df.iterrows():
        name = row['TRL_NM']
        matched = None
        for shp_name, res in shp_cache.items():
            if name in shp_name or shp_name in name:
                matched = res; break
        if not matched:
            for gpx_name, res in gpx_cache.items():
                kw = name.replace(" ", "")
                gk = gpx_name.replace(" ", "")
                if kw in gk or gk in kw:
                    matched = res; break
        
        # 선형에서 못찾았으면 포인트로
        if not matched:
            pt_gdf = trail_df_gdf[trail_df_gdf['TRL_NM'] == name][['geometry']]
            joined = gpd.sjoin(pt_gdf, soil_gdf[['DEEPSOIL', 'geometry']], how='left', predicate='within')
            vals = joined['DEEPSOIL'].dropna().tolist()
            if vals: matched = vals[0]
        
        if matched:
            final_cache[name] = matched

    # 7. 공원 처리
    print("7. 공원 토양 매핑...")
    park_df = pd.read_csv(settings.PARK_CSV_PATH, encoding='cp949')
    park_gdf = gpd.GeoDataFrame(
        park_df, geometry=gpd.points_from_xy(park_df['X좌표(WGS84)'], park_df['Y좌표(WGS84)']), crs=WGS84
    )
    park_joined = gpd.sjoin(park_gdf, soil_gdf[['DEEPSOIL', 'geometry']], how='left', predicate='within')
    for _, row in park_joined.iterrows():
        pname = row['공원명']
        sval = row.get('DEEPSOIL')
        import pandas as pd_inner
        if pd_inner.notna(sval):
            final_cache[pname] = str(sval)

    output_path = os.path.join(settings.DATA_DIR, "soil_cache.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(final_cache, f, ensure_ascii=False, indent=2)

    print(f"\n완료! {len(final_cache)}개 매핑됨. 결과: {output_path}")

if __name__ == "__main__":
    run_soil_preprocessing()
