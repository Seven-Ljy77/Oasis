import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Locale, TranslationDict } from "@/lib/translations";
import { translations } from "@/lib/translations";
import { useSettingsStore } from "@/stores/useSettingsStore";

interface I18nContextValue {
  t: TranslationDict;
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function resolveLocale(raw: string | undefined): Locale {
  if (raw === "zh-CN" || raw === "zh" || raw === "zh-cn") return "zh-CN";
  return "en";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() =>
    resolveLocale(useSettingsStore.getState().settings.language),
  );

  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const store = useSettingsStore.getState();
    if (store.settings.language !== locale) {
      store.updateSetting("language", locale);
      store.saveSettings(store.settings);
    }
  }, [locale]);

  const t = translations[locale] ?? translations["en"];

  return (
    <I18nContext.Provider value={{ t, locale, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return ctx;
}
