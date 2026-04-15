import { useEffect, useMemo, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { dogProfile, setDogProfile, DogProfile } from "../../store/dogProfile";
import AsyncStorage from '@react-native-async-storage/async-storage';

const COLORS = {
    yellow: "#FFD84D",
    yellowSoft: "#FFF7D6",
    yellowDark: "#E0B700",
    white: "#FFFFFF",
    text: "#222222",
    subText: "#777777",
    border: "#E8E8E8",
    bg: "#F7F9FC",
    card: "#FFFFFF",
};

const EMPTY_DOG_PROFILE: DogProfile = {
    size: null,
    ageGroup: null,
    energy: null,
    isLongBack: false,
    isShortNose: false,
    noiseSensitive: false,
    heatSensitive: false,
    jointWeak: false,
};

export default function MyPage() {
    const [profile, setProfile] = useState<DogProfile>(dogProfile);
    const [savedProfile, setSavedProfile] = useState<DogProfile>(dogProfile);
   const handleResetApp = () => {
    Alert.alert(
        "앱 초기화",
        "모든 데이터가 삭제됩니다. 진행할까요?",
        [
            { text: "취소", style: "cancel" },
            {
                text: "초기화",
                style: "destructive",
                onPress: async () => {
                    try {
                        await AsyncStorage.clear();

                        setDogProfile(EMPTY_DOG_PROFILE);
                        setProfile(EMPTY_DOG_PROFILE);
                        setSavedProfile(EMPTY_DOG_PROFILE);

                        setIsEditMode(true);

                        Alert.alert("완료", "앱이 초기 상태로 돌아갔어요.");
                    } catch (error) {
                        console.error(error);
                        Alert.alert("오류", "초기화 실패");
                    }
                },
            },
        ]
    );
};

    // 처음 들어왔을 때 저장된 값 기준으로 보기/편집 모드 결정
    const hasSavedProfile = useMemo(() => {
        return Boolean(
            dogProfile.size ||
            dogProfile.ageGroup ||
            dogProfile.isLongBack ||
            dogProfile.isShortNose ||
            dogProfile.noiseSensitive ||
            dogProfile.heatSensitive ||
            dogProfile.jointWeak
        );
    }, []);

    const [isEditMode, setIsEditMode] = useState(!hasSavedProfile);

    useEffect(() => {
        setProfile(dogProfile);
        setSavedProfile(dogProfile);
    }, []);

    const toggleField = (
        key:
            | "isLongBack"
            | "isShortNose"
            | "noiseSensitive"
            | "heatSensitive"
            | "jointWeak"
    ) => {
        setProfile((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    const handleSave = () => {
        setDogProfile(profile);
        setSavedProfile(profile);
        setIsEditMode(false);
        Alert.alert("저장 완료", "강아지 정보가 저장되었습니다.");
    };

    const handleEdit = () => {
        setProfile(savedProfile);
        setIsEditMode(true);
    };

    const renderChip = (label: string) => (
        <View key={label} style={styles.summaryChip}>
            <Text style={styles.summaryChipText}>{label}</Text>
        </View>
    );

    const selectedTraits = [
        savedProfile.isLongBack ? "장허리종" : null,
        savedProfile.isShortNose ? "단두종" : null,
        savedProfile.noiseSensitive ? "소음 민감" : null,
        savedProfile.heatSensitive ? "더위 민감" : null,
        savedProfile.jointWeak ? "관절 약함" : null,
    ].filter(Boolean) as string[];

    if (!isEditMode) {
        return (
            <SafeAreaView style={styles.safeArea} edges={["top"]}>
                <ScrollView
                    style={styles.container}
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.headerRow}>
                        <Ionicons name="paw" size={22} color={COLORS.yellow} />
                        <Text style={styles.title}>내 강아지 정보</Text>
                    </View>

                    <Text style={styles.subtitle}>
                        저장된 프로필 정보를 추천에 반영해요.
                    </Text>

                    <View style={styles.profileCard}>
                        <View style={styles.profileTop}>
                            <View style={styles.profileIconWrap}>
                                <Ionicons name="heart" size={22} color={COLORS.text} />
                            </View>

                            <View style={styles.profileTopText}>
                                <Text style={styles.profileTitle}>프로필 저장 완료</Text>
                                <Text style={styles.profileDesc}>
                                    현재 저장된 강아지 정보예요
                                </Text>
                            </View>
                        </View>

                        <View style={styles.infoBox}>
                            <Text style={styles.infoLabel}>크기</Text>
                            <Text style={styles.infoValue}>{savedProfile.size || "-"}</Text>
                        </View>

                        <View style={styles.infoBox}>
                            <Text style={styles.infoLabel}>나이대</Text>
                            <Text style={styles.infoValue}>
                                {savedProfile.ageGroup || "-"}
                            </Text>
                        </View>

                        <View style={styles.infoGroup}>
                            <Text style={styles.infoLabel}>건강 및 체형 특성</Text>

                            {selectedTraits.length > 0 ? (
                                <View style={styles.summaryChipWrap}>
                                    {selectedTraits.map(renderChip)}
                                </View>
                            ) : (
                                <Text style={styles.emptyTraitText}>선택된 특성이 없어요</Text>
                            )}
                        </View>
                    </View>

                    <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
                        <Ionicons name="create-outline" size={18} color={COLORS.text} />
                        <Text style={styles.editButtonText}>수정하기</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
    style={styles.resetButton}
    onPress={handleResetApp}
>
    <Ionicons name="refresh" size={18} color="#fff" />
    <Text style={styles.resetButtonText}>앱 데이터 초기화</Text>
</TouchableOpacity>
                </ScrollView>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.headerRow}>
                    <Ionicons name="paw" size={22} color={COLORS.yellow} />
                    <Text style={styles.title}>내 강아지 정보</Text>
                </View>

                <Text style={styles.subtitle}>
                    프로필 정보를 저장해 추천에 반영해요.
                </Text>

                <Text style={styles.section}>크기</Text>
                <View style={styles.row}>
                    {(["소형", "중형", "대형"] as const).map((item) => (
                        <TouchableOpacity
                            key={item}
                            style={[
                                styles.optionButton,
                                profile.size === item && styles.selectedButton,
                            ]}
                            onPress={() => setProfile({ ...profile, size: item })}
                        >
                            <Text
                                style={[
                                    styles.optionText,
                                    profile.size === item && styles.selectedText,
                                ]}
                            >
                                {item}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={styles.section}>나이대</Text>
                <View style={styles.row}>
                    {(["강아지", "성견", "노령견"] as const).map((item) => (
                        <TouchableOpacity
                            key={item}
                            style={[
                                styles.optionButton,
                                profile.ageGroup === item && styles.selectedButton,
                            ]}
                            onPress={() => setProfile({ ...profile, ageGroup: item })}
                        >
                            <Text
                                style={[
                                    styles.optionText,
                                    profile.ageGroup === item && styles.selectedText,
                                ]}
                            >
                                {item}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={styles.section}>건강 및 체형 특성</Text>

                <TouchableOpacity
                    style={[
                        styles.toggleButton,
                        profile.isLongBack && styles.selectedButton,
                    ]}
                    onPress={() => toggleField("isLongBack")}
                >
                    <Text
                        style={[
                            styles.optionText,
                            profile.isLongBack && styles.selectedText,
                        ]}
                    >
                        장허리종
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.toggleButton,
                        profile.isShortNose && styles.selectedButton,
                    ]}
                    onPress={() => toggleField("isShortNose")}
                >
                    <Text
                        style={[
                            styles.optionText,
                            profile.isShortNose && styles.selectedText,
                        ]}
                    >
                        단두종
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.toggleButton,
                        profile.noiseSensitive && styles.selectedButton,
                    ]}
                    onPress={() => toggleField("noiseSensitive")}
                >
                    <Text
                        style={[
                            styles.optionText,
                            profile.noiseSensitive && styles.selectedText,
                        ]}
                    >
                        소음 민감
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.toggleButton,
                        profile.heatSensitive && styles.selectedButton,
                    ]}
                    onPress={() => toggleField("heatSensitive")}
                >
                    <Text
                        style={[
                            styles.optionText,
                            profile.heatSensitive && styles.selectedText,
                        ]}
                    >
                        더위 민감
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.toggleButton,
                        profile.jointWeak && styles.selectedButton,
                    ]}
                    onPress={() => toggleField("jointWeak")}
                >
                    <Text
                        style={[
                            styles.optionText,
                            profile.jointWeak && styles.selectedText,
                        ]}
                    >
                        관절 약함
                    </Text>
                </TouchableOpacity>

                <View style={styles.bottomButtonRow}>
                    <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => {
                            setProfile(savedProfile);
                            setIsEditMode(false);
                        }}
                    >
                        <Text style={styles.cancelButtonText}>취소</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                        <Text style={styles.saveButtonText}>저장하기</Text>
                    </TouchableOpacity>
                </View>
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
        paddingBottom: 40,
        paddingTop: Platform.OS === "android" ? 24 : 12,
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginTop: 6,
    },
    title: {
        fontSize: 24,
        fontWeight: "800",
        color: COLORS.text,
    },
    subtitle: {
        fontSize: 14,
        color: COLORS.subText,
        marginTop: 4,
        marginBottom: 20,
        lineHeight: 20,
    },
    section: {
        fontSize: 16,
        fontWeight: "700",
        marginTop: 18,
        marginBottom: 10,
        color: COLORS.text,
    },
    row: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
    },
    optionButton: {
        backgroundColor: COLORS.white,
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 10,
    },
    toggleButton: {
        backgroundColor: COLORS.white,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 10,
    },
    selectedButton: {
        backgroundColor: COLORS.yellow,
        borderColor: COLORS.yellowDark,
    },
    optionText: {
        color: "#333",
        fontWeight: "600",
    },
    selectedText: {
        color: COLORS.text,
        fontWeight: "700",
    },

    profileCard: {
        backgroundColor: COLORS.card,
        borderRadius: 24,
        padding: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    profileTop: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 18,
    },
    profileIconWrap: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: COLORS.yellowSoft,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    profileTopText: {
        flex: 1,
    },
    profileTitle: {
        fontSize: 18,
        fontWeight: "800",
        color: COLORS.text,
    },
    profileDesc: {
        marginTop: 4,
        fontSize: 13,
        color: COLORS.subText,
    },
    infoBox: {
        backgroundColor: "#FAFAFA",
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#F0F0F0",
    },
    infoGroup: {
        marginTop: 4,
    },
    infoLabel: {
        fontSize: 13,
        color: COLORS.subText,
        marginBottom: 6,
    },
    infoValue: {
        fontSize: 17,
        fontWeight: "800",
        color: COLORS.text,
    },
    summaryChipWrap: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginTop: 2,
    },
    summaryChip: {
        backgroundColor: COLORS.yellowSoft,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: "#F4E3A0",
    },
    summaryChipText: {
        fontSize: 13,
        fontWeight: "700",
        color: COLORS.text,
    },
    emptyTraitText: {
        fontSize: 14,
        color: COLORS.subText,
        marginTop: 4,
    },

    editButton: {
        marginTop: 18,
        backgroundColor: COLORS.yellow,
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 8,
    },
    editButtonText: {
        color: COLORS.text,
        fontSize: 16,
        fontWeight: "800",
    },

    bottomButtonRow: {
        flexDirection: "row",
        gap: 10,
        marginTop: 28,
    },
    cancelButton: {
        flex: 1,
        backgroundColor: COLORS.white,
        paddingVertical: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: "center",
    },
    cancelButtonText: {
        color: COLORS.text,
        fontSize: 15,
        fontWeight: "700",
    },
    saveButton: {
        flex: 1,
        backgroundColor: COLORS.yellow,
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: "center",
    },
    saveButtonText: {
        color: COLORS.text,
        fontSize: 16,
        fontWeight: "800",
    },
    resetButton: {
    marginTop: 12,
    backgroundColor: "#FF6B6B",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
},

resetButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
},
});