import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  ScrollView,
} from 'react-native';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';

const COLORS = {
  yellow: '#FFD84D',
  yellowSoft: '#FFF6CC',
  yellowDark: '#E0B700',
  white: '#FFFFFF',
  text: '#222222',
  subText: '#777777',
  border: '#E5E5E5',
  successText: '#E0B700',
  infoBg: '#F6F8FF',
  infoBorder: '#D6DEFF',
  infoText: '#2F4B9A',
  overlayBg: 'rgba(255,255,255,0.98)',
};

const API_BASE_URL = 'https://pet-walk.azurewebsites.net';
// 실제 휴대폰 테스트면 위 주소를 네 PC 로컬 IP로 변경
//const API_BASE_URL = 'http://10.0.2.2:8000';

const initialRegion: Region = {
  latitude: 37.5205,
  longitude: 127.118,
  latitudeDelta: 0.16,
  longitudeDelta: 0.16,
};

type LatLng = {
  latitude: number;
  longitude: number;
};
const getSoilLabel = (soil?: string | null) => {
  switch (soil) {
    case '식질':
      return '질퍽한 길';

    case '식양질':
      return '약간 질퍽한 흙길';

    case '사질':
      return '모래길';

    case '사양질':
      return '걷기 좋은 흙길';

    case '미사식양질':
      return '부드러운 흙길';
 
    case '미사사양질':
      return '편안한 흙길';

    default:
      return null;
  }
};

type RouteOption = {
  id: string;
  title: string;
  timeMin: number;
  distanceKm: number;
  tags: string[];
  path: LatLng[];
  type: 'park' | 'trail';
  startPoint: LatLng;
  endPoint: LatLng | null;
  congestionLevel: string | null;
  congestionMessage: string | null;
  slopeLevel: string | null;
  distanceFromUser: number | null;
};

type RecommendMeta = {
  weatherTemp: string | null;
  weatherPm10: string | null;
  weatherPm10Index: string | null;
  pcpMsg: string | null;
  uvMsg: string | null;
  airMsg: string | null;
  weatherTime: string | null;
  weatherMsg: string | null;
  count: number;
  lastUserLocation?: LatLng | null;
};
type WalkRecord = {
  id: string;
  title: string;
  startedAt: string;
  endedAt: string;
  durationMin: number;
  distanceKm: number;
  routeId: string;
};

type QuickFilterType = 'all' | 'trail' | 'park' | 'facility' | 'hazard';

type NearbyPlace = {
  id: string;
  type: string;
  title: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  address?: string | null;
  phone?: string | null;
  note?: string | null;
  lengthKm?: number | null;
  timeMinute?: number | null;
  congestionLevel?: string | null;
  congestionMessage?: string | null;
  slopeLevel?: string | null;
  slopeValue?: string | null;
  slopeAvg?: number | null;
  soil_type?: string | null;
  hazardType?: string;
  polyline?: LatLng[];
};

function isValidCoordinate(point?: LatLng | null) {
  return !!point && point.latitude != null && point.longitude != null;
}

function arePointsVeryClose(a?: LatLng | null, b?: LatLng | null) {
  if (!a || !b) return false;

  const latDiff = Math.abs(a.latitude - b.latitude);
  const lngDiff = Math.abs(a.longitude - b.longitude);

  return latDiff < 0.0003 && lngDiff < 0.0003;
}

function normalizeStoredRoute(route: any): RouteOption | null {
  if (!route) return null;

  const startPoint =
    route.startPoint && isValidCoordinate(route.startPoint)
      ? route.startPoint
      : route.path?.[0] && isValidCoordinate(route.path[0])
        ? route.path[0]
        : null;

  if (!startPoint) return null;

  const path = Array.isArray(route.path)
    ? route.path.filter((point: LatLng) => isValidCoordinate(point))
    : [startPoint];

  return {
    id: route.id,
    title: route.title,
    timeMin: route.timeMin ?? 0,
    distanceKm: route.distanceKm ?? 0,
    tags: Array.isArray(route.tags) ? route.tags : [],
    path: path.length > 0 ? path : [startPoint],
    type: route.type === 'park' ? 'park' : 'trail',
    startPoint,
    endPoint: isValidCoordinate(route.endPoint) ? route.endPoint : null,
    congestionLevel: route.congestionLevel ?? null,
    congestionMessage: route.congestionMessage ?? null,
    slopeLevel: route.slopeLevel ?? null,
    distanceFromUser: route.distanceFromUser ?? null,
  };
}

export default function HomeScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const sheetRef = useRef<BottomSheet>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const snapPoints = useMemo(() => ['12%', '52%'], []);

  const [weatherExpanded, setWeatherExpanded] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LatLng | null>(null);

  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [confirmedRouteId, setConfirmedRouteId] = useState<string | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [recommendMeta, setRecommendMeta] = useState<RecommendMeta | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  const [activeQuickFilter, setActiveQuickFilter] = useState<QuickFilterType | null>(null);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [quickLoading, setQuickLoading] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<NearbyPlace | null>(null);
  const [selectedTrailPath, setSelectedTrailPath] = useState<LatLng[]>([]);

  const selectedRoute =
    routeOptions.find((route) => route.id === selectedRouteId) || null;

  const confirmedRoute =
    routeOptions.find((route) => route.id === confirmedRouteId) || null;

  const displayedRoute = confirmedRoute || selectedRoute;
  const isWalking = !!confirmedRoute;
  const isPlaceDetailMode = !!selectedPlace;

  const getQuickFilterLabel = (filter: QuickFilterType) => {
    switch (filter) {
      case 'all':
        return '전체';
      case 'trail':
        return '산책로';
      case 'park':
        return '공원';
      case 'facility':
        return '편의시설';
      case 'hazard':
        return '사고 및 통제';
      default:
        return '';
    }
  };

