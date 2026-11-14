import { Text } from "react-email";
import { EmailLayout } from "../components/email-layout.tsx";
import { EmailText } from "../components/email-text.tsx";

export function ReauthenticationEmail({ token = "{{ .Token }}" }: { token?: string }) {
  return (
    <EmailLayout title="Verify it's you">
      <EmailText>
        Enter this code to confirm your identity. Never share this code with anyone.
      </EmailText>
      <Text style={{ fontFamily: "monospace", fontSize: "28px", letterSpacing: "6px" }}>
        {token}
      </Text>
    </EmailLayout>
  );
}
