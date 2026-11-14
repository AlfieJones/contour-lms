import { expect, test, vi, afterEach } from "vitest";
import { emailEnvSchema } from "../src/index.ts";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.restoreAllMocks();
});

test("email configuration defaults to Supabase's local inbox", () => {
  expect(emailEnvSchema.parse({})).toEqual({
    APP_URL: "http://localhost:3000",
    EMAIL_SMTP_URL: "smtp://127.0.0.1:55325",
    EMAIL_FROM: "noreply@contour.local",
    EMAIL_FROM_NAME: "Contour",
  });
});

test.each(["http://mail.example.com", "not-a-url"])(
  "rejects invalid SMTP URL %s",
  (EMAIL_SMTP_URL) => {
    expect(emailEnvSchema.safeParse({ EMAIL_SMTP_URL }).success).toBe(false);
  },
);

test("accepts SMTP TLS, credentials, and a deployed application URL", () => {
  expect(
    emailEnvSchema.parse({
      APP_URL: "https://learn.example.com",
      EMAIL_SMTP_URL: "smtps://user:password@mail.example.com:465",
      EMAIL_FROM: "support@example.com",
      EMAIL_FROM_NAME: "Contour Learning",
    }).EMAIL_SMTP_URL,
  ).toBe("smtps://user:password@mail.example.com:465");
});

test("configuration errors do not expose SMTP credentials", async () => {
  vi.stubEnv("EMAIL_SMTP_URL", "https://user:secret-password@mail.example.com");
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  await expect(import("../src/email.ts")).rejects.toThrow("EMAIL_SMTP_URL");
  expect(String(warn.mock.calls[0]?.[0])).not.toContain("secret-password");
});

test("rejects browser access to email configuration", async () => {
  vi.stubGlobal("window", {});
  await expect(import("../src/email.ts")).rejects.toThrow("server-only");
});
