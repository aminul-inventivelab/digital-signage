"use client";

import type { DeviceStatus, Playlist, PlaylistItemWithMedia } from "@signage/types";
import { ArrowRight, Image as ImageIcon, ListVideo, Monitor } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlaylistPreviewButton } from "@/components/playlist-preview";
import { getDeviceDisplayDimensionsPx } from "@/components/device-telemetry-panel";
import { useStaleOnlineTick } from "@/hooks/use-stale-online-tick";
import type { DeviceWithAssignments } from "@/lib/console-sync";
import { effectiveDeviceStatus, formatDeviceLastSeen } from "@/lib/device-status";
import { cn } from "@/lib/utils";
import { useConsoleDataStore } from "@/stores/console-data-store";

function activePlaylistRow(device: DeviceWithAssignments) {
  const rows = device.device_playlists;
  if (!rows?.length) return null;
  return rows.find((r) => r.is_active) ?? null;
}

function activePlaylistLabel(device: DeviceWithAssignments, playlists: Playlist[]): string {
  const active = activePlaylistRow(device);
  if (!active) return "—";
  const p = playlists.find((pl) => pl.id === active.playlist_id);
  return p?.name ?? `${active.playlist_id.slice(0, 8)}…`;
}

function activePlaylistId(device: DeviceWithAssignments): string | null {
  return activePlaylistRow(device)?.playlist_id ?? null;
}

function statusLabel(status: DeviceStatus): string {
  switch (status) {
    case "online":
      return "Online";
    case "offline":
      return "Offline";
    case "pending_pairing":
      return "Pending";
    default:
      return status;
  }
}

/** Status pill for the paired-devices table — online uses a live green indicator. */
function DeviceStatusChip({ status }: { status: DeviceStatus }) {
  const label = statusLabel(status);

  if (status === "online") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[0.8125rem] font-semibold tracking-tight",
          "border-emerald-500/25 bg-emerald-500/[0.09] text-emerald-950 shadow-sm",
          "dark:border-emerald-400/35 dark:bg-emerald-500/[0.14] dark:text-emerald-50 dark:shadow-[0_0_0_1px_rgba(16,185,129,0.12)_inset]",
        )}
      >
        <span className="relative flex h-2 w-2 shrink-0 items-center justify-center" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-35" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.9)] ring-2 ring-emerald-400/50 dark:bg-emerald-400 dark:shadow-[0_0_10px_rgba(52,211,153,0.95)] dark:ring-emerald-300/40" />
        </span>
        {label}
      </span>
    );
  }

  if (status === "offline") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-border bg-muted/70 px-2.5 py-1 text-[0.8125rem] font-semibold tracking-tight text-muted-foreground shadow-sm",
          "dark:bg-muted/40 dark:text-muted-foreground",
        )}
      >
        <span
          className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground/35 ring-2 ring-border/80 dark:bg-muted-foreground/40"
          aria-hidden
        />
        {label}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[0.8125rem] font-semibold tracking-tight shadow-sm",
        "border-amber-500/25 bg-amber-500/[0.1] text-amber-950 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-100",
      )}
    >
      <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500 shadow-sm ring-2 ring-amber-400/45 dark:bg-amber-400" aria-hidden />
      {label}
    </span>
  );
}

const publicBaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

/** Illustrative table rows (always appended after real paired devices); not persisted. */
const DUMMY_ACTIVE_ROWS = [
  {
    id: "__demo__lobby-east",
    name: "Lobby East (sample)",
    status: "offline" as const,
    playlistLabel: "Store promos",
    lastSeenLabel: "2d ago",
  },
  {
    id: "__demo__checkout-2",
    name: "Checkout line (sample)",
    status: "offline" as const,
    playlistLabel: "Weekend specials",
    lastSeenLabel: "Never",
  },
  {
    id: "__demo__window-3",
    name: "Window display (sample)",
    status: "offline" as const,
    playlistLabel: "Brand reel",
    lastSeenLabel: "6h ago",
  },
] as const;

