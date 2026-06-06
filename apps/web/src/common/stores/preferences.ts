import { create } from "zustand";
import { Language } from "@/common/types";

const STORAGE_KEY_DARK = "darkMode";
const STORAGE_KEY_LANG = "language";

type PreferencesState = {
  language: Language;
  darkMode: boolean;
  /** localStorage 반영 완료 여부. (SSR 기본값 → 마운트 후 hydrate) */
  hydrated: boolean;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  setDarkMode: (darkMode: boolean) => void;
  toggleDarkMode: () => void;
  /** 마운트 후 1회. localStorage에서 설정을 읽어 반영(하이드레이션 mismatch 회피). */
  hydrate: () => void;
};

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  language: "en",
  darkMode: false,
  hydrated: false,

  setLanguage: (language) => {
    set({ language });
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY_LANG, language);
    }
  },
  toggleLanguage: () => get().setLanguage(get().language === "en" ? "ko" : "en"),

  setDarkMode: (darkMode) => {
    set({ darkMode });
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY_DARK, String(darkMode));
    }
  },
  toggleDarkMode: () => get().setDarkMode(!get().darkMode),

  hydrate: () => {
    if (typeof window === "undefined") {
      return;
    }
    const darkMode = window.localStorage.getItem(STORAGE_KEY_DARK) === "true";
    const storedLang = window.localStorage.getItem(STORAGE_KEY_LANG);
    const language: Language = storedLang === "ko" ? "ko" : "en";
    set({ darkMode, language, hydrated: true });
  },
}));
