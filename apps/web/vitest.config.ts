import { defineConfig } from "vitest/config";

export default defineConfig({
  ssr: { resolve: { conditions: ["development", "source", "node", "import", "default"] } },
  test: { include: ["src/**/*.test.ts", "testing/**/*.integration.test.ts"] },
});
