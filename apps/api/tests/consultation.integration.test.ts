import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createRouterClient } from "@orpc/server";
import { createDb, sql, schema, eq } from "@lms/db";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { router, type ApiContext } from "../src/index.ts";

// Opt in against a disposable local Supabase project with the migration applied.
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "consultation access controls with real Supabase and Postgres",
  () => {
    const db = createDb(
      process.env.TEST_DATABASE_URL ?? "postgresql://unused:unused@localhost/unused",
    );
    const url = process.env.TEST_SUPABASE_URL ?? "http://127.0.0.1:55321";
    const options = {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    };
    const authAdmin = createClient(url, process.env.TEST_SUPABASE_SECRET_KEY ?? "unused", options);
    const prefix = randomUUID();
    const adminEmail = `admin-${prefix}@example.com`;
    const ids: string[] = [];
    const sessions: SupabaseClient[] = [];
    const sessionsByEmail = new Map<string, SupabaseClient>();
    const future = () => new Date(Date.now() + 86400_000).toISOString();
    let teacherId: string;
    let teacherBId: string;
    const booking = () => ({
      teacherId,
      firstName: "Test",
      lastName: "Student",
      reason: "Assessment test",
      scheduledAt: future(),
    });

    async function account(email: string, fullName?: string) {
      const password = randomUUID();
      const created = await authAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (created.error) throw created.error;
      ids.push(created.data.user.id);
      const supabase = createClient(
        url,
        process.env.TEST_SUPABASE_PUBLISHABLE_KEY ?? "unused",
        options,
      );
      sessions.push(supabase);
      sessionsByEmail.set(email, supabase);
      const signedIn = await supabase.auth.signInWithPassword({ email, password });
      if (signedIn.error) throw signedIn.error;
      return createRouterClient(router, {
        context: { db, supabase, adminEmailPatterns: [adminEmail] } satisfies ApiContext,
      });
    }

    let studentA: Awaited<ReturnType<typeof account>>;
    let studentB: Awaited<ReturnType<typeof account>>;
    let admin: Awaited<ReturnType<typeof account>>;
    let teacher: Awaited<ReturnType<typeof account>>;
    let teacherB: Awaited<ReturnType<typeof account>>;

    beforeAll(async () => {
      [studentA, studentB, admin, teacher, teacherB] = await Promise.all([
        account(`student-a-${prefix}@example.com`),
        account(`student-b-${prefix}@example.com`),
        account(adminEmail),
        account(`teacher-${prefix}@example.com`, "Alfie Test"),
        account(`teacher-b-${prefix}@example.com`),
      ]);
      teacherId = (await teacher.user.get())!.id;
      teacherBId = (await teacherB.user.get())!.id;
      await admin.admin.users.setRole({ userId: teacherId, role: "teacher" });
      await admin.admin.users.setRole({ userId: teacherBId, role: "teacher" });
      for (const email of [`student-a-${prefix}@example.com`, `student-b-${prefix}@example.com`]) {
        expect((await teacher.enrolment.enrol({ email })).emailSent).toBe(true);
      }
    });

    afterAll(async () => {
      await Promise.all(sessions.map((session) => session.auth.signOut({ scope: "local" })));
      await Promise.all(ids.map((id) => authAdmin.auth.admin.deleteUser(id)));
      await db.$client.end();
    });

    test("students manage only their own bookings; cancellation is terminal", async () => {
      const created = await studentA.consultation.create(booking());
      expect(created.studentId).toBe((await studentA.user.get())?.id);
      const own = await studentA.consultation.list({ page: 1 });
      expect(own.items.map((item) => item.id)).toContain(created.id);
      expect((await studentB.consultation.list({ page: 1 })).items).toEqual([]);

      await expect(
        studentB.consultation.reschedule({ id: created.id, teacherId, scheduledAt: future() }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        studentB.consultation.setComplete({ id: created.id, complete: true }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(studentB.consultation.cancel({ id: created.id })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });

      expect(
        (await studentA.consultation.setComplete({ id: created.id, complete: true })).status,
      ).toBe("completed");
      expect(
        (await studentA.consultation.setComplete({ id: created.id, complete: false })).status,
      ).toBe("scheduled");
      const newTime = new Date(Date.now() + 172800_000).toISOString();
      expect(
        (
          await studentA.consultation.reschedule({
            id: created.id,
            teacherId,
            scheduledAt: newTime,
          })
        ).scheduledAt.toISOString(),
      ).toBe(newTime);
      expect((await studentA.consultation.cancel({ id: created.id })).status).toBe("cancelled");
      await expect(
        studentA.consultation.setComplete({ id: created.id, complete: false }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        studentA.consultation.reschedule({ id: created.id, teacherId, scheduledAt: future() }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    test("admins can read all bookings but cannot manage another teacher's consultations", async () => {
      const first = await studentA.consultation.create(booking());
      const second = await studentB.consultation.create(booking());
      const all = await admin.admin.consultations({ page: 1 });
      expect(all.items.map((item) => item.id)).toEqual(
        expect.arrayContaining([first.id, second.id]),
      );
      await expect(studentA.admin.consultations({ page: 1 })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(admin.consultation.create(booking())).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(admin.consultation.cancel({ id: first.id })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(
        admin.consultation.reschedule({ id: first.id, teacherId, scheduledAt: future() }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        admin.consultation.setComplete({ id: first.id, complete: true }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(teacher.admin.consultations({ page: 1 })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });

    test("admins enrol students and manage their own teacher consultations without a stored teacher role", async () => {
      const administrator = (await admin.user.get())!;
      const student = (await studentB.user.get())!;
      const otherStudent = (await studentA.user.get())!;
      expect(
        await db
          .select()
          .from(schema.userRoles)
          .where(eq(schema.userRoles.userId, administrator.id)),
      ).toEqual([]);
      await expect(
        studentB.consultation.create({ ...booking(), teacherId: administrator.id }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });

      const invitation = await admin.enrolment.enrol({ email: student.email });
      expect(invitation.emailSent).toBe(true);
      expect(invitation.teacherId).toBe(administrator.id);
      expect(invitation.studentId).toBe(student.id);
      expect((await admin.enrolment.students({ page: 1 })).items.map((row) => row.id)).toContain(
        invitation.id,
      );
      expect(
        (await teacher.enrolment.students({ page: 1 })).items.map((row) => row.id),
      ).not.toContain(invitation.id);
      expect(await admin.enrolment.resend({ id: invitation.id })).toEqual({ emailSent: true });
      await expect(teacher.enrolment.resend({ id: invitation.id })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect(await studentB.enrolment.teachers()).toContainEqual({
        id: administrator.id,
        email: adminEmail,
      });
      await expect(
        studentA.consultation.create({ ...booking(), teacherId: administrator.id }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });

      const own = await studentB.consultation.create({ ...booking(), teacherId: administrator.id });
      const unrelated = await studentA.consultation.create(booking());
      expect((await admin.consultation.list({ page: 1 })).items.map((row) => row.id)).toEqual([
        own.id,
      ]);
      expect((await admin.admin.consultations({ page: 1 })).items.map((row) => row.id)).toEqual(
        expect.arrayContaining([own.id, unrelated.id]),
      );
      expect((await admin.consultation.setComplete({ id: own.id, complete: true })).status).toBe(
        "completed",
      );
      expect((await admin.consultation.setComplete({ id: own.id, complete: false })).status).toBe(
        "scheduled",
      );
      expect(
        (await teacher.consultation.list({ page: 1 })).items.map((row) => row.id),
      ).not.toContain(own.id);
      await expect(
        admin.consultation.setComplete({ id: unrelated.id, complete: true }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });

      // Teacher capabilities follow the current allowlist, including an admin's missing role row.
      const formerAdmin = createRouterClient(router, {
        context: { db, supabase: sessionsByEmail.get(adminEmail)!, adminEmailPatterns: [] },
      });
      expect((await formerAdmin.user.get())?.role).toBe("student");
      await expect(
        formerAdmin.enrolment.enrol({ email: otherStudent.email }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      const studentWithoutAdmin = createRouterClient(router, {
        context: { db, supabase: sessionsByEmail.get(student.email)!, adminEmailPatterns: [] },
      });
      expect((await studentWithoutAdmin.enrolment.teachers()).map((row) => row.id)).not.toContain(
        administrator.id,
      );
      await expect(
        studentWithoutAdmin.consultation.create({ ...booking(), teacherId: administrator.id }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    test("rejects invalid booking data and excludes caller-supplied ownership", async () => {
      await expect(
        studentA.consultation.create({ ...booking(), scheduledAt: "2020-01-01T00:00:00Z" }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(
        studentA.consultation.create({ ...booking(), reason: " " }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      const user = await studentA.user.get();
      const forged = { ...booking(), studentId: randomUUID(), status: "completed" };
      const created = await studentA.consultation.create(forged);
      expect(created.studentId).toBe(user?.id);
      expect(created.status).toBe("scheduled");
    });

    test("only admins can list users and switch student/teacher roles", async () => {
      const student = await studentA.user.get();
      const administrator = await admin.user.get();
      const userId = student!.id;
      const result = await admin.admin.users.list({ page: 1 });
      const listed = result.items.find((user) => user.id === userId);
      expect(listed?.role).toBe("student");
      expect(Object.keys(listed!).sort()).toEqual(["email", "id", "role"]);

      await expect(studentA.admin.users.list({ page: 1 })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(studentA.admin.users.setRole({ userId, role: "teacher" })).rejects.toMatchObject(
        { code: "FORBIDDEN" },
      );

      await admin.admin.users.setRole({ userId, role: "teacher" });
      expect((await studentA.user.get())?.role).toBe("teacher");
      expect(
        (await admin.admin.users.list({ page: 1 })).items.find((user) => user.id === userId)?.role,
      ).toBe("teacher");
      await expect(studentA.admin.users.list({ page: 1 })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(studentA.admin.users.setRole({ userId, role: "student" })).rejects.toMatchObject(
        { code: "FORBIDDEN" },
      );
      await expect(studentA.admin.consultations({ page: 1 })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(studentA.consultation.create(booking())).rejects.toMatchObject({
        code: "FORBIDDEN",
      });

      await admin.admin.users.setRole({ userId, role: "student" });
      expect((await studentA.user.get())?.role).toBe("student");
      await expect(
        admin.admin.users.setRole({ userId: administrator!.id, role: "teacher" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        admin.admin.users.setRole({ userId: randomUUID(), role: "teacher" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });

      // @ts-expect-error Verify runtime validation when a caller bypasses the client's types.
      const forgedRequest = admin.admin.users.setRole({ userId, role: "admin" });
      await expect(forgedRequest).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      expect((await studentA.user.get())?.role).toBe("student");
    });

    test("only enrolled teachers can be booked and teachers see only assigned consultations", async () => {
      await expect(
        studentA.consultation.create({ ...booking(), teacherId: teacherBId }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        studentA.consultation.create({ ...booking(), teacherId: (await studentB.user.get())!.id }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      const created = await studentA.consultation.create(booking());
      expect((await teacher.consultation.list({ page: 1 })).items.map((item) => item.id)).toContain(
        created.id,
      );
      expect(
        (await teacherB.consultation.list({ page: 1 })).items.map((item) => item.id),
      ).not.toContain(created.id);
      await expect(
        teacherB.consultation.setComplete({ id: created.id, complete: true }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(
        (await teacher.consultation.setComplete({ id: created.id, complete: true })).status,
      ).toBe("completed");
      await expect(teacher.consultation.cancel({ id: created.id })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await admin.admin.users.setRole({ userId: teacherId, role: "student" });
      expect(await studentA.enrolment.teachers()).toEqual([]);
      await expect(studentA.consultation.create(booking())).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await admin.admin.users.setRole({ userId: teacherId, role: "teacher" });
    });

    test("teachers book on behalf of their verified students, with ownership assigned by the server", async () => {
      const student = (await studentA.user.get())!;
      const enrolment = (await teacher.enrolment.students({ page: 1 })).items.find(
        (item) => item.studentId === student.id,
      )!;
      const { teacherId: _teacherId, ...details } = booking();
      const created = await teacher.consultation.createForStudent({
        ...details,
        enrolmentId: enrolment.id,
      });
      expect(created).toMatchObject({
        studentId: student.id,
        teacherId,
        status: "scheduled",
        firstName: details.firstName,
      });
      expect((await teacher.consultation.list({ page: 1 })).items.map((item) => item.id)).toContain(
        created.id,
      );
      expect(
        (await studentA.consultation.list({ page: 1 })).items.map((item) => item.id),
      ).toContain(created.id);
      expect(
        (await studentB.consultation.list({ page: 1 })).items.map((item) => item.id),
      ).not.toContain(created.id);
      expect(
        (await teacherB.consultation.list({ page: 1 })).items.map((item) => item.id),
      ).not.toContain(created.id);
      expect((await studentA.consultation.cancel({ id: created.id })).status).toBe("cancelled");

      await expect(
        teacherB.consultation.createForStudent({ ...details, enrolmentId: enrolment.id }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        studentA.consultation.createForStudent({ ...details, enrolmentId: enrolment.id }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        teacher.consultation.createForStudent({ ...details, enrolmentId: randomUUID() }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      const forged = {
        ...details,
        enrolmentId: enrolment.id,
        teacherId: teacherBId,
        studentId: (await studentB.user.get())!.id,
        status: "completed",
      };
      await expect(teacher.consultation.createForStudent(forged)).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      await expect(
        teacher.consultation.createForStudent({
          ...details,
          enrolmentId: enrolment.id,
          scheduledAt: "2020-01-01T00:00:00Z",
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    test("teacher booking rejects unverified enrolments and rechecks current roles", async () => {
      const pending = await teacher.enrolment.enrol({
        email: `booking-pending-${prefix}@example.com`,
      });
      const { teacherId: _teacherId, ...details } = booking();
      await expect(
        teacher.consultation.createForStudent({ ...details, enrolmentId: pending.id }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      const student = (await studentA.user.get())!;
      const enrolment = (await teacher.enrolment.students({ page: 1 })).items.find(
        (item) => item.studentId === student.id,
      )!;
      try {
        await admin.admin.users.setRole({ userId: student.id, role: "teacher" });
        await expect(
          teacher.consultation.createForStudent({ ...details, enrolmentId: enrolment.id }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      } finally {
        await admin.admin.users.setRole({ userId: student.id, role: "student" });
      }
      try {
        await admin.admin.users.setRole({ userId: teacherId, role: "student" });
        await expect(
          teacher.consultation.createForStudent({ ...details, enrolmentId: enrolment.id }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
      } finally {
        await admin.admin.users.setRole({ userId: teacherId, role: "teacher" });
      }
    });

    async function inbox(email: string) {
      const response = await fetch(
        `http://127.0.0.1:55324/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
      );
      const result = (await response.json()) as { messages: { ID: string; Subject: string }[] };
      return Promise.all(
        result.messages.map(async (item) => {
          const detail = await fetch(`http://127.0.0.1:55324/api/v1/message/${item.ID}`);
          return (await detail.json()) as { HTML: string; Text: string; Subject: string };
        }),
      );
    }

    test("enrolment emails distinguish existing accounts and pending signups; all teachers link after verification", async () => {
      const existing = await inbox(`student-a-${prefix}@example.com`);
      expect(
        existing.some(
          (mail) => mail.HTML.includes("Log in") && mail.HTML.includes("/login?email="),
        ),
      ).toBe(true);
      const email = `pending-${prefix}@example.com`;
      const invitation = await teacher.enrolment.enrol({ email: email.toUpperCase() });
      expect(invitation.studentId).toBeNull();
      expect(invitation.emailSent).toBe(true);
      await teacherB.enrolment.enrol({ email });
      expect(
        (await inbox(email)).some(
          (mail) => mail.HTML.includes("Create account") && mail.HTML.includes("/signup?email="),
        ),
      ).toBe(true);
      await expect(teacher.enrolment.enrol({ email })).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(teacherB.enrolment.resend({ id: invitation.id })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(studentA.enrolment.enrol({ email })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(teacher.enrolment.enrol({ email: adminEmail })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      await expect(
        teacher.enrolment.enrol({ email: `teacher-b-${prefix}@example.com` }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });

      const password = randomUUID();
      const supabase = createClient(
        url,
        process.env.TEST_SUPABASE_PUBLISHABLE_KEY ?? "unused",
        options,
      );
      sessions.push(supabase);
      const signup = await supabase.auth.signUp({ email, password });
      if (signup.error) throw signup.error;
      ids.push(signup.data.user!.id);
      const pending = await db
        .select()
        .from(schema.enrolments)
        .where(eq(schema.enrolments.studentEmail, email));
      expect(pending.every((row) => row.studentId === null)).toBe(true);
      const confirmation = (await inbox(email)).find((mail) =>
        mail.Subject.includes("Verify your email"),
      );
      expect(confirmation?.HTML).toContain("Confirm your email to finish signing up.");
      const link = confirmation?.HTML.match(
        /href="([^"]*\/auth\/v1\/verify[^"]*)"/,
      )?.[1]?.replaceAll("&amp;", "&");
      expect(link).toBeTruthy();
      const verified = await fetch(link!, { redirect: "manual" });
      expect([302, 303]).toContain(verified.status);
      const signedIn = await supabase.auth.signInWithPassword({ email, password });
      if (signedIn.error) throw signedIn.error;
      const student = createRouterClient(router, {
        context: { db, supabase, adminEmailPatterns: [adminEmail] },
      });
      expect((await student.enrolment.teachers()).map((row) => row.id).sort()).toEqual(
        [teacherId, teacherBId].sort(),
      );
      expect(
        (await teacher.enrolment.students({ page: 1 })).items.find(
          (row) => row.id === invitation.id,
        )?.studentId,
      ).toBe(signup.data.user!.id);
      expect((await student.consultation.create(booking())).teacherId).toBe(teacherId);
      expect(
        (await student.consultation.create({ ...booking(), teacherId: teacherBId })).teacherId,
      ).toBe(teacherBId);
    });

    test("enrolment and resend emails use the teacher's current name instead of their email", async () => {
      const email = `teacher-name-${prefix}@example.com`;
      const invitation = await teacher.enrolment.enrol({ email });
      expect(invitation.emailSent).toBe(true);
      expect(
        (await inbox(email)).some((mail) =>
          mail.Text.includes("Alfie Test added you as a student."),
        ),
      ).toBe(true);
      const session = sessionsByEmail.get(`teacher-${prefix}@example.com`)!;
      try {
        const updated = await session.auth.updateUser({ data: { full_name: "Updated Teacher" } });
        if (updated.error) throw updated.error;
        expect(await teacher.enrolment.resend({ id: invitation.id })).toEqual({ emailSent: true });
        const messages = await inbox(email);
        expect(
          messages.some((mail) => mail.Text.includes("Updated Teacher added you as a student.")),
        ).toBe(true);
        expect(
          messages.every((mail) => !mail.Text.includes(`teacher-${prefix}@example.com added you`)),
        ).toBe(true);
      } finally {
        await session.auth.updateUser({ data: { full_name: "Alfie Test" } });
      }
    });

    test("failed emails preserve enrolments and can be resent by their teacher", async () => {
      const originalFetch = globalThis.fetch;
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockImplementation((input, init) =>
          (input instanceof Request ? input.url : input.toString()).includes("/api/v1/send")
            ? Promise.resolve(new Response("Unavailable", { status: 503 }))
            : originalFetch(input, init),
        );
      const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      let id: string;
      try {
        const result = await teacher.enrolment.enrol({ email: `retry-${prefix}@example.com` });
        id = result.id;
        expect(result.emailSent).toBe(false);
        expect(
          (await teacher.enrolment.students({ page: 1 })).items.map((row) => row.id),
        ).toContain(id);
      } finally {
        fetchSpy.mockRestore();
        logSpy.mockRestore();
      }
      expect((await teacher.enrolment.resend({ id: id! })).emailSent).toBe(true);
    });

    test("browser database roles cannot access application tables", async () => {
      const [permissions] = await db.execute(sql`
        select
          has_schema_privilege('anon', 'app', 'usage') as anon_schema,
          has_schema_privilege('authenticated', 'app', 'usage') as authenticated_schema,
          has_table_privilege('anon', 'app.consultations', 'select,insert,update,delete') as anon_table,
          has_table_privilege('authenticated', 'app.consultations', 'select,insert,update,delete') as authenticated_table,
          has_table_privilege('anon', 'app.user_roles', 'select,insert,update,delete') as anon_roles,
          has_table_privilege('authenticated', 'app.user_roles', 'select,insert,update,delete') as authenticated_roles,
          has_table_privilege('anon', 'app.enrolments', 'select,insert,update,delete') as anon_enrolments,
          has_table_privilege('authenticated', 'app.enrolments', 'select,insert,update,delete') as authenticated_enrolments
      `);
      expect(permissions).toEqual({
        anon_schema: false,
        authenticated_schema: false,
        anon_table: false,
        authenticated_table: false,
        anon_roles: false,
        authenticated_roles: false,
        anon_enrolments: false,
        authenticated_enrolments: false,
      });
    });
  },
);
