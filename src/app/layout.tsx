import type { Metadata } from "next";
import { Inter, Archivo, IBM_Plex_Mono, Noto_Sans_Bengali } from "next/font/google";
import GoogleTranslate from "@/components/GoogleTranslate";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

// Loaded for Bangla fallback on the landing copy.
const notoBengali = Noto_Sans_Bengali({
  variable: "--font-noto-bengali",
  subsets: ["bengali"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Neobee Hospital PLC — Stakeholder Portal",
  description:
    "Neobee Hospital PLC — a specialized, full-service hospital initiative in Chattogram. Reserve your shares, receive a unique ID, digital money receipt and QR verification.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${archivo.variable} ${plexMono.variable} ${notoBengali.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <GoogleTranslate />
        {children}
      </body>
    </html>
  );
}