const getMarkerIcon = (type: string) => {
  switch (type) {
    case 'trail':
      return <FontAwesome5 name="paw" size={14} color="#333" />;

    case 'park':
      return <FontAwesome5 name="tree" size={14} color="#2E7D32" />;

    case 'hospital':
      return <MaterialIcons name="local-hospital" size={16} color="#E53935" />;

    case 'cafe':
      return <FontAwesome5 name="coffee" size={14} color="#6D4C41" />;

    case 'hazard':
      return <MaterialIcons name="warning-amber" size={16} color="#E53935" />;

    default:
      return <MaterialIcons name="place" size={14} color="#333" />;
  }
};

  const getMarkerLabel = (type: string) => {
    switch (type) {
      case 'trail':
        return '산책로';
      case 'park':
        return '공원';
      case 'hospital':
        return '병원';
      case 'cafe':
        return '카페';
      case 'playground':
        return '놀이터';
      case 'hazard':
        return '사고·통제';
      default:
        return '장소';
    }
  };

  const formatDistance = (distanceKm?: number | null) => {
    if (distanceKm == null) return '거리 정보 없음';
    if (distanceKm < 1) return `${Math.round(distanceKm * 1000)}m`;
    return `${distanceKm.toFixed(2)}km`;
  };

  const clearQuickFilter = () => {
    setActiveQuickFilter(null);
    setNearbyPlaces([]);
    setSelectedPlace(null);
    setSelectedTrailPath([]);
    mapRef.current?.animateToRegion(initialRegion, 500);
  };

  const handlePlacePress = (place: NearbyPlace) => {
    setSelectedPlace(place);

    if (place.type === 'trail' && place.polyline && place.polyline.length > 1) {
      setSelectedTrailPath(place.polyline);
      mapRef.current?.fitToCoordinates(place.polyline, {
        edgePadding: { top: 120, right: 40, bottom: 260, left: 40 },
        animated: true,
      });
    } else {
      setSelectedTrailPath([]);
      mapRef.current?.animateToRegion(
        {
          latitude: place.latitude,
          longitude: place.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        500
      );
    }

    sheetRef.current?.snapToIndex(1);
  };

  const fetchNearbyByFilter = useCallback(
    async (filter: QuickFilterType) => {
      try {
        setQuickLoading(true);

        const storedLocation = await AsyncStorage.getItem('currentLocation');

        let baseLocation = currentLocation;

        if (!baseLocation && storedLocation) {
          baseLocation = JSON.parse(storedLocation);
        }

        if (!baseLocation) {
          baseLocation = {
            latitude: initialRegion.latitude,
            longitude: initialRegion.longitude,
          };
        }

        const viewType =
          filter === 'all'
            ? 'trail+park'
            : filter === 'trail'
              ? 'trail'
              : filter === 'park'
                ? 'park'
                : 'facility';

        const response = await fetch(`${API_BASE_URL}/api/trails/recommend`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_lat: baseLocation.latitude,
            user_lng: baseLocation.longitude,
            max_distance_km: 3,
            limit: 20,
            view_type: viewType,
            use_realtime_api: filter !== 'facility',
          }),
        });

        if (!response.ok) {
          throw new Error(`주변 장소 요청 실패 (${response.status})`);
        }

        const data = await response.json();
        const rawItems = Array.isArray(data.items) ? data.items : [];

        const mappedItems: NearbyPlace[] = rawItems
          .filter((item: any) => item.start_lat && item.start_lng)
          .map((item: any) => ({
            id: item.trail_id,
            type: item.type,
            title: item.trail_name,
            latitude: item.start_lat,
            longitude: item.start_lng,
            distanceKm: item.distance_from_user ?? 0,
            address: item.pg_location ?? null,
            phone: item.pg_phone ?? null,
            note: item.pg_notes ?? null,
            lengthKm: item.length_km ?? null,
            timeMinute: item.time_minute ?? null,
            congestionLevel: item.congestion_lvl ?? null,
            congestionMessage: item.congestion_msg ?? null,
            slopeLevel: item.slope_lvl ?? null,
            soil_type: item.soil_type ?? null,
            slopeValue: item.slope_val ?? null,
            slopeAvg: item.slope_avg ?? null,
            polyline: Array.isArray(item.polyline)
              ? item.polyline
                  .filter(
                    (point: any) =>
                      Array.isArray(point) &&
                      point.length === 2 &&
                      point[0] != null &&
                      point[1] != null
                  )
                  .map((point: [number, number]) => ({
                    latitude: point[0],
                    longitude: point[1],
                  }))
              : [],
          }));

        setNearbyPlaces(mappedItems);
        setActiveQuickFilter(filter);
        setSelectedPlace(null);
        setSelectedTrailPath([]);

        const fitCoords = [
          baseLocation,
          ...mappedItems.map((item) => ({
            latitude: item.latitude,
            longitude: item.longitude,
          })),
        ];

        if (fitCoords.length > 1) {
          mapRef.current?.fitToCoordinates(fitCoords, {
            edgePadding: { top: 120, right: 40, bottom: 260, left: 40 },
            animated: true,
          });
        }
      } catch (error) {
        console.error('주변 장소 불러오기 실패:', error);
        Alert.alert('오류', '주변 장소를 불러오는 중 문제가 발생했어요.');
      } finally {
        setQuickLoading(false);
      }
    },
    [currentLocation]
  );

  const fetchHazards = useCallback(async () => {
  try {
    setQuickLoading(true);

    const response = await fetch(`${API_BASE_URL}/api/trails/hazards`);

    if (!response.ok) {
      throw new Error(`사고/통제 요청 실패 (${response.status})`);
    }

    const data = await response.json();
    const incidents = Array.isArray(data.incidents) ? data.incidents : [];
    const disasters = Array.isArray(data.disasters) ? data.disasters : [];

    const mappedItems: NearbyPlace[] = [...incidents, ...disasters]
      .filter((item: any) => item.lat != null && item.lng != null)
      .map((item: any, index: number) => ({
        id: item.acc_id ?? `hazard-${index}`,
        type: 'hazard',
        title: item.acc_info || item.acc_type || '사고/통제 정보',
        latitude: item.lat,
        longitude: item.lng,
        distanceKm: 0,
        note: item.acc_info ?? null,
        hazardType: item.acc_type ?? null,
      }));

    setNearbyPlaces(mappedItems);
    setActiveQuickFilter('hazard');
    setSelectedPlace(null);
    setSelectedTrailPath([]);

    if (mappedItems.length > 0) {
      mapRef.current?.fitToCoordinates(
        mappedItems.map((item) => ({
          latitude: item.latitude,
          longitude: item.longitude,
        })),
        {
          edgePadding: { top: 120, right: 40, bottom: 260, left: 40 },
          animated: true,
        }
      );
    }
  } catch (error) {
    console.error('사고/통제 불러오기 실패:', error);
    Alert.alert('오류', '사고 및 통제 정보를 불러오는 중 문제가 발생했어요.');
  } finally {
    setQuickLoading(false);
  }
}, []);

  useEffect(() => {
    const initLocation = async () => {
      const mockCurrentLocation = {
        latitude: 37.528091,
        longitude: 127.126192,
      };

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== 'granted') {
          console.log('위치 권한 거부됨 - 기본 지도 유지');
          return;
        }

        setCurrentLocation(mockCurrentLocation);
        await AsyncStorage.setItem('currentLocation', JSON.stringify(mockCurrentLocation));

        setTimeout(() => {
          mapRef.current?.animateToRegion(
            {
              latitude: mockCurrentLocation.latitude,
              longitude: mockCurrentLocation.longitude,
              latitudeDelta: 0.009,
              longitudeDelta: 0.009,
            },
            700
          );
        }, 500);
      } catch (error) {
        console.error('현재 위치 처리 실패:', error);
      }
    };

    initLocation();
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [scaleAnim]);

  const fetchWeatherForHome = useCallback(async () => {
    try {
      setWeatherLoading(true);

      const response = await fetch(`${API_BASE_URL}/api/trails/weather`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          area_name: '올림픽공원',
        }),
      });

      if (!response.ok) {
        throw new Error(`날씨 요청 실패 (${response.status})`);
      }

      const data = await response.json();

      setRecommendMeta((prev) => {
        const nextMeta: RecommendMeta = {
          weatherTemp: data.temp ?? null,
          weatherPm10: data.pm10 ?? null,
          weatherPm10Index: data.pm10_index ?? null,
          pcpMsg: data.pcp_msg ?? null,
          uvMsg: data.uv_msg ?? null,
          airMsg: data.air_msg ?? null,
          weatherTime: data.weather_time ?? null,
          weatherMsg: data.weather_msg ?? null,
          count: prev?.count ?? 0,
          lastUserLocation: prev?.lastUserLocation ?? null,
        };

        AsyncStorage.setItem('recommendMeta', JSON.stringify(nextMeta));
        return nextMeta;
      });
    } catch (error) {
      console.error('홈 날씨 정보 불러오기 실패:', error);
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const loadRoutes = async () => {
        try {
          const routesData = await AsyncStorage.getItem('recommendedRoutes');
          const confirmedData = await AsyncStorage.getItem('selectedRoute');
          const metaData = await AsyncStorage.getItem('recommendMeta');

          let parsedRoutes: RouteOption[] = [];
          let parsedConfirmed: RouteOption | null = null;
          let parsedMeta: RecommendMeta | null = null;

          if (routesData) {
            const rawRoutes = JSON.parse(routesData);
            parsedRoutes = Array.isArray(rawRoutes)
              ? (rawRoutes
                  .map((route) => normalizeStoredRoute(route))
                  .filter(Boolean) as RouteOption[])
              : [];
          }

          if (confirmedData) {
            parsedConfirmed = normalizeStoredRoute(JSON.parse(confirmedData));
          }

          if (metaData) {
            parsedMeta = JSON.parse(metaData);
            setRecommendMeta(parsedMeta);
          } else {
            setRecommendMeta(null);
          }

          setRouteOptions(parsedRoutes);

          if (parsedRoutes.length === 0) {
            setSelectedRouteId(null);
            setConfirmedRouteId(null);
            await fetchWeatherForHome();
            return;
          }

          const confirmedStillExists =
            parsedConfirmed &&
            parsedRoutes.some((route) => route.id === parsedConfirmed?.id);

          if (confirmedStillExists && parsedConfirmed) {
            setConfirmedRouteId(parsedConfirmed.id);
            setSelectedRouteId(parsedConfirmed.id);

            const fitCoords =
              parsedConfirmed.path?.length > 1
                ? parsedConfirmed.path
                : [parsedConfirmed.startPoint];

            if (fitCoords.length > 0) {
              mapRef.current?.fitToCoordinates(fitCoords, {
                edgePadding: { top: 100, right: 40, bottom: 240, left: 40 },
                animated: true,
              });
            }
          } else {
            setConfirmedRouteId(null);
            setSelectedRouteId(parsedRoutes[0].id);

            const firstRoute = parsedRoutes[0];
            const fitCoords =
              firstRoute.path?.length > 1 ? firstRoute.path : [firstRoute.startPoint];

            if (fitCoords.length > 0) {
              mapRef.current?.fitToCoordinates(fitCoords, {
                edgePadding: { top: 100, right: 40, bottom: 240, left: 40 },
                animated: true,
              });
            }
          }

          if (!parsedMeta?.weatherTemp && !parsedMeta?.weatherPm10 && !parsedMeta?.weatherMsg) {
            await fetchWeatherForHome();
          }
        } catch (error) {
          console.error('추천 경로 불러오기 실패:', error);
        }
      };

      loadRoutes();
    }, [fetchWeatherForHome])
  );

  const handleSelectRoute = (route: RouteOption) => {
    setSelectedPlace(null);
    setSelectedTrailPath([]);
    setSelectedRouteId(route.id);

    const fitCoords = route.path?.length > 1 ? route.path : [route.startPoint];

    if (fitCoords.length > 0) {
      mapRef.current?.fitToCoordinates(fitCoords, {
        edgePadding: { top: 100, right: 40, bottom: 240, left: 40 },
        animated: true,
      });
    }

    sheetRef.current?.snapToIndex(1);
  };

