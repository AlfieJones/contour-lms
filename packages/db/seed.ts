import { createClient } from "@supabase/supabase-js";
import { createDb, eq, schema, sql } from "./src/index.ts";
import { authUsers } from "./src/auth-schema.ts";

// scripts/seed.mjs supplies these values using the local Supabase CLI.
const databaseUrl = process.env.SEED_DATABASE_URL;
const supabaseUrl = process.env.SEED_SUPABASE_URL;
const secretKey = process.env.SEED_SUPABASE_SECRET_KEY;
const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
if (
  !databaseUrl ||
  !supabaseUrl ||
  !secretKey ||
  !loopback.has(new URL(databaseUrl).hostname) ||
  !loopback.has(new URL(supabaseUrl).hostname)
) {
  throw new Error("Demo seeding requires local Supabase credentials. Run pnpm seed.");
}

const timeZone = "Australia/Melbourne";
const password = "ContourDemo123!";
const accounts = [
  { email: "admin@example.com", name: "Demo Admin", role: "student" },
  { email: "teacher@example.com", name: "Taylor Teacher", role: "teacher" },
  { email: "student@example.com", name: "Alex Student", role: "student" },
  { email: "student2@example.com", name: "Jamie Learner", role: "student" },
] as const;
const supabase = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const db = createDb(databaseUrl);
const users: { id: string; email: string; name: string; role: "student" | "teacher" }[] = [];

