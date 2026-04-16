import { getSupabaseServerClient } from "@/lib/supabase/server";
import { DevicesManager } from "@/components/devices-manager";
import type { Device } from "@signage/types";

export default async function DevicesPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const [{ data: devices }, { data: playlists }] = await Promise.all([
    supabase
      .from("devices")
      .select("*, device_playlists(playlist_id,is_active)")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("playlists").select("id,name").eq("owner_id", user.id).order("created_at", { ascending: false }),
  ]);

  return (
    <DevicesManager
      userId={user.id}
      initialDevices={
        (devices as Array<
          Device & {
            device_playlists: Array<{ playlist_id: string; is_active: boolean }> | null;
          }
        >) ?? []
      }
      playlists={(playlists as { id: string; name: string }[]) ?? []}
    />
  );
}
