"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { dictionaries, Lang, Dictionary } from "./dictionaries";

// Noto Sans Bengali will be loaded in the root layout in a later phase.

type LanguageContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (path: DotPath<Dictionary>) => string;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined
);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem("neobee-lang");
    if (stored === "en" || stored === "bn") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- post-hydration sync from localStorage; must not run in initializer or it causes an SSR hydration mismatch
      setLangState(stored);
    }
  }, []);

  const setLang = (next: Lang) => {
    setLangState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("neobee-lang", next);
    }
  };

  const t = (path: DotPath<Dictionary>): string => {
    return getByDotPath(dictionaries[lang], path);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLang must be used within a LanguageProvider");
  }
  return ctx;
}

// Dot-path helpers for typed dictionary lookup.

type DotPath<T> = T extends string
  ? never
  : T extends Record<string, unknown>
  ? {
      [K in keyof T & string]: T[K] extends string
        ? K
        : `${K}.${DotPath<T[K]>}`;
    }[keyof T & string]
  : never;

function getByDotPath<T extends Record<string, unknown>>(
  obj: T,
  path: string
): string {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return path;
    }
  }
  return typeof current === "string" ? current : path;
}
