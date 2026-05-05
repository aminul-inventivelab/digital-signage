"use client";

import type { Device, DeviceScreenOrientation } from "@signage/types";
import { Settings2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { useConsoleSync } from "@/components/console/console-sync-provider";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function normalizeOrientation(v: string | undefined): DeviceScreenOrientation {
  return v === "portrait" ? "portrait" : "landscape";
}

export function DeviceScreenOrientationSettings({ device }: { device: Device }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const { syncNow } = useConsoleSync();
  const supabase = getSupabaseBrowserClient();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function save(next: DeviceScreenOrientation) {
    setSaving(true);
    try {
      const { error } = await supabase.from("devices").update({ screen_orientation: next }).eq("id", device.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(next === "portrait" ? "Orientation set to portrait" : "Orientation set to landscape");
      await syncNow();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save orientation");
    } finally {
      setSaving(false);
    }
  }

  const current = normalizeOrientation(device.screen_orientation);

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={() => setOpen(true)}>
        <Settings2 className="h-4 w-4" strokeWidth={2} aria-hidden />
        Screen settings
      </Button>
      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-black/50" aria-label="Dismiss" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-lg"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border bg-muted/30 px-5 py-4">
              <h2 id={titleId} className="text-lg font-semibold text-foreground">
                Screen orientation
              </h2>
              <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <p className="text-sm text-muted-foreground">
                Choose how this TV locks orientation during playback. The device applies the change within a few seconds after you save.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant={current === "landscape" ? "default" : "outline"}
                  className={current === "landscape" ? "bg-primary text-primary-foreground hover:bg-brand-hover" : undefined}
                  disabled={saving}
                  onClick={() => void save("landscape")}
                >
                  Landscape
                </Button>
                <Button
                  type="button"
                  variant={current === "portrait" ? "default" : "outline"}
                  className={current === "portrait" ? "bg-primary text-primary-foreground hover:bg-brand-hover" : undefined}
                  disabled={saving}
                  onClick={() => void save("portrait")}
                >
                  Portrait
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Current on device: <span className="font-medium text-foreground">{current === "portrait" ? "Portrait" : "Landscape"}</span>
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