try {
  // Use Auth's admin API so confirmed users and password identities are created correctly.
  for (const account of accounts) {
    const [existing] = await db
      .select({ id: authUsers.id, metadata: authUsers.rawUserMetaData })
      .from(authUsers)
      .where(eq(authUsers.email, account.email));
    const attributes = {
      password,
      email_confirm: true,
      user_metadata: { ...existing?.metadata, full_name: account.name },
    };
    const { data, error } = existing
      ? await supabase.auth.admin.updateUserById(existing.id, attributes)
      : await supabase.auth.admin.createUser({ email: account.email, ...attributes });
    if (error || !data.user) throw new Error(`Could not seed ${account.email}: ${error?.message}`);
    users.push({ ...account, id: data.user.id });
  }

  const [, teacher, student, otherStudent] = users;
  if (!teacher || !student || !otherStudent) throw new Error("Demo accounts were not created.");
  const fixtureIds = [
    "def00000-0000-4000-8000-000000000001",
    "def00000-0000-4000-8000-000000000002",
    "def00000-0000-4000-8000-000000000003",
    "def00000-0000-4000-8000-000000000004",
  ];

  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`consultation:${teacher.id}`}, 0))`,
    );
    for (const user of users) {
      await tx
        .insert(schema.userRoles)
        .values({ userId: user.id, role: user.role })
        .onConflictDoUpdate({ target: schema.userRoles.userId, set: { role: user.role } });
    }
    await tx
      .insert(schema.enrolments)
      .values(
        [student, otherStudent].map((user) => ({
          teacherId: teacher.id,
          studentId: user.id,
          studentEmail: user.email,
          studentName: user.name,
        })),
      )
      .onConflictDoUpdate({
        target: [schema.enrolments.teacherId, schema.enrolments.studentEmail],
        set: { studentId: sql`excluded.student_id`, studentName: sql`excluded.student_name` },
      });
    await tx
      .insert(schema.teacherScheduleSettings)
      .values({ teacherId: teacher.id, timeZone })
      .onConflictDoUpdate({ target: schema.teacherScheduleSettings.teacherId, set: { timeZone } });
    await tx
      .delete(schema.teacherAvailability)
      .where(eq(schema.teacherAvailability.teacherId, teacher.id));
    await tx.insert(schema.teacherAvailability).values(
      [1, 2, 3, 4, 5].map((dayOfWeek) => ({
        teacherId: teacher.id,
        dayOfWeek,
        startMinute: 9 * 60,
        endMinute: 17 * 60,
      })),
    );

    // Refresh only these four fixtures. Other users and assessor-created bookings stay intact.
    for (const id of fixtureIds) {
      await tx.delete(schema.consultations).where(eq(schema.consultations.id, id));
    }
    const occupied = await tx
      .select({
        scheduledAt: schema.consultations.scheduledAt,
        durationMinutes: schema.consultations.durationMinutes,
      })
      .from(schema.consultations)
      .where(
        sql`${schema.consultations.teacherId} = ${teacher.id} and ${schema.consultations.status} <> 'cancelled'`,
      );
    // Choose free weekday sessions from tomorrow in Melbourne, including DST.
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      hourCycle: "h23",
    });
    const localParts = (time: number) =>
      Object.fromEntries(formatter.formatToParts(time).map(({ type, value }) => [type, value]));
    const localDate = (parts: Record<string, string>) =>
      `${parts.year}-${parts.month}-${parts.day}`;
    const today = localDate(localParts(Date.now()));
    let candidate = Math.ceil((Date.now() + 3600_000) / (30 * 60_000)) * 30 * 60_000;
    const upcoming: Date[] = [];
    const bookingHorizon = Date.now() + 90 * 86400_000;
    while (upcoming.length < 2 && candidate <= bookingHorizon) {
      const local = localParts(candidate);
      const end = candidate + 30 * 60_000;
      if (
        localDate(local) > today &&
        local.weekday !== "Sat" &&
        local.weekday !== "Sun" &&
        Number(local.hour) >= 9 &&
        Number(local.hour) < 17 &&
        !occupied.some(
          (booking) =>
            booking.scheduledAt.getTime() < end &&
            booking.scheduledAt.getTime() + booking.durationMinutes * 60_000 > candidate,
        )
      )
        upcoming.push(new Date(candidate));
      candidate += 30 * 60_000;
    }
    if (upcoming.length < 2)
      throw new Error("The demo teacher has no free slots in the next 90 days.");
    const [firstName, lastName] = student.name.split(" ");
    const [otherFirstName, otherLastName] = otherStudent.name.split(" ");
    const base = { teacherId: teacher.id, durationMinutes: 30 };
    await tx.insert(schema.consultations).values([
      {
        ...base,
        id: fixtureIds[0],
        studentId: student.id,
        studentEmail: student.email,
        firstName: firstName!,
        lastName: lastName!,
        reason: "Review algebra and prepare for the next assessment.",
        scheduledAt: upcoming[0]!,
      },
      {
        ...base,
        id: fixtureIds[1],
        studentId: otherStudent.id,
        studentEmail: otherStudent.email,
        firstName: otherFirstName!,
        lastName: otherLastName!,
        reason: "Work through practice exam questions.",
        scheduledAt: upcoming[1]!,
      },
      {
        ...base,
        id: fixtureIds[2],
        studentId: student.id,
        studentEmail: student.email,
        firstName: firstName!,
        lastName: lastName!,
        reason: "Discuss study planning and revision techniques.",
        scheduledAt: new Date(upcoming[0]!.getTime() - 7 * 86400_000),
        status: "completed",
      },
      {
        ...base,
        id: fixtureIds[3],
        studentId: otherStudent.id,
        studentEmail: otherStudent.email,
        firstName: otherFirstName!,
        lastName: otherLastName!,
        reason: "Cancelled sample consultation.",
        scheduledAt: new Date(upcoming[1]!.getTime() - 7 * 86400_000),
        status: "cancelled",
      },
    ]);
  });

  console.log("Demo accounts (email already confirmed):");
  console.table(
    accounts.map((account) => ({
      role: account.email === "admin@example.com" ? "admin" : account.role,
      email: account.email,
      password,
    })),
  );
  console.log(
    "Seeded two enrolled students, weekday availability (9am–5pm Melbourne), and four consultations.",
  );
} finally {
  await db.$client.end();
}
