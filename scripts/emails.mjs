import { mkdir, writeFile } from "node:fs/promises";
import { authEmails, renderEmail } from "../packages/email/dist/index.js";

const directory = new URL("../supabase/templates/", import.meta.url);
await mkdir(directory, { recursive: true });
for (const [name, content] of Object.entries(authEmails)) {
  const { html } = await renderEmail(content.element);
  await writeFile(new URL(`${name}.html`, directory), `${html}\n`);
}
console.log("Generated Supabase auth emails.");
