import { Archivo, Inter, IBM_Plex_Mono, Noto_Sans_Bengali } from "next/font/google";

export const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo", display: "swap", weight: ["500", "600", "700", "800"] });
export const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
export const ibmPlexMono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-ibm-plex-mono", display: "swap", weight: ["400", "500", "600"] });
export const notoBengali = Noto_Sans_Bengali({ subsets: ["bengali"], variable: "--font-noto-bengali", display: "swap" });

export const fontVariables = [archivo.variable, inter.variable, ibmPlexMono.variable, notoBengali.variable].join(" ");
