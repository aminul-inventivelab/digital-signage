"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Warm the App Router cache for main console routes as soon as the shell mounts. */
export function DashboardRoutePrefetch({ paths }: { paths: readonly string[] }) {
  const router = useRouter();

  useEffect(() => {
    for (const path of paths) {
      router.prefetch(path);
    }
  }, [router, paths]);

  return null;
}
