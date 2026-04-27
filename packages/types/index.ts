/** Shared domain types for web + documentation parity with Supabase rows. */

export type DeviceStatus = "offline" | "online" | "pending_pairing";

export type MediaFileType = "image" | "video" | "unknown";

export interface Profile {
  id: string;
  full_name: string | null;
  created_at: string;
}

export interface Device {
  id: string;
  owner_id: string | null;
  registered_session_id: string | null;
  pairing_code: string;
  name: string;
  status: DeviceStatus;
  last_seen: string | null;
  created_at: string;
}

export interface Media {
  id: string;
  owner_id: string;
  storage_path: string;
  file_type: MediaFileType;
  original_filename: string | null;
  created_at: string;
}

export interface Playlist {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
}

export interface PlaylistItem {
  id: string;
  playlist_id: string;
  media_id: string;
  sort_order: number;
  /** Max on-screen time for this item (s). For video, null = play to natural end. */
  duration_seconds: number | null;
  display_from: string | null;
  display_until: string | null;
  created_at: string;
}

export interface DevicePlaylist {
  id: string;
  device_id: string;
  playlist_id: string;
  is_active: boolean;
  updated_at: string;
}

/** Payload used by the playlist editor (joins media metadata). */
export interface PlaylistItemWithMedia extends PlaylistItem {
  media: Pick<Media, "id" | "storage_path" | "file_type" | "original_filename">;
}
