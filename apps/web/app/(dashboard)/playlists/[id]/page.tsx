import { notFound } from "next/navigation";
import { PlaylistEditor } from "@/components/playlist-editor";
import { getSupabaseServerClient } from "@/lib/supabase/server";

interface PlaylistPageProps {
  params: { id: string };
}

export default async function PlaylistDetailPage({ params }: PlaylistPageProps) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("playlists")
    .select("id,name")
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  return <PlaylistEditor playlistId={data.id} ownerId={user.id} initialName={data.name} />;
}
