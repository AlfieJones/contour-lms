import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createRouterClient, type RouterClient } from "@orpc/server";
import { createDb } from "@lms/db";
import { router } from "@lms/api";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createTestAccounts, type TestAccounts } from "./test-accounts";

describe.skipIf(!process.env.TEST_DATABASE_URL)("local auth and consultation API", () => {
  let fixture: Awaited<ReturnType<typeof createTestAccounts>>;
  let db: ReturnType<typeof createDb>;
  const sessions: SupabaseClient[] = [];
  const clients = {} as Record<keyof TestAccounts, RouterClient<typeof router>>;

  beforeAll(async () => {
    fixture = await createTestAccounts();
    db = createDb(process.env.TEST_DATABASE_URL!);
    for (const role of ["student", "teacher", "admin"] as const) {
      const supabase = createClient(
        process.env.TEST_SUPABASE_URL!,
        process.env.TEST_SUPABASE_PUBLISHABLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      sessions.push(supabase);
      const { email, password } = fixture.accounts[role];
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      clients[role] = createRouterClient(router, {
        context: { db, supabase, adminEmailPatterns: [fixture.accounts.admin.email] },
      });
    }
  });

  afterAll(async () => {
    try {
      await Promise.all(sessions.map((session) => session.auth.signOut({ scope: "local" })));
      await fixture?.cleanup();
    } finally {
      await db?.$client.end();
    }
  });

  test("generated accounts receive the intended roles and enforce admin access", async () => {
    for (const role of ["student", "teacher", "admin"] as const) {
      expect(await clients[role].user.get()).toMatchObject({
        id: fixture.accounts[role].id,
        role,
      });
    }
    await expect(clients.student.admin.users.list({ page: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(clients.teacher.admin.consultations({ page: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  test("a real booking persists, appears for staff and can be cancelled", async () => {
    const teacherId = fixture.accounts.teacher.id;
    const { slots } = await clients.student.consultation.availability.slots({
      teacherId,
      durationMinutes: 30,
    });
    expect(slots.length).toBeGreaterThan(0);
    const booking = await clients.student.consultation.create({
      teacherId,
      scheduledAt: slots[0]!,
      durationMinutes: 30,
      reason: "Vitest consultation smoke test",
    });
    expect(booking).toMatchObject({
      studentId: fixture.accounts.student.id,
      teacherId,
      status: "scheduled",
    });
    for (const client of [clients.student, clients.teacher]) {
      expect((await client.consultation.list({ page: 1 })).items.map((row) => row.id)).toContain(
        booking.id,
      );
    }
    expect(
      (await clients.admin.admin.consultations({ page: 1 })).items.map((row) => row.id),
    ).toContain(booking.id);
    await expect(clients.teacher.consultation.cancel({ id: booking.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect((await clients.student.consultation.cancel({ id: booking.id })).status).toBe(
      "cancelled",
    );
    expect(
      (await clients.student.consultation.list({ page: 1 })).items.find(
        (row) => row.id === booking.id,
      )?.status,
    ).toBe("cancelled");
  });

  test("logout removes the authenticated account", async () => {
    await clients.student.user.logout();
    expect(await clients.student.user.get()).toBeNull();
    await expect(clients.student.consultation.list({ page: 1 })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
