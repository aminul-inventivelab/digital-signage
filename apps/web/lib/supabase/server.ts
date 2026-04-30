import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConnectEnv } from "./env";

export function getSupabaseServerClient() {
  const cookieStore = cookies();
  const connect = getSupabaseConnectEnv();
  if (!connect) {
    throw new Error(
      "Missing Supabase env. Set SUPABASE_URL + SUPABASE_ANON_KEY (or NEXT_PUBLIC_*) in Vercel, then Redeploy (clear build cache if you added vars after the first build).",
    );
  }
  const { url, anonKey } = connect;

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options: CookieOptions }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component without mutable cookies; middleware keeps session fresh.
        }
      },
    },
  });
}
