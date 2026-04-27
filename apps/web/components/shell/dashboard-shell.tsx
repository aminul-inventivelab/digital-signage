"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConsoleSyncButton } from "@/components/console/console-sync-button";
import { ConsoleSyncProvider } from "@/components/console/console-sync-provider";
import { AppLayout } from "./app-layout";
import { DashboardRoutePrefetch } from "./dashboard-route-prefetch";
import { NotificationsProvider } from "./notifications-context";
import { SettingsProvider } from "./settings-context";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getPageTitle, layoutConfig } from "@/lib/config/layout";
import { clearConsoleCachePersist } from "@/stores/console-data-store";

function DashboardShellInner({
  children,
  userEmail,
  displayName,
}: {
  children: React.ReactNode;
  userEmail: string;
  displayName: string;
}) {
  const router = useRouter();
  const prefetchPaths = useMemo(() => layoutConfig.navItems.map((item) => item.path), []);

  async function signOut() {
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast.error(error.message);
        return;
      }
      clearConsoleCachePersist();
      router.replace("/login");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign out failed";
      toast.error(message);
    }
  }

  return (
    <AppLayout
      {...layoutConfig}
      getPageTitle={getPageTitle}
      userName={displayName}
      profileSubtext={userEmail}
      onSignOut={() => void signOut()}
      searchPlaceholder="Search..."
      topBarSyncControl={<ConsoleSyncButton />}
    >
      <DashboardRoutePrefetch paths={prefetchPaths} />
      {children}
    </AppLayout>
  );
}

export function DashboardShell({
  children,
  userId,
  userEmail,
  displayName,
}: {
  children: React.ReactNode;
  userId: string;
  userEmail: string;
  displayName: string;
}) {
  return (
    <SettingsProvider>
      <NotificationsProvider>
        <ConsoleSyncProvider userId={userId}>
          <DashboardShellInner userEmail={userEmail} displayName={displayName}>
            {children}
          </DashboardShellInner>
        </ConsoleSyncProvider>
      </NotificationsProvider>
    </SettingsProvider>
  );
}
