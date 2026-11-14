import type { ReactNode } from "react";
import { Button } from "react-email";

export function EmailAction({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button
      href={href}
      style={{
        backgroundColor: "#262626",
        color: "#ffffff",
        borderRadius: "6px",
        padding: "12px 20px",
        fontSize: "14px",
      }}
    >
      {children}
    </Button>
  );
}