const handleConfirmRoute = async () => {
  if (!selectedRoute) {
    Alert.alert('선택 필요', '먼저 경로를 선택해주세요.');
    return;
  }

  try {
    const startedAt = new Date().toISOString();

    await AsyncStorage.setItem('selectedRoute', JSON.stringify(selectedRoute));
    await AsyncStorage.setItem(
      'walkSession',
      JSON.stringify({
        routeId: selectedRoute.id,
        title: selectedRoute.title,
        startedAt,
        distanceKm: selectedRoute.distanceKm ?? 0,
      })
    );

    setConfirmedRouteId(selectedRoute.id);
    Alert.alert('산책 시작', `"${selectedRoute.title}" 경로로 산책을 시작했어요.`);
  } catch (error) {
    console.error('산책 시작 저장 실패:', error);
    Alert.alert('오류', '산책 시작 처리 중 문제가 발생했어요.');
  }
};

 const handleEndWalk = async () => {
  try {
    const walkSessionRaw = await AsyncStorage.getItem('walkSession');
    const walkRecordsRaw = await AsyncStorage.getItem('walkRecords');

    if (walkSessionRaw) {
      const walkSession = JSON.parse(walkSessionRaw);
      const existingRecords: WalkRecord[] = walkRecordsRaw
        ? JSON.parse(walkRecordsRaw)
        : [];

      const endedAt = new Date().toISOString();

      const startedAtMs = new Date(walkSession.startedAt).getTime();
      const endedAtMs = new Date(endedAt).getTime();
      const durationMin = Math.max(
        1,
        Math.round((endedAtMs - startedAtMs) / 1000 / 60)
      );

      const newRecord: WalkRecord = {
        id: `walk-${Date.now()}`,
        title: walkSession.title ?? '산책 기록',
        startedAt: walkSession.startedAt,
        endedAt,
        durationMin,
        distanceKm: Number(walkSession.distanceKm ?? 0),
        routeId: walkSession.routeId ?? '',
      };

      const updatedRecords = [newRecord, ...existingRecords];
      await AsyncStorage.setItem('walkRecords', JSON.stringify(updatedRecords));
    }

    await AsyncStorage.removeItem('walkSession');
    await AsyncStorage.removeItem('selectedRoute');
    await AsyncStorage.removeItem('recommendedRoutes');

    const prevMeta = recommendMeta;

    setConfirmedRouteId(null);
    setSelectedRouteId(null);
    setRouteOptions([]);

    if (!activeQuickFilter && !selectedPlace) {
      mapRef.current?.animateToRegion(initialRegion, 500);
    }

    if (prevMeta) {
      const clearedMeta: RecommendMeta = {
        weatherTemp: prevMeta.weatherTemp ?? null,
        weatherPm10: prevMeta.weatherPm10 ?? null,
        weatherPm10Index: prevMeta.weatherPm10Index ?? null,
        pcpMsg: prevMeta.pcpMsg ?? null,
        uvMsg: prevMeta.uvMsg ?? null,
        airMsg: prevMeta.airMsg ?? null,
        weatherTime: prevMeta.weatherTime ?? null,
        weatherMsg: prevMeta.weatherMsg ?? null,
        count: 0,
        lastUserLocation: null,
      };
      setRecommendMeta(clearedMeta);
      await AsyncStorage.setItem('recommendMeta', JSON.stringify(clearedMeta));
    }

    await fetchWeatherForHome();
    Alert.alert('산책 종료', '산책 기록이 저장되었어요.');
  } catch (error) {
    console.error('산책 종료 처리 실패:', error);
    Alert.alert('오류', '산책 종료 중 문제가 발생했어요.');
  }
};



