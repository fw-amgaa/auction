import type { Metadata } from "next";

import { ibmPlexMono, ibmPlexSans } from "@/lib/fonts";

import "./globals.css";

export const metadata: Metadata = {
  title: "Ан агнуурын үнийн санал дуудах систем",
  description:
    "Зэрлэг ан амьтны агнуурын эрхийн цахим дуудлага худалдааны албан ёсны систем.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn" className={`${ibmPlexSans.variable} ${ibmPlexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