function DashboardRowPlaylistPreview({
  device,
  activePlaylistId,
  playlistLabel,
  playlistItemsByPlaylistId,
  publicBaseUrl,
}: {
  device: DeviceWithAssignments | undefined;
  activePlaylistId: string;
  playlistLabel: string;
  playlistItemsByPlaylistId: Record<string, PlaylistItemWithMedia[]>;
  publicBaseUrl: string;
}) {
  const items = playlistItemsByPlaylistId[activePlaylistId] ?? [];
  const frame =
    device != null
      ? { kind: "device" as const, displayPx: getDeviceDisplayDimensionsPx(device) }
      : { kind: "playlist" as const };

  return (
    <PlaylistPreviewButton
      items={items}
      playlistName={playlistLabel}
      publicBaseUrl={publicBaseUrl}
      frame={frame}
      iconOnly
      className="rounded-lg border-2 border-primary/40 bg-primary/12 text-primary shadow-sm transition hover:bg-primary/18 hover:border-primary/55 focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}

export default function DashboardHomePage() {
  useStaleOnlineTick();

  const storeDeviceCount = useConsoleDataStore((s) => s.devices.length);
  const ownerId = useConsoleDataStore((s) => s.ownerId);
  const playlistCount = useConsoleDataStore((s) => s.playlists.length);
  const mediaCount = useConsoleDataStore((s) => s.media.length);
  const devices = useConsoleDataStore((s) => s.devices) as DeviceWithAssignments[];
  const playlists = useConsoleDataStore((s) => s.playlists) as Playlist[];
  const playlistItemsByPlaylistId = useConsoleDataStore((s) => s.playlistItemsByPlaylistId);

  const ready = useMemo(() => ownerId != null, [ownerId]);

  /** All screens linked to your account (sync cache), with live online/offline from `last_seen` where applicable. */
  const pairedDeviceRows = useMemo(() => {
    return devices.map((d) => ({
      id: d.id,
      name: d.name,
      status: effectiveDeviceStatus(d),
      playlistLabel: activePlaylistLabel(d, playlists),
      lastSeenLabel: formatDeviceLastSeen(d.last_seen),
      activePlaylistId: activePlaylistId(d),
      isDummy: false as const,
    }));
  }, [devices, playlists]);

  const tableRows = useMemo(() => {
    const real = pairedDeviceRows.map((r) => ({ ...r, isDummy: false as const }));
    const demo = DUMMY_ACTIVE_ROWS.map((r) => ({
      ...r,
      activePlaylistId: null as string | null,
      isDummy: true as const,
    }));
    return [...real, ...demo];
  }, [pairedDeviceRows]);

  if (!ready) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl bg-muted/60" />
          ))}
        </div>
        <div className="h-56 animate-pulse rounded-xl bg-muted/50" />
      </div>
    );
  }

  const stats = [
    {
      href: "/devices",
      label: "Devices",
      description: "Linked TV players & assignments",
      count: storeDeviceCount,
      icon: Monitor,
      accent: "from-brand-faint20 to-transparent",
    },
    {
      href: "/playlists",
      label: "Playlists",
      description: "Loops assigned to screens",
      count: playlistCount,
      icon: ListVideo,
      accent: "from-brand-faint25 to-transparent",
    },
    {
      href: "/media",
      label: "Media",
      description: "Library in storage",
      count: mediaCount,
      icon: ImageIcon,
      accent: "from-brand-soft to-transparent",
    },
  ] as const;

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(({ href, label, description, count, icon: Icon, accent }) => (
          <Card
            key={href}
            className="group relative overflow-hidden border-border/90 bg-card shadow-sm transition-shadow hover:shadow-md"
          >
            <div
              className={cn("pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b opacity-90", accent)}
              aria-hidden
            />
            <CardHeader className="relative space-y-2 pb-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <div className="shrink-0 rounded-lg bg-background/90 p-2 shadow-sm ring-1 ring-border/60 dark:bg-card/90">
                    <Icon className="h-4 w-4 text-brand-strong dark:text-brand-onDarkSoft" aria-hidden />
                  </div>
                  <CardTitle className="truncate text-base font-semibold leading-tight">{label}</CardTitle>
                </div>
                <Link
                  href={href}
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "h-8 shrink-0 gap-1 px-2 text-xs font-semibold text-muted-foreground opacity-80 transition group-hover:opacity-100",
                  )}
                >
                  Open
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
              <CardDescription className="text-xs leading-relaxed">{description}</CardDescription>
            </CardHeader>
            <CardContent className="relative pt-0">
              <p className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">{count}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Paired devices</h2>
          <p className="text-xs text-muted-foreground">
            All linked screens; status reflects reachability (offline when the player has not checked in recently).
            Sample rows are illustrative only.
          </p>
        </div>
        <div className="rounded-xl border border-border/90 bg-card shadow-sm">
          <div className="overflow-x-auto rounded-xl">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Device</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Active playlist</th>
                  <th className="px-4 py-3 font-semibold">Last seen</th>
                  <th className="px-4 py-3 font-semibold text-right">Screen</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-border/80 last:border-0 transition-colors",
                      row.isDummy ? "bg-muted/15" : "hover:bg-muted/30",
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate font-medium text-foreground">{row.name}</span>
                        {row.isDummy && (
                          <span className="text-[0.625rem] font-medium uppercase tracking-wider text-muted-foreground">
                            Sample
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <DeviceStatusChip status={row.status} />
                    </td>
                    <td className="min-w-0 px-4 py-3">
                      <div className="flex min-w-0 max-w-[20rem] items-center gap-2.5">
                        {row.isDummy ? (
                          <PlaylistPreviewButton
                            items={[]}
                            playlistName={row.playlistLabel}
                            publicBaseUrl={publicBaseUrl || ""}
                            iconOnly
                            className="rounded-lg border-2 border-dashed border-border bg-muted/30 text-muted-foreground shadow-sm"
                          />
                        ) : row.activePlaylistId && publicBaseUrl ? (
                          <DashboardRowPlaylistPreview
                            device={devices.find((d) => d.id === row.id)}
                            activePlaylistId={row.activePlaylistId}
                            playlistLabel={row.playlistLabel}
                            playlistItemsByPlaylistId={playlistItemsByPlaylistId}
                            publicBaseUrl={publicBaseUrl}
                          />
                        ) : row.activePlaylistId && !publicBaseUrl ? (
                          <span
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/40 text-muted-foreground"
                            title="Set NEXT_PUBLIC_SUPABASE_URL to preview media"
                          >
                            <ListVideo className="h-[1.125rem] w-[1.125rem]" strokeWidth={2.35} aria-hidden />
                          </span>
                        ) : (
                          <Link
                            prefetch
                            href={`/devices/${row.id}`}
                            className={cn(
                              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-border bg-muted/60 text-muted-foreground shadow-sm transition hover:border-primary/35 hover:bg-primary/8 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            )}
                            aria-label="No active playlist — open device to assign"
                            title="No active playlist — open device"
                          >
                            <ListVideo className="h-[1.125rem] w-[1.125rem]" strokeWidth={2.35} aria-hidden />
                          </Link>
                        )}
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">{row.playlistLabel}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">{row.lastSeenLabel}</td>
                    <td className="px-4 py-3 text-right">
                      {row.isDummy ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <Link
                          href={`/devices/${row.id}`}
                          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "inline-flex h-8 gap-1 px-2 text-xs")}
                        >
                          Screen
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
