"use client";

import { useEffect, useState } from "react";

/**
 * Read the active Google Translate target language from the `googtrans` cookie.
 * The cookie value looks like `/en/<target>` — return the last non-empty segment.
 */
function getLang(): string {
  const match = document.cookie.match(/(?:^|;\s*)googtrans=([^;]+)/);
  if (!match) return "en";
  const value = decodeURIComponent(match[1]);
  const parts = value.split("/").filter(Boolean);
  return parts[parts.length - 1] || "en";
}

/**
 * EN / বাংলা pill toggle that drives the Google Translate widget via the
 * `googtrans` cookie. Reloads the page so Google Translate picks up the change.
 *
 * Visual style: pill wrapper, ink active state, ink-soft inactive. The wrapper is marked `notranslate` so
 * Google doesn't translate the switcher labels themselves.
 */
export default function LanguageSwitcher() {
  const [lang, setLang] = useState<string>("en");

  useEffect(() => {
    setLang(getLang());
  }, []);

  const switchLang = (newLang: string) => {
    document.cookie = `googtrans=/en/${newLang}; path=/`;
    document.cookie = `googtrans=/en/${newLang}; path=/; domain=.${window.location.hostname}`;
    setLang(newLang);
    window.location.reload();
  };

  return (
    <div
      role="group"
      aria-label="Language"
      translate="no"
      className="notranslate inline-flex items-center gap-0.5 rounded-full border border-line bg-paper p-1"
    >
      <button
        type="button"
        onClick={() => switchLang("en")}
        aria-pressed={lang === "en"}
        className={
          "rounded-full px-3 py-1 text-xs font-semibold tracking-wide transition-colors " +
          (lang === "en"
            ? "bg-ink text-paper"
            : "text-ink-soft hover:text-ink")
        }
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => switchLang("bn")}
        aria-pressed={lang === "bn"}
        className={
          "rounded-full px-3 py-1 text-xs font-semibold tracking-wide transition-colors " +
          (lang === "bn"
            ? "bg-ink text-paper"
            : "text-ink-soft hover:text-ink")
        }
      >
        বাংলা
      </button>
    </div>
  );
}
