import type { Metadata } from "next";
import type { ReactNode } from "react";

import "../styles/globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Contour",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="relative font-sans">
        <div className="isolate relative flex min-h-svh flex-col">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}