const renderPlaceDetailContent = () => {
  if (!selectedPlace) return null;

  const placeTypeLabel =
    selectedPlace.type === 'trail'
      ? '산책로'
      : selectedPlace.type === 'park'
        ? '공원'
        : getMarkerLabel(selectedPlace.type);

  if (selectedPlace.type === 'trail') {
    return (
      <View style={styles.placeCard}>
        <Text style={styles.placeTitle}>{selectedPlace.title}</Text>

<View style={styles.placeBadgeRow}>
  <View style={styles.placeTypeBadge}>
    <Text style={styles.placeTypeBadgeText}>{placeTypeLabel}</Text>
  </View>

    <View style={styles.distanceBadge}>
    <Text style={styles.distanceBadgeText}>
      {formatDistance(selectedPlace.distanceKm)}
    </Text>
  </View>

  {selectedPlace.soil_type && (
    <View style={styles.soilBadge}>
      <Text style={styles.soilBadgeText}>
        {getSoilLabel(selectedPlace.soil_type)}
      </Text>
    </View>
  )}
</View>

        <View style={styles.placeInfoRow}>
          <View style={styles.placeInfoChip}>
            <Text style={styles.placeInfoLabel}>총 길이</Text>
            <Text style={styles.placeInfoValue}>
              {selectedPlace.lengthKm ? `${selectedPlace.lengthKm}km` : '정보 없음'}
            </Text>
          </View>

          <View style={styles.placeInfoChip}>
            <Text style={styles.placeInfoLabel}>시간</Text>
            <Text style={styles.placeInfoValue}>
              {selectedPlace.timeMinute ? `약 ${selectedPlace.timeMinute}분` : '정보 없음'}
            </Text>
          </View>

          <View style={styles.placeInfoChip}>
            <Text style={styles.placeInfoLabel}>경사</Text>
            <Text style={styles.placeInfoValue}>
              {selectedPlace.slopeLevel ?? '정보 없음'}
            </Text>
          </View>
        </View>

{/*<View style={styles.placeMessageBox}>
  <Text style={styles.placeMessageText}>
    {selectedPlace.soil_type
      ? `토양 ${selectedPlace.soil_type}`
      : '토양 정보 없음'}
    {selectedPlace.slopeValue && selectedPlace.slopeValue !== '-'
      ? ` · 경사 ${selectedPlace.slopeValue}`
      : ''}
  </Text>
</View>
*/}
      </View>
    );
  }
if (selectedPlace.type === 'hazard') {
  return (
    <View style={styles.placeCard}>
      <Text style={styles.placeTitle}>{selectedPlace.title}</Text>

      <View style={styles.placeBadgeRow}>
        <View style={styles.placeTypeBadge}>
          <Text style={styles.placeTypeBadgeText}>사고·통제</Text>
        </View>
      </View>

      <View style={styles.placeMessageBox}>
        <Text style={styles.placeMessageText}>
          유형: {selectedPlace.hazardType ?? '정보 없음'}
        </Text>
        <Text style={styles.placeMessageText}>
          내용: {selectedPlace.note ?? '상세 정보 없음'}
        </Text>
      </View>
    </View>
  );
}
  if (selectedPlace.type === 'park') {
    return (
      <View style={styles.placeCard}>
        <Text style={styles.placeTitle}>{selectedPlace.title}</Text>

        <View style={styles.placeBadgeRow}>
          <View style={styles.placeTypeBadge}>
            <Text style={styles.placeTypeBadgeText}>{placeTypeLabel}</Text>
          </View>
            <View style={styles.distanceBadge}>
    <Text style={styles.distanceBadgeText}>
      {formatDistance(selectedPlace.distanceKm)}
    </Text>
  </View>

          {selectedPlace.soil_type && (
            <View style={styles.soilBadge}>
              <Text style={styles.soilBadgeText}>
                {getSoilLabel(selectedPlace.soil_type)}
              </Text>
             </View>
          )}

          {selectedPlace.congestionLevel ? (
            <View style={styles.placeStatusBadge}>
              <Text style={styles.placeStatusBadgeText}>
                {selectedPlace.congestionLevel}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.placeMessageBox}>
          <Text style={styles.placeMessageText}>
            {selectedPlace.congestionMessage ?? '혼잡도 설명이 없어요.'}
          </Text>
        </View>

        {selectedPlace.address ? (
          <View style={styles.placeMessageBox}>
            <Text style={styles.placeMessageText}>주소: {selectedPlace.address}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.placeCard}>
      <Text style={styles.placeTitle}>{selectedPlace.title}</Text>

      <View style={styles.placeBadgeRow}>
  <View style={styles.placeTypeBadge}>
    <Text style={styles.placeTypeBadgeText}>{placeTypeLabel}</Text>
  </View>

  {/* 👇 거리 뱃지 추가 */}
  <View style={styles.distanceBadge}>
    <Text style={styles.distanceBadgeText}>
      {formatDistance(selectedPlace.distanceKm)}
    </Text>
  </View>
</View>



      <View style={styles.placeMessageBox}>
        <Text style={styles.placeMessageText}>
          주소: {selectedPlace.address ?? '주소 정보 없음'}
        </Text>
        <Text style={styles.placeMessageText}>
          전화: {selectedPlace.phone ?? '전화 정보 없음'}
        </Text>
        {selectedPlace.note ? (
          <Text style={styles.placeMessageText}>안내: {selectedPlace.note}</Text>
        ) : null}
      </View>
    </View>
  );
};

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={initialRegion}
      >
        {currentLocation && (
          <Marker coordinate={currentLocation}>
            <Animated.View
              style={[
                styles.userMarker,
                { transform: [{ scale: scaleAnim }] },
              ]}
            >
              <View style={styles.innerDot} />
            </Animated.View>
          </Marker>
        )}

        {nearbyPlaces.map((place) => {
          const selected = selectedPlace?.id === place.id;

          return (
<Marker
  key={place.id}
  coordinate={{
    latitude: place.latitude,
    longitude: place.longitude,
  }}
  onPress={() => handlePlacePress(place)}
  anchor={{ x: 0.5, y: 1 }}
  
>
  <View style={styles.markerContainer}>
    <View
      style={[
        styles.poiMarkerWrap,
        selected && styles.poiMarkerWrapSelected,
      ]}
    >
      {getMarkerIcon(place.type)}
    </View>

    <View
      style={[
        styles.markerTail,
        selected && styles.markerTailSelected,
      ]}
    />
  </View>
</Marker>
          );
        })}

{routeOptions.map((route) => {
  if (!isValidCoordinate(route.startPoint)) return null;

  const isSelected = route.id === selectedRouteId;
  const isConfirmed = route.id === confirmedRouteId;
  const isActive = isSelected || isConfirmed;

  return (
    <Marker
      key={route.id}
      coordinate={route.startPoint}
      title={route.title}
      description={
        arePointsVeryClose(
          route.startPoint,
          route.endPoint ?? route.path[route.path.length - 1]
        )
          ? '출발 및 도착'
          : '출발'
      }
      onPress={() => handleSelectRoute(route)}
      anchor={{ x: 0.5, y: 1 }}
    >
      <View style={styles.markerContainer}>
        <View
          style={[
            styles.poiMarkerWrap,
            isActive && styles.poiMarkerWrapSelected,
          ]}
        >
          <FontAwesome5 name="paw" size={14} color="#333" />
        </View>

        <View
          style={[
            styles.markerTail,
            isActive && styles.markerTailSelected,
          ]}
        />
      </View>
    </Marker>
  );
})}

        {selectedTrailPath.length > 1 && (
          <Polyline
            coordinates={selectedTrailPath}
            strokeWidth={6}
            strokeColor={COLORS.yellowDark}
          />
        )}

        {displayedRoute?.type === 'trail' && displayedRoute.path?.length > 1 ? (
          <>
            {!arePointsVeryClose(
  displayedRoute.startPoint,
  displayedRoute.path[displayedRoute.path.length - 1]
) &&
isValidCoordinate(displayedRoute.path[displayedRoute.path.length - 1]) ? (
  <Marker
    coordinate={displayedRoute.path[displayedRoute.path.length - 1]}
    title={isWalking ? '현재 산책 종료 지점' : '추천 도착 지점'}
    description={displayedRoute.title}
  >
    <View style={styles.endMarker}>
      <Text style={styles.endMarkerText}>도착</Text>
    </View>
  </Marker>
) : null}

            <Polyline
              coordinates={displayedRoute.path.filter((point) => isValidCoordinate(point))}
              strokeWidth={6}
              strokeColor={isWalking ? COLORS.successText : COLORS.yellowDark}
            />
          </>
        ) : null}
      </MapView>

      {!isWalking && (
        <View
          style={[
            styles.quickFilterWrap,
            { top: weatherExpanded ? 240 : 150 },
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickFilterRow}
          >
            <TouchableOpacity
              style={[
                styles.quickChip,
                activeQuickFilter === 'all' && styles.quickChipActive,
              ]}
              onPress={() => fetchNearbyByFilter('all')}
            >
              <Text
                style={[
                  styles.quickChipText,
                  activeQuickFilter === 'all' && styles.quickChipTextActive,
                ]}
              >
                전체
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.quickChip,
                activeQuickFilter === 'trail' && styles.quickChipActive,
              ]}
              onPress={() => fetchNearbyByFilter('trail')}
            >
              <Text
                style={[
                  styles.quickChipText,
                  activeQuickFilter === 'trail' && styles.quickChipTextActive,
                ]}
              >
                산책로
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.quickChip,
                activeQuickFilter === 'park' && styles.quickChipActive,
              ]}
              onPress={() => fetchNearbyByFilter('park')}
            >
              <Text
                style={[
                  styles.quickChipText,
                  activeQuickFilter === 'park' && styles.quickChipTextActive,
                ]}
              >
                공원
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.quickChip,
                activeQuickFilter === 'facility' && styles.quickChipActive,
              ]}
              onPress={() => fetchNearbyByFilter('facility')}
            >
              <Text
                style={[
                  styles.quickChipText,
                  activeQuickFilter === 'facility' && styles.quickChipTextActive,
                ]}
              >
                편의시설
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
  style={[
    styles.quickChip,
    activeQuickFilter === 'hazard' && styles.quickChipActive,
  ]}
  onPress={fetchHazards}
