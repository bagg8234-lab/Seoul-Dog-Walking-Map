import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { dogProfile, DogProfile } from '../../store/dogProfile';
const FALLBACK_LOCATION = {
  latitude: 37.528091,
  longitude: 127.126192,
};
const COLORS = {
  yellow: '#FFD84D',
  yellowSoft: '#FFF6CC',
  yellowDark: '#E0B700',
  white: '#FFFFFF',
  text: '#222222',
  subText: '#777777',
  border: '#E5E5E5',
};

// 배포 서버면 이 주소 유지
const API_BASE_URL = 'https://pet-walk.azurewebsites.net';
//const API_BASE_URL = 'http://10.0.2.2:8000';



type LatLng = {
  latitude: number;
  longitude: number;
};

type BackendDogPayload = {
  size: string | null;
  age_group: string | null;
  energy?: string | null;
  is_long_back: boolean;
  is_brachycephalic: boolean;
  noise_sensitive: boolean;
  heat_sensitive: boolean;
  joint_sensitive: boolean;
};

type BackendWalkPayload = {
  address?: string | null;
  latitude: number;
  longitude: number;
  crowd_preference: '조용한 곳' | '상관없음';
  slope_preference: '평지 위주' | '상관없음';
  time_min: number | null;
};

type BackendRoute = {
  route_id: number;
  estimated_minutes: number;
  total_distance_m: number;
  waypoint_count: number;
  polyline: [number, number][];
  route_warnings?: string[];
  has_stairs?: boolean;
  route_explanation?: string | null;
};

type BackendRouteResponse = {
  routes: BackendRoute[];
  rejected_routes: any[];
  requested_lat: number;
  requested_lng: number;
  start_lat: number;
  start_lng: number;
  count: number;
  filter_info?: {
    summary?: string;
    applied_rules?: string[];
    no_match_found?: boolean;
    fallback_note?: string;
  };
  no_match_found: boolean;
  no_match_message?: string | null;
};

type StoredRouteOption = {
  id: string;
  title: string;
  timeMin: number;
  distanceKm: number;
  tags: string[];
  path: LatLng[];
  type: 'trail' | 'park';
  startPoint: LatLng;
  endPoint: LatLng | null;
  congestionLevel: string | null;
  congestionMessage: string | null;
  slopeLevel: string | null;
  distanceFromUser: number | null;
};

