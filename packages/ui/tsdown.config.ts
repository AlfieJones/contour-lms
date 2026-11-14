import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/**/*.ts", "src/**/*.tsx"],
  root: "src",
  report: false,
  platform: "neutral",
  target: "es2022",
  unbundle: true,
  deps: { neverBundle: true },
  dts: { sourcemap: true },
  sourcemap: true,
  // Resolve local subpath imports from source while packaging.
  inputOptions: {
    resolve: { conditionNames: ["source"] },
    // Every module is an entry in unbundle mode, so directives are preserved.
    checks: { moduleLevelDirective: false },
  },
  // Keep Tailwind directives and source paths intact for the consuming app.
  copy: [{ from: "src/styles/globals.css", to: "dist/styles" }],
});