>
  <Text
    style={[
      styles.quickChipText,
      activeQuickFilter === 'hazard' && styles.quickChipTextActive,
    ]}
  >
    사고 및 통제
  </Text>
</TouchableOpacity>

            {activeQuickFilter && (
              <TouchableOpacity style={styles.quickChipReset} onPress={clearQuickFilter}>
                <Text style={styles.quickChipResetText}>초기화</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {activeQuickFilter && (
            <Text style={styles.quickFilterInfo}>
              {quickLoading
                ? `${getQuickFilterLabel(activeQuickFilter)} 불러오는 중...`
                : `${getQuickFilterLabel(activeQuickFilter)} ${nearbyPlaces.length}개 표시 중`}
            </Text>
          )}
        </View>
      )}

      {!isWalking ? (
        <View style={styles.topCard}>
          <View style={styles.weatherHeaderRow}>
            <View style={styles.weatherRow}>
              <Text style={styles.weatherEmoji}>🌤</Text>
              <Text style={styles.topTitle}>
                {weatherLoading
                  ? '날씨 불러오는 중...'
                  : recommendMeta?.weatherTemp
                    ? `${recommendMeta.weatherTemp}°C`
                    : '날씨 정보 없음'}
              </Text>

              <Text style={[styles.weatherEmoji, { marginLeft: 8 }]}>😷</Text>
              <Text style={styles.topTitle}>
                {recommendMeta?.weatherPm10Index
                  ? `미세먼지 ${recommendMeta.weatherPm10Index}`
                  : '미세먼지 정보 없음'}
              </Text>
            </View>

            {!weatherLoading && (
              <TouchableOpacity onPress={() => setWeatherExpanded((prev) => !prev)}>
                <Text style={styles.moreButtonText}>
                  {weatherExpanded ? '접기' : '더보기'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.topSubtitle}>
            {recommendMeta?.pcpMsg ?? '강수 정보가 없어요.'}
          </Text>

          {weatherExpanded && (
            <View style={styles.weatherDetailBox}>
              {recommendMeta?.uvMsg ? (
                <Text style={styles.weatherDetailText}>{recommendMeta.uvMsg}</Text>
              ) : null}

              {recommendMeta?.airMsg ? (
                <Text style={styles.weatherDetailText}>{recommendMeta.airMsg}</Text>
              ) : null}

              {recommendMeta?.weatherTime ? (
                <Text style={styles.weatherDetailTime}>
                  기준 시각: {recommendMeta.weatherTime}
                </Text>
              ) : null}
            </View>
          )}
        </View>
      ) : confirmedRoute ? (
        <View style={styles.topCard}>
          <Text style={styles.confirmedTopLabel}>현재 산책 중</Text>
          <Text style={styles.confirmedTopTitle}>{confirmedRoute.title}</Text>
          <Text style={styles.confirmedTopMeta}>
            {confirmedRoute.timeMin > 0 ? `${confirmedRoute.timeMin}분` : '시간 정보 없음'} ·{' '}
            {confirmedRoute.distanceKm > 0 ? `${confirmedRoute.distanceKm}km` : '거리 정보 없음'}
          </Text>
          <Text style={styles.confirmedTopSubText}>
            선택한 산책 경로가 지도에 표시되고 있어요
          </Text>
        </View>
      ) : null}

      {sheetIndex === 0 && !isWalking && (
        <TouchableOpacity
          style={styles.floatingButton}
          onPress={() => router.push('/recommend')}
        >
          <Text style={styles.floatingButtonText}>추천받기</Text>
        </TouchableOpacity>
      )}

{!isWalking && (
  <BottomSheet
    ref={sheetRef}
    index={0}
    snapPoints={snapPoints}
    enablePanDownToClose={false}
    backgroundStyle={styles.sheetBackground}
    handleIndicatorStyle={styles.handleIndicator}
    onChange={(index) => setSheetIndex(index)}
  >
    <BottomSheetView style={styles.sheetContent}>
      {!isPlaceDetailMode && (
        <Text style={styles.sheetTitle}>추천 코스</Text>
      )}
      {isPlaceDetailMode ? (
        renderPlaceDetailContent()
      ) : routeOptions.length === 0 ? (
        <>
          <Text style={styles.sheetSubtitle}>아직 추천된 경로가 없어요.</Text>
        </>
      ) : (
        <>
          <Text style={styles.sheetSubtitle}>
            마커를 누르거나 카드를 누르면 해당 정보가 선택돼요
          </Text>

{routeOptions.map((route) => {
  const selected = route.id === selectedRouteId;

  return (
    <View
      key={route.id}
      style={[
        styles.routeCard,
        selected && styles.routeCardSelected,
      ]}
    >
      <TouchableOpacity onPress={() => handleSelectRoute(route)}>
        <View style={styles.routeCardHeader}>
          <Text style={styles.routeCardTitle}>{route.title}</Text>

          {selected ? (
            <Text style={styles.routeBadge}>선택됨</Text>
          ) : null}
        </View>

                  <Text style={styles.routeMeta}>
                    {route.type === 'park' ? '공원' : '산책로'} ·{' '}
                    {route.timeMin > 0 ? `${route.timeMin}분` : '시간 정보 없음'} ·{' '}
                    {route.distanceKm > 0 ? `${route.distanceKm}km` : '거리 정보 없음'}
                  </Text>

                  <Text style={styles.routeTags}>{route.tags.join(' · ')}</Text>

                  {route.congestionMessage ? (
                    <Text style={styles.routeHint}>{route.congestionMessage}</Text>
                  ) : null}
                </TouchableOpacity>

{selected && (
  <TouchableOpacity
    style={styles.confirmButton}
    onPress={handleConfirmRoute}
  >
    <Text style={styles.confirmButtonText}>이 경로로 산책 시작</Text>
  </TouchableOpacity>
)}
              </View>
            );
          })}
        </>
      )}
    </BottomSheetView>
  </BottomSheet>
)}
{isWalking && (
  <View style={styles.walkingBottomWrap}>
    <TouchableOpacity
      style={styles.walkingEndButton}
      onPress={handleEndWalk}
    >
      <Text style={styles.walkingEndButtonText}>산책 종료하기</Text>
    </TouchableOpacity>
  </View>
)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  topCard: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 18,
    padding: 16,
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },

  weatherHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  weatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    flex: 1,
  },

  weatherEmoji: {
    fontSize: 18,
  },

  topTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },

  topSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.subText,
  },

  moreButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.yellowDark,
    marginLeft: 12,
  },

  weatherDetailBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },

  weatherDetailText: {
    fontSize: 12,
    color: COLORS.subText,
    lineHeight: 18,
    marginBottom: 6,
  },

  weatherDetailTime: {
    marginTop: 4,
    fontSize: 11,
    color: COLORS.subText,
  },

  confirmedTopLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.successText,
    marginBottom: 4,
  },

  confirmedTopTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },

  confirmedTopMeta: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },

  confirmedTopSubText: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.subText,
  },

  floatingButton: {
    position: 'absolute',
    right: 20,
    bottom: 110,
    backgroundColor: COLORS.yellow,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 999,
    zIndex: 20,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  floatingButtonText: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 15,
  },

  quickFilterWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 11,
  },

  quickFilterRow: {
    paddingRight: 12,
  },

  quickChip: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginRight: 8,
  },

  quickChipActive: {
    backgroundColor: COLORS.yellow,
    borderColor: COLORS.yellowDark,
  },

  quickChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },

  quickChipTextActive: {
    color: COLORS.text,
  },

  quickChipReset: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.infoBorder,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },

  quickChipResetText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.infoText,
  },

  quickFilterInfo: {
    marginTop: 8,
    fontSize: 12,
    color: COLORS.subText,
    fontWeight: '600',
    paddingLeft: 4,
  },

  userMarker: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(26, 115, 232, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  innerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1A73E8',
  },

  endMarker: {
    backgroundColor: COLORS.successText,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  endMarkerText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  sheetBackground: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },

  handleIndicator: {
    backgroundColor: COLORS.yellow,
    width: 50,
  },

  sheetContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 28,
  },

  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },

  sheetSubtitle: {
    marginTop: 4,
    marginBottom: 14,
    fontSize: 13,
    color: COLORS.subText,
  },


  routeCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },

  routeCardSelected: {
    backgroundColor: COLORS.yellowSoft,
    borderColor: COLORS.yellowDark,
  },


  routeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  routeCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    flex: 1,
    marginRight: 8,
  },

  routeBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    backgroundColor: COLORS.yellow,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },


  routeMeta: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '700',
  },

  routeTags: {
    marginTop: 6,
    fontSize: 13,
    color: COLORS.subText,
  },

  routeHint: {
    marginTop: 8,
    fontSize: 12,
    color: COLORS.subText,
    lineHeight: 18,
  },

  confirmButton: {
    marginTop: 12,
    backgroundColor: COLORS.yellow,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },

  confirmButtonText: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 14,
  },

