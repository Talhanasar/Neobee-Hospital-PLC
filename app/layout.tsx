import type { Metadata } from "next";
import "./globals.css"

// The hexagon mark is the site icon everywhere (same as the reference build).
export const metadata: Metadata = {
  icons: {
    icon: "/hex-icon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
