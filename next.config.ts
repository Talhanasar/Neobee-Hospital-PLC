import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // pdfkit resolves its .afm font data relative to its own __dirname at
  // runtime; bundler tracing breaks that path. Loading it as an external
  // keeps the real node_modules path intact.
  serverExternalPackages: ["pdfkit"],
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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=15552000; includeSubDomains" },
        ],
      },
      {
        source: "/:locale/receipts/:path*",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
