import AsyncStorage from "@react-native-async-storage/async-storage";

export type AppLanguage = "en" | "ko";

const LANGUAGE_KEY = "stockledger.language.v1";

export const loadAppLanguage = async (): Promise<AppLanguage> => {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
    return stored === "ko" ? "ko" : "en";
  } catch {
    return "en";
  }
};

export const saveAppLanguage = async (language: AppLanguage) => {
  await AsyncStorage.setItem(LANGUAGE_KEY, language);
};
