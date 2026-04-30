"use client";

import { useEffect, useState } from "react";

/**
 * Re-render on an interval so `effectiveDeviceStatus()` (uses `Date.now()` vs `last_seen`)
 * updates without clicking Sync or navigating away.
 */
export function useStaleOnlineTick(intervalMs = 8_000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), intervalMs);
    const onVisibility = () => {
      if (document.visibilityState === "visible") setTick((n) => n + 1);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);
}
