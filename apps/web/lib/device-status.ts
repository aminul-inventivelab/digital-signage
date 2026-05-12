import type { Device, DeviceStatus } from "@signage/types";

/**
 * Max age of `last_seen` while we still show Online (~4s manifest polls while running).
 * Keep in sync with `mark_stale_devices_offline` in migrations (00013 + 00014).
 */
export const STALE_ONLINE_MS = 45_000;

/**
 * DB `status` stays `online` until `mark_stale_devices_offline` runs (e.g. on sync).
 * Treat stale `last_seen` as offline so the badge matches reality between syncs.
 */
export function effectiveDeviceStatus(device: Pick<Device, "status" | "last_seen">): DeviceStatus {
  if (device.status === "pending_pairing") return "pending_pairing";
  if (device.status !== "online") return device.status;
  if (device.last_seen == null) return "offline";
  const ageMs = Date.now() - new Date(device.last_seen).getTime();
  if (!Number.isFinite(ageMs) || ageMs > STALE_ONLINE_MS) return "offline";
  return "online";
}

/**
 * Human-readable `last_seen` age. Uses the same freshness window as [effectiveDeviceStatus]
 * ("Just now" only while `last_seen` is within [STALE_ONLINE_MS]) so the label never implies
 * liveness when the badge would show offline for staleness.
 */
export function formatDeviceLastSeen(iso: string | null): string {
  if (!iso) return "Never seen";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  if (!Number.isFinite(diffMs)) return "Never seen";
  const sec = Math.floor(diffMs / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 30) return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  if (day > 0) return day === 1 ? "Yesterday" : `${day} days ago`;
  if (hr > 0) return `${hr}h ago`;
  if (min > 0) return `${min}m ago`;
  if (diffMs > STALE_ONLINE_MS) return `${sec}s ago`;
  return "Just now";
}
