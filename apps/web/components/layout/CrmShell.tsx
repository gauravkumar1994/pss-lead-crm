"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PageTitleContext } from "@/lib/page-title-context";

const PUBLIC_PATHS = new Set(["/login"]);

const TITLES: Record<string, string> = {
  "/dashboard": "Lead Dashboard",
  "/leads": "Leads",
  "/followups": "Follow-ups",
  "/pipeline": "Pipeline",
  "/quick-send": "Quick Send",
  "/bulk": "Bulk WhatsApp",
  "/campaigns": "Campaign History",
  "/templates": "Message Templates",
  "/reports": "Call Reports",
  "/settings": "WhatsApp API",
  "/users": "User Management",
};

function defaultTitle(pathname: string) {
  if (pathname.startsWith("/leads/") && pathname !== "/leads") return "Lead Details";
  return TITLES[pathname] ?? "PSS SOLUTION";
}

export function CrmShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [override, setOverride] = useState("");

  useEffect(() => {
    setOverride("");
  }, [pathname]);

  const title = useMemo(
    () => override || defaultTitle(pathname),
    [override, pathname]
  );

  if (PUBLIC_PATHS.has(pathname)) {
    return <>{children}</>;
  }

  return (
    <PageTitleContext.Provider value={setOverride}>
      <AppShell title={title}>{children}</AppShell>
    </PageTitleContext.Provider>
  );
}
