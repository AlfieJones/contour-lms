import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";
import { authEmails, renderEmail, renderEnrolmentEmail } from "../src/index.tsx";

for (const [name, template] of Object.entries(authEmails)) {
  test(`${name} retains Supabase placeholders and matches its generated HTML and config`, async () => {
    const { html, text } = await renderEmail(template.element);
    expect(html).toContain(name === "reauthentication" ? "{{ .Token }}" : "{{ .ConfirmationURL }}");
    expect(text).toContain("Contour");
    const generated = await readFile(
      new URL(`../../../supabase/templates/${name}.html`, import.meta.url),
      "utf8",
    );
    expect(generated).toBe(`${html}\n`);
    const config = await readFile(
      new URL("../../../supabase/config.toml", import.meta.url),
      "utf8",
    );
    expect(config).toContain(
      `[auth.email.template.${name}]\nsubject = "${template.subject}"\ncontent_path = "./supabase/templates/${name}.html"`,
    );
  });
}

test("escapes user content and uses the configured application URL", async () => {
  const { html, text } = await renderEnrolmentEmail({
    email: "student@example.com",
    teacherName: '<script>alert("test")</script>',
    hasAccount: false,
    appUrl: "https://contour.example",
  });
  expect(html).not.toContain("<script>");
  expect(html).toContain("&lt;script&gt;");
  expect(text).toContain("added you as a student");
  expect(html).toContain("https://contour.example/signup?email=student%40example.com");
  expect(html).not.toContain("localhost");
});
