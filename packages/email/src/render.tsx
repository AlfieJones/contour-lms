import type { ReactElement } from "react";
import { render, toPlainText } from "react-email";
import { EnrolmentEmail, type EnrolmentEmailProps } from "./templates/enrolment.tsx";

export async function renderEmail(element: ReactElement) {
  const html = await render(element);
  return { html, text: toPlainText(html) };
}

export async function renderEnrolmentEmail(input: EnrolmentEmailProps) {
  return {
    subject: "You've been enrolled · Contour",
    ...(await renderEmail(<EnrolmentEmail {...input} />)),
  };
}
