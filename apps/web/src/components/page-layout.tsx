import type { ReactNode } from "react";
import { Card, CardAction, CardDescription, CardHeader, CardPanel, CardTitle } from "@lms/ui/card";
import { cn } from "@lms/ui/lib/utils";

type PageLayoutProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  variant?: "default" | "auth";
  className?: string;
};

export function PageLayout({
  title,
  description,
  actions,
  children,
  variant = "default",
  className,
}: PageLayoutProps) {
  if (variant === "auth") {
    return (
      <main className="flex min-h-svh w-full items-center justify-center px-4 py-12">
        <Card className={cn("w-full max-w-sm", className)}>
          <CardHeader>
            <CardTitle render={<h1 />}>{title}</CardTitle>
            {actions ? <CardAction>{actions}</CardAction> : null}
            {description ? <CardDescription>{description}</CardDescription> : null}
          </CardHeader>
          <CardPanel className="flex min-w-0 flex-col gap-4">{children}</CardPanel>
        </Card>
      </main>
    );
  }

  return (
    <div className="w-full min-w-full max-w-full">
      <div
        className={cn(
          "mx-auto flex w-full min-w-0 max-w-[1400px] flex-col gap-6 p-5 md:p-8 lg:p-10",
          className,
        )}
      >
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            {description ? (
              <div className="text-sm text-muted-foreground">{description}</div>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </header>
        <div className="flex min-w-0 flex-col gap-6">{children}</div>
      </div>
    </div>
  );
}
