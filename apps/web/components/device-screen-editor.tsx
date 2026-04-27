"use client";

import type { DropResult } from "@hello-pangea/dnd";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import type { DeviceStatus } from "@signage/types";
import type { Media, PlaylistItemWithMedia } from "@signage/types";
import { FileImage, FileVideo, Image as ImageIcon, Plus, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useConsoleSync } from "@/components/console/console-sync-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DeviceWithAssignments } from "@/lib/console-sync";
import { cn } from "@/lib/utils";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useConsoleDataStore } from "@/stores/console-data-store";

/** Stable fallback so Zustand selectors don’t return a new [] every run (avoids render loops). */
const EMPTY_PLAYLIST_ITEMS: PlaylistItemWithMedia[] = [];

function reorder<T>(list: T[], startIndex: number, endIndex: number): T[] {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  if (!removed) return list;
  result.splice(endIndex, 0, removed);
  return result;
}

function formatLastSeen(iso: string | null): string {
  if (!iso) return "Never seen";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 30) return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  if (day > 0) return day === 1 ? "Yesterday" : `${day} days ago`;
  if (hr > 0) return `${hr}h ago`;
  if (min > 0) return `${min}m ago`;
  return "Just now";
}

function statusLabel(status: DeviceStatus): string {
  switch (status) {
    case "online":
      return "Online";
    case "offline":
      return "Offline";
    case "pending_pairing":
      return "Pending pairing";
    default:
      return status;
  }
}

