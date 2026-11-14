import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Contour",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="relative font-sans">
        <div className="isolate relative flex min-h-svh flex-col">{children}</div>
      </body>
    </html>
  );
}
