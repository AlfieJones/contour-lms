import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist } from "next/font/google";

import "../styles/globals.css";
import Providers from "./providers";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export const metadata: Metadata = {
  title: "Contour",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={geist.variable} suppressHydrationWarning>
      <body className="relative font-sans">
        <div className="isolate relative flex min-h-svh flex-col">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}
