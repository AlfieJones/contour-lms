import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createDb, schema } from "@lms/db";

export type TestAccount = { id: string; email: string; password: string; name: string };
export type TestAccounts = Record<"student" | "teacher" | "admin", TestAccount>;

function localUrl(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`Missing ${key}. Run this through pnpm test:e2e or test:accounts.`);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(value).hostname)) {
    throw new Error(`Refusing to generate test accounts: ${key} must point to local Supabase.`);
  }
  return value;
}

/** Node-only fixture: uses local privileged credentials, never sent to the browser. */
export async function createTestAccounts() {
  const url = localUrl("TEST_SUPABASE_URL");
  const databaseUrl = localUrl("TEST_DATABASE_URL");
  const key = process.env.TEST_SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Missing TEST_SUPABASE_SECRET_KEY. Start local Supabase first.");
  const auth = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const db = createDb(databaseUrl);
  const prefix = randomUUID();
  const created: string[] = [];

  async function cleanup() {
    const results = await Promise.all(created.map((id) => auth.auth.admin.deleteUser(id)));
    const errors = results.flatMap((result) => (result.error ? [result.error] : []));
    if (errors.length) throw new AggregateError(errors, "Could not clean up test accounts.");
  }

  try {
    const accounts = {} as TestAccounts;
    for (const role of ["student", "teacher", "admin"] as const) {
      const email = `${role}-${prefix}@${role === "admin" ? "e2e-admin.example.com" : "example.com"}`;
      const password = `Test-${randomUUID()}!`;
      const name = `E2E ${role}`;
      const { data, error } = await auth.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name },
      });
      if (error) throw error;
      created.push(data.user.id);
      accounts[role] = { id: data.user.id, email, password, name };
    }
    await db.insert(schema.userRoles).values({ userId: accounts.teacher.id, role: "teacher" });
    // Give both staff accounts a verified student to book for.
    await db.insert(schema.enrolments).values(
      [accounts.teacher, accounts.admin].map((teacher) => ({
        teacherId: teacher.id,
        studentEmail: accounts.student.email,
        studentId: accounts.student.id,
        studentName: accounts.student.name,
      })),
    );
    for (const teacher of [accounts.teacher, accounts.admin]) {
      await db.insert(schema.teacherScheduleSettings).values({
        teacherId: teacher.id,
        timeZone: "Australia/Perth",
      });
      await db.insert(schema.teacherAvailability).values(
        [1, 2, 3, 4, 5].map((dayOfWeek) => ({
          teacherId: teacher.id,
          dayOfWeek,
          startMinute: 9 * 60,
          endMinute: 17 * 60,
        })),
      );
    }
    return { accounts, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  } finally {
    await db.$client.end();
  }
}
