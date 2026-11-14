import { afterEach, expect, test, vi } from "vitest";
import { createEmailSender } from "../src/sender.ts";

const { sendMail, createTransport } = vi.hoisted(() => ({
  sendMail: vi.fn(),
  createTransport: vi.fn(),
}));
vi.mock("nodemailer", () => ({ default: { createTransport } }));

afterEach(() => vi.resetAllMocks());

function sender() {
  createTransport.mockReturnValue({ sendMail });
  sendMail.mockResolvedValue({
    accepted: ["student@example.com"],
    rejected: [],
    messageId: "message-123",
  });
  return createEmailSender({
    smtpUrl: "smtp://localhost:55325",
    from: { name: "Contour", address: "noreply@contour.local" },
  });
}

test.each([true, false])(
  "sends enrolment HTML and text for existing account: %s",
  async (hasAccount) => {
    const mailer = sender();
    await expect(
      mailer.sendEnrolmentEmail({
        email: "student+test@example.com",
        teacherName: "Alfie Jones",
        hasAccount,
        appUrl: "https://learn.example.com",
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
    expect(createTransport.mock.calls[0]![0]).toMatchObject({
      url: "smtp://localhost:55325",
      connectionTimeout: 5000,
    });
    expect(createTransport.mock.calls[0]![1]).toMatchObject({
      from: { name: "Contour", address: "noreply@contour.local" },
    });
  },
);

test.each([null, "  "])(
  "falls back to Your teacher for a missing name (%s)",
  async (teacherName) => {
    await sender().sendEnrolmentEmail({
      email: "student@example.com",
      teacherName,
      hasAccount: false,
      appUrl: "https://learn.example.com",
    });
    expect(sendMail.mock.calls[0]![0].html).toContain("Your teacher added you as a student.");
    expect(sendMail.mock.calls[0]![0].text).toContain("Your teacher added you as a student.");
  },
);

test("preserves SMTP failures for the enrolment flow to handle", async () => {
  const mailer = sender();
  const error = new Error("Connection refused");
  sendMail.mockRejectedValue(error);
  await expect(
    mailer.sendEnrolmentEmail({
      email: "student@example.com",
      teacherName: null,
      hasAccount: true,
      appUrl: "https://learn.example.com",
    }),
  ).rejects.toBe(error);
});

test("does not report success when the server rejects the recipient", async () => {
  const mailer = sender();
  sendMail.mockResolvedValue({ accepted: [], rejected: ["student@example.com"], messageId: "" });
  await expect(
    mailer.sendEnrolmentEmail({
      email: "student@example.com",
      teacherName: null,
      hasAccount: true,
      appUrl: "https://learn.example.com",
    }),
  ).rejects.toThrow("did not accept");
});
