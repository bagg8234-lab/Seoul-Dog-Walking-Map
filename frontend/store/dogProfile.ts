export type DogProfile = {
    size: "소형" | "중형" | "대형" | null;
    ageGroup: "강아지" | "성견" | "노령견" | null;
    energy: "낮음" | "보통" | "높음" | null;
    isLongBack: boolean;
    isShortNose: boolean;
    noiseSensitive: boolean;
    heatSensitive: boolean;
    jointWeak: boolean;
};

export const EMPTY_DOG_PROFILE: DogProfile = {
    size: null,
    ageGroup: null,
    energy: null,
    isLongBack: false,
    isShortNose: false,
    noiseSensitive: false,
    heatSensitive: false,
    jointWeak: false,
};

export let dogProfile: DogProfile = {
    ...EMPTY_DOG_PROFILE,
};

export function setDogProfile(newProfile: DogProfile) {
    dogProfile = newProfile;
}