placeCard: {
  backgroundColor: '#FFF9E8',
  borderRadius: 22,
  padding: 18,
  borderWidth: 1,
  borderColor: '#F1E2A4',
  shadowColor: '#000',
  shadowOpacity: 0.03,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
  elevation: 1,
},



placeTitle: {
  fontSize: 24,
  fontWeight: '800',
  color: COLORS.text,
},

placeBadgeRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  marginTop: 10,
  flexWrap: 'wrap',
},

placeTypeBadge: {
  backgroundColor: '#FFF1B8',
  paddingHorizontal: 10,
  paddingVertical: 5,
  borderRadius: 999,
},

placeTypeBadgeText: {
  fontSize: 12,
  fontWeight: '800',
  color: '#8A6500',
},

placeStatusBadge: {
  backgroundColor: '#EAF7EE',
  paddingHorizontal: 10,
  paddingVertical: 5,
  borderRadius: 999,
},

placeStatusBadgeText: {
  fontSize: 12,
  fontWeight: '800',
  color: '#2D6A4F',
},

placeInfoRow: {
  flexDirection: 'row',
  gap: 8,
  marginTop: 16,
},

placeInfoChip: {
  flex: 1,
  backgroundColor: '#FFFFFF',
  borderRadius: 14,
  paddingVertical: 10,
  paddingHorizontal: 10,
  borderWidth: 1,
  borderColor: '#F0E6BF',
},

