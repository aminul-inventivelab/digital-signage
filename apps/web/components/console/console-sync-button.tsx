"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { assets } from "@/lib/config/assets";
import { useConsoleDataStore } from "@/stores/console-data-store";
import { useConsoleSync } from "./console-sync-provider";

function formatSynced(ts: number | null) {
  if (ts == null) return "—";
  return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function ConsoleSyncButton() {
  const { syncNow, lastSyncedAt, isSyncing, syncError, cacheReady } = useConsoleSync();

  const handleClick = useCallback(() => {
    void (async () => {
      await syncNow();
      const err = useConsoleDataStore.getState().syncError;
      if (err) toast.error(err);
      else toast.success("Synced with server");
    })();
  }, [syncNow]);

  const hoverTitle = useMemo(() => {
    if (syncError) {
      return `Sync failed: ${syncError}`;
    }
    return `Last updated ${formatSynced(lastSyncedAt)}. Click to pull from Supabase now. A background sync also runs on a timer.`;
  }, [lastSyncedAt, syncError]);

  const ariaLabel = useMemo(() => {
    if (syncError) return `Sync with server. Error: ${syncError}`;
    return `Sync with server. Last updated ${formatSynced(lastSyncedAt)}.`;
  }, [lastSyncedAt, syncError]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!cacheReady || isSyncing}
      title={hoverTitle}
      aria-label={ariaLabel}
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-[#E8ECF0] bg-white px-2.5 text-xs font-semibold text-[#374151] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <RefreshCw
        className={isSyncing ? "animate-spin" : ""}
        size={14}
        color={assets.themePrimary}
        strokeWidth={2}
        aria-hidden
      />
      {isSyncing ? "Syncing…" : "Sync"}
    </button>
  );
}
