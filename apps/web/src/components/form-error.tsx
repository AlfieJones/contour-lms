import { Alert, AlertDescription } from "@lms/ui/alert";

export function FormError({ message }: { message: string }) {
  return message ? (
    <Alert variant="error">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  ) : null;
}
