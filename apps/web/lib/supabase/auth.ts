import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "./server";

/**
 * Single Supabase client + session read per request (layout + page share via cache()).
 *
 * Uses getSession() (cookie/JWT locally) instead of getUser() (extra Auth HTTP round-trip).
 * PostgREST/RLS still validates the JWT on each query; middleware already gates routes.
 */
export const getServerAuth = cache(async (): Promise<{ supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>; user: User | null }> => {
  const supabase = await getSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return { supabase, user: session?.user ?? null };
});
