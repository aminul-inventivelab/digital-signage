-- Tighten stale window (playback polls every ~4s while TV runs; 45s ≈ missed heartbeats).
create or replace function public.mark_stale_devices_offline()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if auth.uid() is null then
    return 0;
  end if;

  update public.devices d
  set status = 'offline'
  where d.owner_id = auth.uid()
    and d.status = 'online'
    and (
      d.last_seen is null
      or d.last_seen < now() - interval '45 seconds'
    );

  get diagnostics n = row_count;
  return coalesce(n, 0);
end;
$$;

revoke all on function public.mark_stale_devices_offline() from public;
grant execute on function public.mark_stale_devices_offline() to authenticated;
