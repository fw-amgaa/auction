import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

// UI font — full Cyrillic coverage for Mongolian.
export const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

// All numbers / prices / timers — tabular figures so digits don't jiggle.
export const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});