placeInfoLabel: {
  fontSize: 11,
  color: COLORS.subText,
  marginBottom: 4,
  fontWeight: '600',
},

placeInfoValue: {
  fontSize: 15,
  color: COLORS.text,
  fontWeight: '800',
},

placeMessageBox: {
  marginTop: 14,
  backgroundColor: 'rgba(255,255,255,0.8)',
  borderRadius: 14,
  padding: 12,
  borderWidth: 1,
  borderColor: '#F0E6BF',
},

placeMessageText: {
  fontSize: 13,        // 🔥 키움
  color: '#333',       // 🔥 더 진하게
  lineHeight: 22,      // 🔥 여유 있게
  fontWeight: '500',
},

poiMarkerWrap: {
  width: 32,
  height: 32,
  borderRadius: 16,
  backgroundColor: '#FFF3B0',
  alignItems: 'center',
  justifyContent: 'center',
  borderWidth: 1,
  borderColor: '#F3D46B',
},

poiMarkerWrapSelected: {
  backgroundColor: '#FFD84D',
  borderColor: '#E0B700',
},

markerContainer: {
  alignItems: 'center',
},

markerTail: {
  width: 0,
  height: 0,
  borderLeftWidth: 6,
  borderRightWidth: 6,
  borderTopWidth: 8,
  borderLeftColor: 'transparent',
  borderRightColor: 'transparent',
  borderTopColor: '#FFF3B0', // 기본 연한 노랑
  marginTop: -2,
},

markerTailSelected: {
  borderTopColor: '#FFD84D', // 선택 시 진한 노랑
},
soilBadge: {
  backgroundColor: '#FFF6CC', // 연한 노랑
  paddingHorizontal: 10,
  paddingVertical: 5,
  borderRadius: 999,
},

soilBadgeText: {
  fontSize: 12,
  fontWeight: '800',
  color: '#8A6500',
},
distanceBadge: {
  backgroundColor: '#F0F0F0', // 회색톤 (보조 정보 느낌)
  paddingHorizontal: 10,
  paddingVertical: 5,
  borderRadius: 999,
},

distanceBadgeText: {
  fontSize: 12,
  fontWeight: '700',
  color: '#555',
},
walkingBottomWrap: {
  position: 'absolute',
  left: 20,
  right: 20,
  bottom: 34,
  zIndex: 30,
},

walkingEndButton: {
  backgroundColor: COLORS.yellow,
  paddingVertical: 16,
  borderRadius: 16,
  alignItems: 'center',
  shadowColor: '#000',
  shadowOpacity: 0.18,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 4 },
  elevation: 6,
},

walkingEndButtonText: {
  color: COLORS.text,
  fontSize: 16,
  fontWeight: '800',
},
});