import { PageLayout } from "#components/page-layout.tsx";
import { AccountSettings } from "./account-settings";
import { requireAccount } from "#lib/account.server.ts";

export default async function SettingsPage() {
  const account = await requireAccount();
  return (
    <PageLayout title="Account">
      <AccountSettings account={account} />
    </PageLayout>
  );
}
