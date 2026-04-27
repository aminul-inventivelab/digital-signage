"use client";

import { MediaLibrary } from "@/components/media-library";
import { useConsoleDataStore } from "@/stores/console-data-store";

const publicBaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

export default function MediaPage() {
  const ownerId = useConsoleDataStore((s) => s.ownerId);

  if (!publicBaseUrl) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Missing NEXT_PUBLIC_SUPABASE_URL. Copy `apps/web/.env.example` to `.env.local`.
      </div>
    );
  }

  if (!ownerId) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 animate-pulse rounded-md bg-muted" />
        <div className="h-56 animate-pulse rounded-xl bg-muted/60" />
      </div>
    );
  }

  return <MediaLibrary userId={ownerId} publicBaseUrl={publicBaseUrl} />;
}
