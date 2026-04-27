-- Removes in-file range columns; max on-screen is controlled by playlist_items.duration_seconds only.
alter table public.playlist_items
  drop column if exists clip_start_ms,
  drop column if exists clip_end_ms;

-- Idempotent: ensure TV RPC does not reference trim fields (see 00008 for definition).
create or replace function public.tv_get_playback_slides(p_device_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_reg uuid;
  v_playlist_id uuid;
  v_name text;
  v_slides jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', to_jsonb(false));
  end if;

  select d.registered_session_id
  into v_reg
  from public.devices d
  where d.id = p_device_id;

  if v_reg is null or v_reg is distinct from auth.uid() then
    return jsonb_build_object('ok', to_jsonb(false));
  end if;

  select dp.playlist_id
  into v_playlist_id
  from public.device_playlists dp
  where dp.device_id = p_device_id
    and dp.is_active = true
  order by dp.updated_at desc nulls last
  limit 1;

  if v_playlist_id is null then
    return jsonb_build_object(
      'ok', to_jsonb(true),
      'playlistName', to_jsonb(null::text),
      'slides', '[]'::jsonb
    );
  end if;

  select p.name into v_name
  from public.playlists p
  where p.id = v_playlist_id;

  select
      coalesce(
      jsonb_agg(
        jsonb_build_object(
          'fileType', m.file_type,
          'durationSeconds', pi.duration_seconds,
          'storagePath', m.storage_path
        )
        order by pi.sort_order asc, pi.id asc
      ),
      '[]'::jsonb
    )
  into v_slides
  from public.playlist_items pi
  join public.media m on m.id = pi.media_id
  where pi.playlist_id = v_playlist_id
    and m.storage_path is not null
    and length(trim(m.storage_path)) > 0;

  if v_slides is null then
    v_slides := '[]'::jsonb;
  end if;

  return jsonb_build_object(
    'ok', to_jsonb(true),
    'playlistName', to_jsonb(v_name),
    'slides', v_slides
  );
end;
$$;

revoke all on function public.tv_get_playback_slides(uuid) from public;
grant execute on function public.tv_get_playback_slides(uuid) to anon, authenticated;