function ScreenStatusBadge({ status }: { status: DeviceStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        status === "online" && "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
        status === "offline" && "bg-muted text-muted-foreground",
        status === "pending_pairing" && "bg-amber-500/15 text-amber-900 dark:text-amber-200",
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

interface DeviceScreenEditorProps {
  deviceId: string;
  ownerId: string;
  publicBaseUrl: string;
}

export function DeviceScreenEditor({ deviceId, ownerId, publicBaseUrl }: DeviceScreenEditorProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const { syncNow } = useConsoleSync();

  const storeDevices = useConsoleDataStore((s) => s.devices) as DeviceWithAssignments[];
  const device = useMemo(
    () => storeDevices.find((d) => d.id === deviceId),
    [storeDevices, deviceId],
  );
  const playlists = useConsoleDataStore((s) => s.playlists);
  const allMedia = useConsoleDataStore((s) => s.media) as Media[];

  const activePlaylistId = useMemo(() => {
    return device?.device_playlists?.find((row) => row.is_active)?.playlist_id ?? "";
  }, [device]);

  const playlistId = activePlaylistId;
  const cachedItems = useConsoleDataStore((s) =>
    playlistId
      ? (s.playlistItemsByPlaylistId[playlistId] ?? EMPTY_PLAYLIST_ITEMS)
      : EMPTY_PLAYLIST_ITEMS,
  );
  const [items, setItems] = useState<PlaylistItemWithMedia[]>(cachedItems);
  const [libraryResetKey, setLibraryResetKey] = useState(0);
  const [librarySearch, setLibrarySearch] = useState("");
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    setItems(cachedItems);
  }, [cachedItems]);

  useEffect(() => {
    if (device) setDeviceName(device.name);
  }, [device]);

  const reloadFromServer = useCallback(async () => {
    await syncNow();
  }, [syncNow]);

  const saveDeviceName = useCallback(async () => {
    if (!device) return;
    const trimmed = deviceName.trim();
    if (!trimmed || trimmed === device.name) return;
    setSavingName(true);
    try {
      const { error } = await supabase.from("devices").update({ name: trimmed }).eq("id", device.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Screen name updated");
      await reloadFromServer();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save name";
      toast.error(message);
    } finally {
      setSavingName(false);
    }
  }, [device, deviceName, reloadFromServer, supabase]);

  const assignPlaylist = useCallback(
    async (nextPlaylistId: string) => {
      if (!device) return;
      const { error } = await supabase.from("device_playlists").upsert(
        {
          device_id: device.id,
          playlist_id: nextPlaylistId,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "device_id,playlist_id" },
      );
      if (error) {
        toast.error(error.message);
        return;
      }
      const { error: deactivateError } = await supabase
        .from("device_playlists")
        .update({ is_active: false })
        .eq("device_id", device.id)
        .neq("playlist_id", nextPlaylistId);
      if (deactivateError) {
        toast.error(deactivateError.message);
        return;
      }
      toast.success("Playlist assigned to this screen");
      await reloadFromServer();
    },
    [device, reloadFromServer, supabase],
  );

  const createPlaylistAndAssign = useCallback(async () => {
    if (!device) return;
    setCreatingPlaylist(true);
    try {
      const { data, error } = await supabase
        .from("playlists")
        .insert({ owner_id: ownerId, name: `${device.name} — screen` })
        .select("id")
        .single();
      if (error) {
        toast.error(error.message);
        return;
      }
      await assignPlaylist(data.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create playlist";
      toast.error(message);
    } finally {
      setCreatingPlaylist(false);
    }
  }, [assignPlaylist, device, ownerId, supabase]);

  const persistOrder = useCallback(
    async (next: PlaylistItemWithMedia[]) => {
      const updates = next.map((item, index) =>
        supabase.from("playlist_items").update({ sort_order: index }).eq("id", item.id),
      );
      const results = await Promise.all(updates);
      const failed = results.find((r) => r.error);
      if (failed?.error) {
        toast.error(failed.error.message);
        await reloadFromServer();
        return;
      }
      await reloadFromServer();
    },
    [reloadFromServer, supabase],
  );

  const removeItem = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("playlist_items").delete().eq("id", id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Removed from playlist");
      await reloadFromServer();
    },
    [reloadFromServer, supabase],
  );

  const updateDuration = useCallback(
    async (id: string, duration: number | null) => {
      const { error } = await supabase.from("playlist_items").update({ duration_seconds: duration }).eq("id", id);
      if (error) {
        toast.error(error.message);
        return;
      }
      await reloadFromServer();
    },
    [reloadFromServer, supabase],
  );

  const addMediaAtIndex = useCallback(
    async (mediaId: string, destIndex: number) => {
      if (!playlistId) return;
      const sortLen =
        useConsoleDataStore.getState().playlistItemsByPlaylistId[playlistId]?.length ?? 0;
      const { data: row, error } = await supabase
        .from("playlist_items")
        .insert({
          playlist_id: playlistId,
          media_id: mediaId,
          sort_order: sortLen,
          duration_seconds: 10,
        })
        .select("id")
        .single();
      if (error) {
        toast.error(error.message);
        return;
      }
      await reloadFromServer();
      const fresh = useConsoleDataStore.getState().playlistItemsByPlaylistId[playlistId] ?? [];
      const fromIndex = fresh.findIndex((i) => i.id === row.id);
      if (fromIndex < 0) return;
      if (fromIndex !== destIndex) {
        const reordered = reorder(fresh, fromIndex, destIndex);
        setItems(reordered);
        await persistOrder(reordered);
      } else {
        setItems(fresh);
      }
    },
    [persistOrder, playlistId, reloadFromServer, supabase],
  );

  const onDragEnd = useCallback(
    async (result: DropResult) => {
      const { destination, source, draggableId } = result;
      if (!destination) {
        if (draggableId.startsWith("media-")) setLibraryResetKey((k) => k + 1);
        return;
      }

      if (source.droppableId === "media-library" && destination.droppableId === "media-library") {
        setLibraryResetKey((k) => k + 1);
        return;
      }

      if (draggableId.startsWith("media-") && destination.droppableId === "screen-playlist") {
        const mediaId = draggableId.replace(/^media-/, "");
        if (!playlistId) {
          toast.error("Choose a playlist for this screen first.");
          return;
        }
        await addMediaAtIndex(mediaId, destination.index);
        return;
      }

      if (draggableId.startsWith("pi-") && destination.droppableId === "media-library") {
        const itemId = draggableId.replace(/^pi-/, "");
        await removeItem(itemId);
        setLibraryResetKey((k) => k + 1);
        return;
      }

      if (
        draggableId.startsWith("pi-") &&
        source.droppableId === "screen-playlist" &&
        destination.droppableId === "screen-playlist"
      ) {
        if (destination.index === source.index) return;
        const next = reorder(items, source.index, destination.index);
        setItems(next);
        await persistOrder(next);
      }
    },
    [addMediaAtIndex, items, persistOrder, playlistId, removeItem],
  );

  const filteredLibrary = useMemo(() => {
    const q = librarySearch.trim().toLowerCase();
    if (!q) return allMedia;
    return allMedia.filter((m) => (m.original_filename ?? m.storage_path).toLowerCase().includes(q));
  }, [allMedia, librarySearch]);

  const addMediaByClick = useCallback(
    (mediaId: string) => {
      if (!playlistId) {
        toast.error("Choose a playlist for this screen first.");
        return;
      }
      void addMediaAtIndex(mediaId, items.length);
    },
    [addMediaAtIndex, items.length, playlistId],
  );

  if (!device) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/devices" className="text-primary hover:underline">
            ← All screens
          </Link>
        </p>
        <div className="mt-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-semibold text-foreground">Screen settings</h2>
          <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
            <div className="relative h-24 w-36 shrink-0 overflow-hidden rounded-xl border border-border bg-gradient-to-br from-muted to-muted/40 shadow-inner">
              <div className="flex h-full w-full items-center justify-center">
                <ImageIcon className="h-10 w-10 text-muted-foreground/80" strokeWidth={1.25} />
              </div>
              <div className="absolute left-2 top-2">
                <ScreenStatusBadge status={device.status} />
              </div>
            </div>

            <div className="min-w-0 flex-1 space-y-4">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{device.name}</h1>
              <div className="space-y-2">
                <Label htmlFor="device-screen-name">Screen name</Label>
                <div className="flex max-w-lg flex-wrap gap-2">
                  <Input
                    id="device-screen-name"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    className="min-w-[12rem] flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void saveDeviceName();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={savingName || !deviceName.trim() || deviceName.trim() === device.name}
                    onClick={() => void saveDeviceName()}
                  >
                    {savingName ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Last seen · {formatLastSeen(device.last_seen)}</p>
              <p className="max-w-xl text-xs text-muted-foreground">
                The playlist below is what this screen plays when it syncs. Drag clips between columns, or add from the library. Changes save as you go.
              </p>
            </div>

            <div className="w-full shrink-0 space-y-2 border-t border-border pt-4 lg:w-72 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
              <Label htmlFor="screen-playlist" className="text-xs text-muted-foreground">
                Active playlist
              </Label>
              <select
                id="screen-playlist"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                value={activePlaylistId}
                onChange={(e) => {
                  const value = e.target.value;
                  if (!value) return;
                  void assignPlaylist(value);
                }}
              >
                <option value="">Select playlist…</option>
                {playlists.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full"
                disabled={creatingPlaylist}
                onClick={() => void createPlaylistAndAssign()}
              >
                {creatingPlaylist ? "Creating…" : "Create playlist for this screen"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {!playlistId ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
          <p className="text-sm font-medium text-foreground">Choose a playlist to edit content</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Select an existing playlist above, or create one dedicated to this screen.
          </p>
        </div>
      ) : (
        <DragDropContext onDragEnd={(r) => void onDragEnd(r)}>
          <div className="space-y-4">
            {items.length === 0 && (
              <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
                The TV will stay on a placeholder until this playlist has at least one item. Add media from the library
                (drag or <strong className="font-medium text-foreground">Add</strong>).
              </p>
            )}
            <div className="grid min-h-[420px] gap-4 lg:grid-cols-2 lg:gap-6">
            <section className="flex min-h-0 flex-col rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-4 py-3 sm:px-5">
                <h2 className="text-sm font-semibold text-foreground">Playlist on this screen</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Order is playback order. Drag to reorder or drop media here.</p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
                <Droppable droppableId="screen-playlist">
                  {(dropProvided) => (
                    <ul
                      ref={dropProvided.innerRef}
                      {...dropProvided.droppableProps}
                      className={cn(
                        "min-h-[200px] space-y-2 rounded-lg border border-dashed border-transparent p-2 transition-colors",
                        items.length === 0 && "border-border bg-muted/15",
                      )}
                    >
                      {items.length === 0 ? (
                        <li className="rounded-lg px-3 py-10 text-center text-sm text-muted-foreground">
                          Drag files from the library → or use <strong className="font-medium text-foreground">Add</strong> on each row.
                        </li>
                      ) : (
                        items.map((item, index) => (
                          <Draggable key={item.id} draggableId={`pi-${item.id}`} index={index}>
                            {(dragProvided, snapshot) => (
                              <li
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                className={cn(
                                  "flex flex-col gap-3 rounded-lg border border-border bg-background p-3 shadow-sm sm:flex-row sm:items-center",
                                  snapshot.isDragging && "shadow-md ring-2 ring-primary/20",
                                )}
                              >
                                <PlaylistItemThumb item={item} publicBaseUrl={publicBaseUrl} />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">
                                    {item.media.original_filename ?? item.media.storage_path}
                                  </p>
                                  <p className="text-xs capitalize text-muted-foreground">{item.media.file_type}</p>
                                </div>
                                <div className="flex w-full min-w-0 flex-col items-stretch gap-2 sm:max-w-md sm:items-end">
                                  <div className="flex flex-wrap items-end gap-2 sm:justify-end">
                                    <div className="space-y-0.5">
                                      <Label className="text-[0.625rem] text-muted-foreground" htmlFor={`dur-${item.id}`}>
                                        {item.media.file_type === "video" ? "Max (s)" : "Seconds"}
                                      </Label>
                                      <Input
                                        id={`dur-${item.id}`}
                                        type="number"
                                        min={1}
                                        className="h-8 w-20 text-xs"
                                        key={`d-${item.id}-${item.duration_seconds}`}
                                        defaultValue={item.duration_seconds ?? 10}
                                        onBlur={(e) => {
                                          const raw = e.target.value.trim();
                                          if (raw === "" && item.media.file_type === "video") {
                                            void updateDuration(item.id, null);
                                            return;
                                          }
                                          const value = Number(e.target.value);
                                          const nextValue = Number.isFinite(value) && value > 0 ? value : null;
                                          void updateDuration(item.id, nextValue);
                                        }}
                                      />
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive"
                                      onClick={() => void removeItem(item.id)}
                                    >
                                      Remove
                                    </Button>
                                  </div>
                                </div>
                              </li>
                            )}
                          </Draggable>
                        ))
                      )}
                      {dropProvided.placeholder}
                    </ul>
                  )}
                </Droppable>
              </div>
            </section>

            <section className="flex min-h-0 flex-col rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-4 py-3 sm:px-5">
                <h2 className="text-sm font-semibold text-foreground">Content library</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Your uploaded media. Drag into the playlist or tap Add.</p>
                <div className="relative mt-3">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={librarySearch}
                    onChange={(e) => setLibrarySearch(e.target.value)}
                    placeholder="Search media…"
                    className="h-9 border-border bg-background pl-8 text-sm"
                    aria-label="Search media library"
                  />
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
                <Droppable droppableId="media-library" key={libraryResetKey}>
                  {(libProvided) => (
                    <ul ref={libProvided.innerRef} {...libProvided.droppableProps} className="space-y-2">
                      {filteredLibrary.length === 0 ? (
                        <li className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
                          No media matches. Upload files on the Media page.
                        </li>
                      ) : (
                        filteredLibrary.map((m, index) => (
                          <Draggable key={m.id} draggableId={`media-${m.id}`} index={index}>
                            {(dragProvided, snapshot) => (
                              <li
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                className={cn(
                                  "flex items-center gap-3 rounded-lg border border-border bg-background p-2 pr-3 shadow-sm",
                                  snapshot.isDragging && "opacity-90 shadow-md ring-2 ring-primary/25",
                                )}
                              >
                                <LibraryThumb media={m} publicBaseUrl={publicBaseUrl} />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">{m.original_filename ?? m.storage_path}</p>
                                  <p className="text-xs capitalize text-muted-foreground">{m.file_type}</p>
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  className="shrink-0 gap-1"
                                  onClick={() => addMediaByClick(m.id)}
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  Add
                                </Button>
                              </li>
                            )}
                          </Draggable>
                        ))
                      )}
                      {libProvided.placeholder}
                    </ul>
                  )}
                </Droppable>
              </div>
            </section>
            </div>
          </div>
        </DragDropContext>
      )}
    </div>
  );
}

function mediaUrl(publicBaseUrl: string, storagePath: string) {
  return `${publicBaseUrl}/storage/v1/object/public/media/${storagePath}`;
}

function LibraryThumb({ media, publicBaseUrl }: { media: Media; publicBaseUrl: string }) {
  const url = mediaUrl(publicBaseUrl, media.storage_path);
  return (
    <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
      {media.file_type === "image" ? (
        <Image src={url} alt="" fill className="object-cover" sizes="64px" />
      ) : media.file_type === "video" ? (
        <video className="h-full w-full object-cover" src={url} muted playsInline preload="metadata" />
      ) : (
        <div className="flex h-full items-center justify-center">
          <FileImage className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

function PlaylistItemThumb({ item, publicBaseUrl }: { item: PlaylistItemWithMedia; publicBaseUrl: string }) {
  const url = mediaUrl(publicBaseUrl, item.media.storage_path);
  return (
    <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
      {item.media.file_type === "image" ? (
        <Image src={url} alt="" fill className="object-cover" sizes="80px" />
      ) : item.media.file_type === "video" ? (
        <video className="h-full w-full object-cover" src={url} muted playsInline preload="metadata" />
      ) : (
        <div className="flex h-full items-center justify-center">
          <FileImage className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <div className="absolute bottom-1 right-1 rounded bg-background/90 px-1 py-0.5 text-[0.625rem] font-medium text-foreground shadow-sm ring-1 ring-border">
        {item.media.file_type === "video" ? (
          <FileVideo className="h-3 w-3" />
        ) : (
          <ImageIcon className="h-3 w-3" />
        )}
      </div>
    </div>
  );
}
