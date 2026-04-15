import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';

type WalkRecord = {
  id: string;
  title: string;
  startedAt: string;
  endedAt: string;
  durationMin: number;
  distanceKm: number;
  routeId: string;
};

const COLORS = {
  bg: '#F7F9FC',
  white: '#FFFFFF',
  text: '#222222',
  subText: '#777777',
  border: '#E5E5E5',
  yellow: '#FFD84D',
};

function formatDateTime(iso: string) {
  const date = new Date(iso);

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');

  return `${yyyy}.${mm}.${dd} ${hh}:${min}`;
}

export default function Record() {
  const [records, setRecords] = useState<WalkRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      const loadRecords = async () => {
        try {
          const raw = await AsyncStorage.getItem('walkRecords');
          const parsed = raw ? JSON.parse(raw) : [];
          setRecords(Array.isArray(parsed) ? parsed : []);
        } catch (error) {
          console.error('산책 기록 불러오기 실패:', error);
          setRecords([]);
        }
      };

      loadRecords();
    }, [])
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>산책 기록</Text>
        <Text style={styles.subtitle}>종료한 산책이 여기에 저장돼요.</Text>

        {records.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>아직 기록이 없어요</Text>
            <Text style={styles.emptyText}>산책을 시작하고 종료하면 기록이 저장돼요.</Text>
          </View>
        ) : (
          records.map((record) => (
            <View key={record.id} style={styles.recordCard}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>완료</Text>
              </View>

              <Text style={styles.recordTitle}>{record.title}</Text>

              <Text style={styles.recordMeta}>
                {record.distanceKm > 0 ? `${record.distanceKm.toFixed(2)}km` : '거리 정보 없음'} · {record.durationMin}분
              </Text>

              <Text style={styles.recordTime}>
                시작: {formatDateTime(record.startedAt)}
              </Text>
              <Text style={styles.recordTime}>
                종료: {formatDateTime(record.endedAt)}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 18,
    fontSize: 14,
    color: COLORS.subText,
  },
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.subText,
    lineHeight: 20,
  },
  recordCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 12,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF6CC',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.text,
  },
  recordTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },
  recordMeta: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  recordTime: {
    marginTop: 6,
    fontSize: 13,
    color: COLORS.subText,
  },
});