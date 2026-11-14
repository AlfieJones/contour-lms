import { defineConfig } from "vitest/config";

export default defineConfig({
  // Unit tests exercise current source rather than previously built modules.
  ssr: { resolve: { conditions: ["source", "node", "import", "default"] } },
});
