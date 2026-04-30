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
