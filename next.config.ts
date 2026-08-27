import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // Config redirects run before Proxy (see Next 16 proxy.md execution order),
  // so the next-intl proxy cannot intercept these. Prefixed variants cover
  // both locales; unprefixed covers the default-locale URL.
  async redirects() {
    return [
      { source: "/progress", destination: "/", permanent: true },
      { source: "/en/progress", destination: "/en", permanent: true },
      { source: "/bn/progress", destination: "/bn", permanent: true },
    ];
  },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
