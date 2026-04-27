"use client";

import Link from "next/link";
import { useMemo } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useConsoleDataStore } from "@/stores/console-data-store";

export default function DashboardHomePage() {
  const storeDeviceCount = useConsoleDataStore((s) => s.devices.length);
  const ownerId = useConsoleDataStore((s) => s.ownerId);
  const playlistCount = useConsoleDataStore((s) => s.playlists.length);
  const mediaCount = useConsoleDataStore((s) => s.media.length);
  const ready = useMemo(() => ownerId != null, [ownerId]);

  if (!ready) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 max-w-full animate-pulse rounded-md bg-muted" />
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-muted/60" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Counts come from your local cache. Use <strong>Sync</strong> in the header for the latest from Supabase.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Devices</CardTitle>
            <CardDescription>Linked TV players</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <p className="text-3xl font-semibold tabular-nums">{storeDeviceCount}</p>
            <Link href="/devices" className={cn(buttonVariants({ size: "sm" }))}>
              Open
            </Link>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Playlists</CardTitle>
            <CardDescription>Sequences shown on screens</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <p className="text-3xl font-semibold tabular-nums">{playlistCount}</p>
            <Link href="/playlists" className={cn(buttonVariants({ size: "sm" }))}>
              Open
            </Link>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Media</CardTitle>
            <CardDescription>Images &amp; videos in storage</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <p className="text-3xl font-semibold tabular-nums">{mediaCount}</p>
            <Link href="/media" className={cn(buttonVariants({ size: "sm" }))}>
              Open
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
