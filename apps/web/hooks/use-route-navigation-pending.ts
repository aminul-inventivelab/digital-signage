"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Tracks an in-flight App Router client navigation so UI can show a loading state.
 * `pendingPath` is the destination pathname until the route finishes updating.
 */
export function useRouteNavigationPending() {
  const pathname = usePathname();
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  useEffect(() => {
    setPendingPath(null);
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      const el = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!el) return;
      if (el.target && el.target !== "_self") return;
      const hrefAttr = el.getAttribute("href");
      if (!hrefAttr || hrefAttr.startsWith("#")) return;
      try {
        const url = new URL(el.href, window.location.origin);
        if (url.origin !== window.location.origin) return;
        const nextPath = url.pathname;
        if (nextPath === pathname) return;
        setPendingPath(nextPath);
      } catch {
        /* ignore invalid URLs */
      }
    };

    const onPopState = () => {
      setPendingPath(window.location.pathname);
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [pathname]);

  return { pendingPath };
}
