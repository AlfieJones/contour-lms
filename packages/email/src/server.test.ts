import { afterEach, beforeEach, expect, test, vi } from "vitest";

const { sendMail, createTransport } = vi.hoisted(() => ({
  sendMail: vi.fn(),
  createTransport: vi.fn(),
}));
vi.mock("nodemailer", () => ({ default: { createTransport } }));

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("APP_URL", "https://learn.example.com");
  vi.stubEnv("EMAIL_SMTP_URL", "smtp://localhost:55325");
  vi.stubEnv("EMAIL_FROM", "noreply@contour.local");
  vi.stubEnv("EMAIL_FROM_NAME", "Contour");
  createTransport.mockReturnValue({ sendMail });
  sendMail.mockResolvedValue({
    accepted: ["student@example.com"],
    rejected: [],
    messageId: "message-123",
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

test.each([true, false])(
  "sends enrolment HTML and text for existing account: %s",
  async (hasAccount) => {
    const mailer = await import("./server.ts");
    await expect(
      mailer.sendEnrolmentEmail({
        email: "student+test@example.com",
        teacherName: "Alfie Jones",
        hasAccount,
      }),
    ).resolves.toEqual({ messageId: "message-123" });
    const message = sendMail.mock.calls[0]![0];
    const expected = hasAccount
      ? "Alfie Jones added you as a student. Log in to book a consultation."
      : "Alfie Jones added you as a student. Sign up with student+test@example.com to book a consultation.";
    expect(message.html).toContain(expected);
    expect(message.text).toContain(expected);
    expect(message.to).toEqual({ address: "student+test@example.com", name: "" });
    expect(message.subject).toBe("You've been enrolled · Contour");
    expect(message.html).toContain(
      `https://learn.example.com/${hasAccount ? "login" : "signup"}?email=student%2Btest%40example.com`,
    );
  },
);

test("preserves SMTP failures for the enrolment flow to handle", async () => {
  const mailer = await import("./server.ts");
  const error = new Error("Connection refused");
  sendMail.mockRejectedValue(error);
  await expect(
    mailer.sendEnrolmentEmail({
      email: "student@example.com",
      teacherName: null,
      hasAccount: true,
    }),
  ).rejects.toBe(error);
});

test.each(["booked", "rescheduled", "cancelled"] as const)(
  "sends %s consultations with a calendar attachment",
  async (kind) => {
    const { sendConsultationEmail } = await import("./server.ts");
    await sendConsultationEmail({
      consultationId: "booking-123",
      sequence: 2,
      kind,
      scheduledAt: "2026-12-01T01:00:00Z",
      updatedAt: "2026-11-14T04:00:00Z",
      durationMinutes: 60,
      studentName: "Test Student",
      teacherName: "Test Teacher",
      studentEmail: "student@example.com",
      teacherEmail: "teacher@example.com",
      recipient: "teacher@example.com",
    });
    const message = sendMail.mock.calls[0]![0];
    expect(message.to).toEqual({ address: "teacher@example.com", name: "" });
    expect(message.html).toContain("https://learn.example.com/");
    expect(message.icalEvent).toMatchObject({
      filename: "consultation.ics",
      method: kind === "cancelled" ? "CANCEL" : "REQUEST",
    });
    expect(message.icalEvent.content).toContain("UID:booking-123@contour");
    expect(message.icalEvent.content).toContain(
      'ORGANIZER;CN="Contour":mailto:noreply@contour.local',
    );
  },
);
