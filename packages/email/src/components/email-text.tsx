import type { ReactNode } from "react";
import { Text } from "react-email";

export function EmailText({ children }: { children: ReactNode }) {
  return (
    <Text style={{ fontSize: "16px", lineHeight: "24px", margin: "0 0 24px" }}>{children}</Text>
  );
}
