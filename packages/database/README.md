# Database (Supabase / PostgreSQL)

SQL migrations in `migrations/` are **idempotent-friendly** ordered files. Apply them in filename order using:

- Supabase Dashboard → **SQL** → paste each file, or  
- [Supabase CLI](https://supabase.com/docs/guides/cli): `supabase db push` (when linked to a project)

## What the first migration creates

- **Tables**: `profiles`, `devices`, `media`, `playlists`, `playlist_items`, `device_playlists`
- **RLS**: owner-scoped access for the web dashboard; TV devices use **anonymous auth** (`registered_session_id = auth.uid()`)
- **Realtime**: tables added to `supabase_realtime` publication where live updates matter
- **Indexes**: common filters (`owner_id`, `device_id`, `playlist_id`, `pairing_code`)

## Storage

The migration documents the `media` bucket. In the Supabase Dashboard:

1. **Storage** → **New bucket** → name `media`, set **public** if you want direct CDN-style URLs, or private + signed URLs from the web app.
2. Policies in migration `00002_storage_media.sql` align uploads with `media.owner_id = auth.uid()`.

## TV authentication (important)

The Android app should call **Supabase Anonymous Sign-in** before inserting or subscribing to `devices`. That gives `auth.uid()` on the TV without a service role key, which satisfies RLS and enables Realtime.

## Environment variables (web)

See `apps/web/.env.example` for `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
