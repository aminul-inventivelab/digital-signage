"use client";

import type { Device, DeviceTelemetry } from "@signage/types";
import { Info } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatRelativeShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 7) return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (day > 0) return day === 1 ? "Yesterday" : `${day}d ago`;
  if (hr > 0) return `${hr}h ago`;
  if (min > 0) return `${min}m ago`;
  return "Just now";
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function TelemetryValue({ value, depth }: { value: unknown; depth: number }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return <span className="font-mono text-xs break-all">{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    return (
      <pre className="mt-1 max-h-40 overflow-auto rounded-md border border-border bg-muted/40 p-2 font-mono text-[0.65rem] leading-relaxed text-foreground">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  if (isPlainObject(value) && depth < 3) {
    return (
      <ul className="mt-1 space-y-1 border-l border-border pl-3">
        {Object.entries(value).map(([k, v]) => (
          <li key={k} className="text-xs">
            <span className="text-muted-foreground">{k}</span>
            <span className="mx-1.5 text-muted-foreground/60">·</span>
            <TelemetryValue value={v} depth={depth + 1} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <pre className="mt-1 max-h-40 overflow-auto rounded-md border border-border bg-muted/40 p-2 font-mono text-[0.65rem] leading-relaxed text-foreground">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function hasTelemetryData(t: DeviceTelemetry | null | undefined): boolean {
  if (t == null) return false;
  return Object.keys(t).length > 0;
}

function formatFieldLabel(key: string): string {
  return key
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function TelemetryEmptyState({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "border border-dashed p-3 text-sm text-muted-foreground sm:p-4",
        "rounded-lg border-border/70 bg-muted/15",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} />
        <p className="text-xs leading-relaxed sm:text-sm">
          When the screen app is running, it will report device details (app version, network, display, etc.) to this page.
          Open the app on the TV and wait a few minutes, or use <strong className="text-foreground">Sync</strong> in the
          console.
        </p>
      </div>
    </div>
  );
}

function TelemetryFieldsTable({ device }: { device: Device }) {
  const t = device.telemetry;
  const at = device.telemetry_at;
  if (!t || !hasTelemetryData(t)) return null;

  return (
    <>
      <p className="mb-3 text-xs text-muted-foreground">Last update from the screen: {formatWhen(at)}</p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[min(100%,480px)] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold text-muted-foreground">
                Field
              </th>
              <th scope="col" className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(t).map(([key, value]) => (
              <tr key={key} className="border-b border-border last:border-b-0">
                <td
                  className={cn(
                    "align-top px-3 py-2.5 text-xs font-medium text-muted-foreground",
                    "w-[28%] min-w-[7rem] max-w-[12rem] whitespace-nowrap sm:w-36",
                  )}
                >
                  {formatFieldLabel(key)}
                </td>
                <td className="align-top px-3 py-2.5 text-foreground min-w-0">
                  <div className="min-w-0 [&>pre]:mt-0 [&>ul]:mt-0">
                    <TelemetryValue value={value} depth={0} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function DeviceTelemetryDialogBody({ device }: { device: Device }) {
  const t = device.telemetry;
  const at = device.telemetry_at;
  if (!hasTelemetryData(t)) {
    return <TelemetryEmptyState />;
  }
  const summaryLine = deviceTelemetrySummaryLine(device);
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {summaryLine ? (
          <>
            <span className="text-foreground/90">{summaryLine}</span>
            <span className="text-muted-foreground/80"> · </span>
          </>
        ) : null}
        Updated {formatRelativeShort(at)}
      </p>
      <TelemetryFieldsTable device={device} />
    </div>
  );
}

/** Opens full telemetry (table + summary) in a modal — used on the screen detail layout instead of an inline card. */
export function DeviceTelemetryMoreButton({ device }: { device: Device }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setOpen(true)}>
        More Device Info
      </Button>
      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Dismiss"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-10 flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border bg-muted/30 px-5 py-4">
              <h2 id={titleId} className="text-lg font-semibold text-foreground">
                Device information
              </h2>
              <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <DeviceTelemetryDialogBody device={device} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function deviceTelemetrySummaryLine(device: Device): string | null {
  const t = device.telemetry;
  if (!t || typeof t !== "object") return null;
  const hw = t.hardware;
  const app = t.app;
  const model = hw && typeof hw === "object" && "model" in hw ? String((hw as { model?: string }).model ?? "") : "";
  const ver =
    app && typeof app === "object" && "version_name" in app
      ? String((app as { version_name?: string }).version_name ?? "")
      : "";
  const parts = [model, ver].filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join(" · ");
}

function telemetryString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

/** Pixel size reported by the TV app (`telemetry.display`), when present. */
export function getDeviceDisplayDimensionsPx(device: Device): {
  widthPx: number;
  heightPx: number;
} | null {
  const t = device.telemetry;
  if (!t || typeof t !== "object") return null;
  const disp = t.display;
  if (!disp || typeof disp !== "object") return null;
  const d = disp as Record<string, unknown>;
  const w = typeof d.width_px === "number" ? d.width_px : Number(d.width_px);
  const heightPx = typeof d.height_px === "number" ? d.height_px : Number(d.height_px);
  if (!Number.isFinite(w) || !Number.isFinite(heightPx) || w <= 0 || heightPx <= 0) return null;
  return { widthPx: Math.round(w), heightPx: Math.round(heightPx) };
}

/** Hardware/display facts from TV telemetry (`DeviceTelemetryCollector` on Android). */
export function deviceScreenBasics(device: Device): {
  brand: string | null;
  model: string | null;
  screenSize: string | null;
} {
  const out = { brand: null as string | null, model: null as string | null, screenSize: null as string | null };
  const t = device.telemetry;
  if (!t || typeof t !== "object") return out;

  const hw = t.hardware;
  if (hw && typeof hw === "object") {
    const h = hw as Record<string, unknown>;
    const brand = telemetryString(h.brand);
    const manufacturer = telemetryString(h.manufacturer);
    out.brand = brand ?? manufacturer ?? null;
    out.model = telemetryString(h.model);
  }

  const disp = t.display;
  if (disp && typeof disp === "object") {
    const d = disp as Record<string, unknown>;
    const w = typeof d.width_px === "number" ? d.width_px : Number(d.width_px);
    const heightPx = typeof d.height_px === "number" ? d.height_px : Number(d.height_px);
    if (Number.isFinite(w) && Number.isFinite(heightPx) && w > 0 && heightPx > 0) {
      let line = `${Math.round(w)} × ${Math.round(heightPx)} px`;
      const wdp = typeof d.screen_width_dp === "number" ? d.screen_width_dp : Number(d.screen_width_dp);
      const hdp = typeof d.screen_height_dp === "number" ? d.screen_height_dp : Number(d.screen_height_dp);
      if (Number.isFinite(wdp) && Number.isFinite(hdp)) {
        line += ` · ${Math.round(wdp)} × ${Math.round(hdp)} dp`;
      }
      out.screenSize = line;
    }
  }

  return out;
}
