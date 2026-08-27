import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ locale }) => {
  const resolved = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  return {
    locale: resolved,
    messages: (await import(`../messages/${resolved}.json`)).default,
  };
});