type StoredRecommendMeta = {
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



function buildRouteTags(
  route: BackendRoute,
  crowd: '조용한 곳' | '상관없음',
  slope: '평지 위주' | '상관없음',
  noMatchFound?: boolean
) {
  const tags: string[] = [];

  tags.push(`약 ${Math.round(route.estimated_minutes)}분`);
  tags.push(`${(route.total_distance_m / 1000).toFixed(2)}km`);

  if (crowd === '조용한 곳') {
    tags.push('조용한 곳 우선');
  }

  if (slope === '평지 위주') {
    tags.push('평지 우선');
  }

  if (route.has_stairs) {
    tags.push('계단 포함');
  } else {
    tags.push('계단 회피');
  }

  if (noMatchFound) {
    tags.push('기본 경로');
  }

  if (Array.isArray(route.route_warnings) && route.route_warnings.length > 0) {
    tags.push(...route.route_warnings.slice(0, 2));
  }

  return tags;
}

function mapBackendRouteToStoredRoute(
  route: BackendRoute,
  crowd: '조용한 곳' | '상관없음',
  slope: '평지 위주' | '상관없음',
  noMatchFound?: boolean,
  noMatchMessage?: string | null
): StoredRouteOption | null {
  const mappedPath =
    Array.isArray(route.polyline) && route.polyline.length > 0
      ? route.polyline
          .filter(
            (point) =>
              Array.isArray(point) &&
              point.length === 2 &&
              point[0] != null &&
              point[1] != null
          )
          .map(([lat, lng]) => ({
            latitude: lat,
            longitude: lng,
          }))
      : [];

  if (mappedPath.length === 0) {
    return null;
  }

  const startPoint = mappedPath[0];
  const endPoint = mappedPath[mappedPath.length - 1] ?? null;

  const infoMessage =
    route.route_explanation?.trim() ||
    noMatchMessage ||
    (route.route_warnings && route.route_warnings.length > 0
      ? route.route_warnings.join(' · ')
      : null);

  return {
    id: `route-${route.route_id}`,
    title: `추천 코스 ${route.route_id}`,
    timeMin: Math.round(route.estimated_minutes ?? 0),
    distanceKm: Number(((route.total_distance_m ?? 0) / 1000).toFixed(2)),
    tags: buildRouteTags(route, crowd, slope, noMatchFound),
    path: mappedPath,
    type: 'trail',
    startPoint,
    endPoint,
    congestionLevel: crowd === '조용한 곳' ? '조용한 곳 우선' : null,
    congestionMessage: infoMessage,
    slopeLevel: slope === '평지 위주' ? '평지 위주' : null,
    distanceFromUser: null,
  };
}

export default function RecommendScreen() {
  const router = useRouter();
  const fetchWeatherMeta = async () => {
  try {
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

    return {
      weatherTemp: data.temp ?? null,
      weatherPm10: data.pm10 ?? null,
      weatherPm10Index: data.pm10_index ?? null,
      pcpMsg: data.pcp_msg ?? null,
      uvMsg: data.uv_msg ?? null,
      airMsg: data.air_msg ?? null,
      weatherTime: data.weather_time ?? null,
      weatherMsg: data.weather_msg ?? null,
    };
  } catch (error) {
    console.error('날씨 정보 요청 실패:', error);
    return {
      weatherTemp: null,
      weatherPm10: null,
      weatherPm10Index: null,
      pcpMsg: null,
      uvMsg: null,
      airMsg: null,
      weatherTime: null,
      weatherMsg: null,
    };
  }
};

  const [address, setAddress] = useState('');
  const [currentLocation, setCurrentLocation] = useState<LatLng | null>(null);

  const [time, setTime] = useState<number | 'recommend' | null>(15);
  const [crowd, setCrowd] = useState<'조용한 곳' | '상관없음' | null>('조용한 곳');
  const [slope, setSlope] = useState<'평지 위주' | '상관없음' | null>('평지 위주');

  const [loading, setLoading] = useState(false);
  useFocusEffect(
  useCallback(() => {
    setCurrentDogProfile({ ...dogProfile });
  }, [])
);

const buildDogPayload = (): BackendDogPayload => {
  return {
    size: currentDogProfile.size ?? null,
    age_group: currentDogProfile.ageGroup ?? null,
    energy: null,
    is_long_back: !!currentDogProfile.isLongBack,
    is_brachycephalic: !!currentDogProfile.isShortNose,
    noise_sensitive: !!currentDogProfile.noiseSensitive,
    heat_sensitive: !!currentDogProfile.heatSensitive,
    joint_sensitive: !!currentDogProfile.jointWeak,
  };
};
  const [currentDogProfile, setCurrentDogProfile] = useState<DogProfile>({ ...dogProfile });

  const isDogProfileMissing = () => {
  return !currentDogProfile.size || !currentDogProfile.ageGroup;
};

  const searchAddress = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('위치 권한이 필요합니다.');
        return;
      }

      if (!address.trim()) {
        Alert.alert('주소를 입력해주세요.');
        return;
      }

      const results = await Location.geocodeAsync(address);

      if (!results || results.length === 0) {
        Alert.alert('주소를 찾을 수 없어요.');
        return;
      }

      const first = results[0];
      const coords = {
        latitude: first.latitude,
        longitude: first.longitude,
      };

      setCurrentLocation(coords);
      await AsyncStorage.setItem('currentLocation', JSON.stringify(coords));
      Alert.alert('위치 확인 완료', '출발 위치가 설정되었어요.');
    } catch (error) {
      console.error(error);
      Alert.alert('주소 검색 중 오류가 발생했어요.');
    }
  }, [address]);

