import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../", import.meta.url));
const options = { cwd, encoding: "utf8", stdio: ["inherit", "pipe", "inherit"] };

execFileSync("pnpm", ["exec", "supabase", "start"], options);
const status = JSON.parse(
  execFileSync("pnpm", ["exec", "supabase", "status", "-o", "json"], options),
);

const path = new URL("../apps/web/.env.local", import.meta.url);
const legacyPath = new URL("../.env.local", import.meta.url);
const examplePath = new URL("../.env.example", import.meta.url);
const source = existsSync(path) ? path : existsSync(legacyPath) ? legacyPath : examplePath;
let contents = readFileSync(source, "utf8");
const settings = parseEnv(contents);

// Keep existing settings and fill in missing fields from the example.
for (const line of readFileSync(examplePath, "utf8").split("\n")) {
  const key = line.match(/^([A-Z_]+)=/)?.[1];
  if (key && settings[key] === undefined) contents = `${contents.trimEnd()}\n${line}\n`;
}
for (const [key, value] of Object.entries({
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
  DATABASE_URL: status.DB_URL,
})) {
  const line = `${key}=${JSON.stringify(value)}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  contents = pattern.test(contents)
    ? contents.replace(pattern, () => line)
    : `${contents.trimEnd()}\n${line}\n`;
}
writeFileSync(path, contents, { mode: 0o600 });
console.log("Supabase is running. Wrote apps/web/.env.local.");
