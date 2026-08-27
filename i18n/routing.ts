import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "bn"],
  defaultLocale: "en",
  localeCookie: { name: "NEOBEE_LOCALE", maxAge: 60 * 60 * 24 * 365 },
});

export type Locale = (typeof routing.locales)[number];
