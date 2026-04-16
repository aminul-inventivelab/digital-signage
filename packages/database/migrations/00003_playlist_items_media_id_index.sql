-- Supabase performance advisor: index FK column media_id
create index if not exists playlist_items_media_id_idx on public.playlist_items (media_id);
