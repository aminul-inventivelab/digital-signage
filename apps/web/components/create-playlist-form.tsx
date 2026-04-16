"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function CreatePlaylistForm({ ownerId }: { ownerId: string }) {
  const router = useRouter();
  const [name, setName] = useState("New playlist");
  const [creating, setCreating] = useState(false);

  async function createPlaylist() {
    setCreating(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("playlists")
        .insert({ owner_id: ownerId, name: name.trim() || "Untitled playlist" })
        .select("id")
        .single();
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Playlist created");
      router.push(`/playlists/${data.id}`);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create playlist";
      toast.error(message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 md:flex-row md:items-end">
      <div className="flex-1 space-y-2">
        <Label htmlFor="playlist-name">Name</Label>
        <Input id="playlist-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <Button type="button" onClick={() => void createPlaylist()} disabled={creating}>
        {creating ? "Creating…" : "Create playlist"}
      </Button>
    </div>
  );
}
