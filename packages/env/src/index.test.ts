import { expect, expectTypeOf, test } from "vitest";
import { z } from "zod";
import { createEnv } from "./index.ts";

test("parses declared fields with precise types and excludes undeclared secrets", () => {
  const env = createEnv({
    scope: "typed",
    schema: { PORT: z.coerce.number(), MODE: z.enum(["dev", "prod"]).default("dev") },
    values: { PORT: "3000", SECRET: "private" },
  });
  expect(env).toEqual({ PORT: 3000, MODE: "dev" });
  expectTypeOf(env.PORT).toEqualTypeOf<number>();
  expectTypeOf(env.MODE).toEqualTypeOf<"dev" | "prod">();
  expectTypeOf(env).not.toHaveProperty("SECRET");
});

test("errors never reveal invalid enum, literal, or credential values", () => {
  const secret = "private-credential";
  expect(() =>
    createEnv({
      scope: "redacted",
      schema: { MODE: z.enum(["dev", "prod"]), TOKEN: z.literal("expected"), URL: z.url() },
      values: { MODE: secret, TOKEN: secret, URL: `https://user:${secret}@invalid host` },
    }),
  ).toThrow("[env:redacted] Invalid environment: MODE, TOKEN, URL.");
});
