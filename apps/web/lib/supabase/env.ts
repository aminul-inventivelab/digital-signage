function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  for (const v of values) {
    if (v != null && v.trim() !== "") return v.trim();
  }
  return undefined;
}

/**
 * URL + anon key for Supabase in Node, Route Handlers, and Middleware.
 *
 * Prefer `SUPABASE_*` (set in Vercel, read at runtime) so a deploy is not stuck with
 * empty inlined `NEXT_PUBLIC_*` from a build that ran before env was added.
 * Falls back to `NEXT_PUBLIC_*` for local dev and normal inlining.
 */
export function getSupabaseConnectEnv(): { url: string; anonKey: string } | null {
  const url = firstNonEmpty(
    process.env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  const anonKey = firstNonEmpty(
    process.env.SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  if (!url || !anonKey) return null;
  return { url, anonKey };
}
