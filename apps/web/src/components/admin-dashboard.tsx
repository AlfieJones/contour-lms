"use client";

import type { Account } from "@lms/api";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@lms/ui/tabs";
import { PageLayout } from "#components/page-layout.tsx";
import { UserManagement } from "#components/user-management.tsx";
import { ConsultationDashboard } from "#components/consultation-dashboard.tsx";

export function AdminDashboard({ account }: { account: Account }) {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") === "consultations" ? "consultations" : "users";

  return (
    <PageLayout title="Admin">
      <Tabs
        value={tab}
        className="min-w-0 gap-6"
        onValueChange={(value) => {
          if ((value !== "users" && value !== "consultations") || value === tab) return;
          const url = new URL(window.location.href);
          url.searchParams.set("tab", value);
          window.history.pushState(null, "", url);
        }}
      >
        <TabsList aria-label="Admin sections" variant="underline">
          <TabsTab value="users">Users</TabsTab>
          <TabsTab value="consultations">Consultations</TabsTab>
        </TabsList>
        <TabsPanel value="users" keepMounted className="min-w-0 data-hidden:hidden">
          <UserManagement />
        </TabsPanel>
        <TabsPanel value="consultations" keepMounted className="min-w-0 data-hidden:hidden">
          <ConsultationDashboard account={account} allConsultations embedded />
        </TabsPanel>
      </Tabs>
    </PageLayout>
  );
}