const handleUseCurrentDeviceLocation = async () => {
  try {
    const storedLocation = await AsyncStorage.getItem('currentLocation');

    if (storedLocation) {
      const parsed = JSON.parse(storedLocation);
      setCurrentLocation(parsed);
      setAddress('현재 위치');
      Alert.alert('위치 설정 완료', '홈에서 사용 중인 위치를 불러왔어요.');
      return;
    }

    const coords = FALLBACK_LOCATION;
    setCurrentLocation(coords);
    setAddress('현재 위치');
    await AsyncStorage.setItem('currentLocation', JSON.stringify(coords));
    Alert.alert('기본 위치 설정', '저장된 위치가 없어 기본 위치로 설정했어요.');
  } catch (error) {
    console.error(error);

    const coords = FALLBACK_LOCATION;
    setCurrentLocation(coords);
    setAddress('현재 위치');
    await AsyncStorage.setItem('currentLocation', JSON.stringify(coords));
    Alert.alert('기본 위치 설정', '위치를 불러오지 못해 기본 위치로 설정했어요.');
  }
};

  const handleRecommend = async () => {
    if (isDogProfileMissing()) {
  Alert.alert(
    '강아지 정보 필요',
    '추천을 받으려면 먼저 내 강아지 정보를 입력해주세요.',
    [
      { text: '취소', style: 'cancel' },
      {
        text: '마이페이지로 이동',
        onPress: () => router.push('/mypage'),
      },
    ]
  );
  return;
}
    
    if (!time || !crowd || !slope) {
      Alert.alert('입력 필요', '산책 조건을 모두 선택해주세요.');
      return;
    }

    if (!currentLocation) {
      Alert.alert('출발 위치 필요', '출발 위치를 입력하고 확인해주세요.');
      return;
    }

    try {
      setLoading(true);

      const dogPayload = buildDogPayload();

const isRecommendTime = time === 'recommend';

const walkPayload: BackendWalkPayload = {
  address: address?.trim() ? address.trim() : '현재 위치',
  latitude: currentLocation.latitude,
  longitude: currentLocation.longitude,
  crowd_preference: crowd,
  slope_preference: slope,
  time_min: isRecommendTime ? null : (time as number),
};

      const response = await fetch(`${API_BASE_URL}/api/routes/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_lat: currentLocation.latitude,
          user_lng: currentLocation.longitude,
          target_minutes: isRecommendTime ? null : (time as number),
          use_recommend_time: isRecommendTime, // 🔥 추가
          num_routes: 3,
          dog: dogPayload,
          walk: walkPayload,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('추천 API 오류:', response.status, text);
        throw new Error(`추천 요청 실패 (${response.status})`);
      }

      const data = (await response.json()) as BackendRouteResponse;

      if (!Array.isArray(data.routes) || data.routes.length === 0) {
        await AsyncStorage.removeItem('recommendedRoutes');
        await AsyncStorage.removeItem('selectedRoute');
        await AsyncStorage.setItem(
          'recommendMeta',
          JSON.stringify({
            weatherTemp: null,
            weatherPm10: null,
            weatherPm10Index: null,
            pcpMsg: null,
            uvMsg: null,
            airMsg: null,
            weatherTime: null,
            weatherMsg: data.no_match_message ?? '조건에 맞는 추천 결과를 찾지 못했어요.',
            count: 0,
            lastUserLocation: currentLocation,
          } satisfies StoredRecommendMeta)
        );

        Alert.alert('추천 결과 없음', data.no_match_message ?? '조건에 맞는 추천 결과를 찾지 못했어요.');
        router.push('/');
        return;
      }

      const mappedRoutes = data.routes
        .map((route) =>
          mapBackendRouteToStoredRoute(
            route,
            crowd,
            slope,
            data.no_match_found,
            data.no_match_message
          )
        )
        .filter(Boolean) as StoredRouteOption[];

      if (mappedRoutes.length === 0) {
        Alert.alert('추천 결과 없음', '지도로 표시할 수 있는 경로가 없어요.');
        return;
      }
      const weatherMeta = await fetchWeatherMeta();

const recommendMeta: StoredRecommendMeta = {
  weatherTemp: weatherMeta.weatherTemp,
  weatherPm10: weatherMeta.weatherPm10,
  weatherPm10Index: weatherMeta.weatherPm10Index,
  pcpMsg: weatherMeta.pcpMsg,
  uvMsg: weatherMeta.uvMsg,
  airMsg: weatherMeta.airMsg,
  weatherTime: weatherMeta.weatherTime,
  weatherMsg:
    weatherMeta.weatherMsg ||
    data.no_match_message ||
    data.filter_info?.fallback_note ||
    data.filter_info?.summary ||
    null,
  count: data.count ?? mappedRoutes.length,
  lastUserLocation: currentLocation,
};

      await AsyncStorage.setItem('recommendedRoutes', JSON.stringify(mappedRoutes));
      await AsyncStorage.setItem('recommendMeta', JSON.stringify(recommendMeta));
      await AsyncStorage.removeItem('selectedRoute');

      if (data.no_match_found) {
        Alert.alert(
          '기본 경로 안내',
          data.no_match_message ?? '조건에 맞는 경로가 없어 기본 경로를 보여드려요.'
        );
      }

      router.push('/');
    } catch (error) {
      console.error('추천 요청 실패:', error);
      Alert.alert(
        '오류',
        '추천 요청 중 문제가 발생했어요.\n서버 실행 상태와 API 주소를 확인해주세요.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Ionicons name="paw" size={22} color={COLORS.yellow} />
          <Text style={styles.title}>산책 추천 받기</Text>
        </View>

        <Text style={styles.subtitle}>
          현재 위치와 내 강아지 정보를 바탕으로 맞춤 산책 경로를 추천받아요
        </Text>

        <Text style={styles.section}>출발 위치</Text>
        <View style={styles.addressRow}>
          <TextInput
            style={styles.addressInput}
            placeholder="예: 서울특별시 강동구 올림픽로 424"
            value={address}
            onChangeText={setAddress}
          />
          <TouchableOpacity style={styles.searchButton} onPress={searchAddress}>
            <Text style={styles.searchButtonText}>확인</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.currentLocationButton}
          onPress={handleUseCurrentDeviceLocation}
        >
          <Text style={styles.currentLocationButtonText}>현재 위치 사용</Text>
        </TouchableOpacity>

        <Text style={styles.locationHint}>
          {currentLocation
            ? `선택된 위치: ${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}`
            : '아직 출발 위치가 설정되지 않았어요.'}
        </Text>

        <Text style={styles.section}>산책 시간</Text>
        <View style={styles.row}>
{([15, 30, 60, 'recommend'] as const).map((t) => {
  const isSelected = time === t;

  return (
    <TouchableOpacity
      key={t}
      style={[styles.button, isSelected && styles.selectedButton]}
      onPress={() => setTime(t)}
    >
      <Text style={[styles.buttonText, isSelected && styles.selectedText]}>
        {t === 'recommend' ? '추천' : `${t}분`}
      </Text>
    </TouchableOpacity>
  );
})}
        </View>

        <Text style={styles.section}>혼잡도 선호</Text>
        <View style={styles.row}>
          {(['조용한 곳', '상관없음'] as const).map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.buttonWide, crowd === item && styles.selectedButton]}
              onPress={() => setCrowd(item)}
            >
              <Text style={[styles.buttonText, crowd === item && styles.selectedText]}>
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.section}>경사 선호</Text>
        <View style={styles.row}>
          {(['평지 위주', '상관없음'] as const).map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.buttonWide, slope === item && styles.selectedButton]}
              onPress={() => setSlope(item)}
            >
              <Text style={[styles.buttonText, slope === item && styles.selectedText]}>
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

<View style={styles.profileHintBox}>
  <Text style={styles.profileHintTitle}>내 강아지 정보 반영 중</Text>
  <Text style={styles.profileHintText}>
    크기: {currentDogProfile.size || '미설정'} · 나이대: {currentDogProfile.ageGroup || '미설정'}
  </Text>
  <Text style={styles.profileHintText}>
    장허리종 {currentDogProfile.isLongBack ? 'O' : 'X'} · 단두종 {currentDogProfile.isShortNose ? 'O' : 'X'} ·
    소음 민감 {currentDogProfile.noiseSensitive ? 'O' : 'X'}
  </Text>
  <Text style={styles.profileHintText}>
    더위 민감 {currentDogProfile.heatSensitive ? 'O' : 'X'} · 관절 약함 {currentDogProfile.jointWeak ? 'O' : 'X'}
  </Text>
</View>

        <TouchableOpacity
          style={[styles.mainButton, loading && styles.mainButtonDisabled]}
          onPress={handleRecommend}
          disabled={loading}
        >
          <Text style={styles.mainButtonText}>
            {loading ? '추천 불러오는 중...' : '추천 시작'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },
  container: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: Platform.OS === 'android' ? 16 : 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.subText,
    marginTop: 8,
    marginBottom: 18,
    lineHeight: 20,
  },
  section: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 10,
    color: COLORS.text,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addressInput: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.text,
  },
  searchButton: {
    backgroundColor: COLORS.yellow,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },
  searchButtonText: {
    fontWeight: '700',
    color: COLORS.text,
  },
  currentLocationButton: {
    marginTop: 10,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  currentLocationButtonText: {
    color: COLORS.text,
    fontWeight: '700',
  },
  locationHint: {
    marginTop: 10,
    fontSize: 12,
    color: COLORS.subText,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  button: {
    minWidth: 78,
    backgroundColor: COLORS.white,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  buttonWide: {
    minWidth: 140,
    backgroundColor: COLORS.white,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  selectedButton: {
    backgroundColor: COLORS.yellow,
    borderColor: COLORS.yellowDark,
  },
  buttonText: {
    color: COLORS.text,
    fontWeight: '600',
  },
  selectedText: {
    color: COLORS.text,
    fontWeight: '700',
  },
  profileHintBox: {
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  profileHintTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 8,
  },
  profileHintText: {
    fontSize: 12,
    color: COLORS.subText,
    lineHeight: 18,
    marginBottom: 2,
  },
  mainButton: {
    marginTop: 28,
    backgroundColor: COLORS.yellow,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  mainButtonDisabled: {
    opacity: 0.6,
  },
  mainButtonText: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 16,
  },
});