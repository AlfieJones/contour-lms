import type { ReactNode } from "react";
import { Body, Container, Head, Heading, Html, Preview, Text } from "react-email";

export function EmailLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{title}</Preview>
      <Body
        style={{ backgroundColor: "#ffffff", color: "#262626", fontFamily: "Arial, sans-serif" }}
      >
        <Container style={{ maxWidth: "480px", margin: "40px auto", padding: "24px" }}>
          <Text style={{ color: "#737373", fontSize: "14px" }}>Contour</Text>
          <Heading style={{ fontSize: "24px", lineHeight: "32px", margin: "24px 0 16px" }}>
            {title}
          </Heading>
          {children}
          <Text
            style={{ color: "#737373", fontSize: "12px", lineHeight: "18px", marginTop: "32px" }}
          >
            Contour · Your learning, connected.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
