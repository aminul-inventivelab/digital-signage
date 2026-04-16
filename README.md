# Digital Signage Monorepo

AbleSign-style digital signage: **Next.js web dashboard**, **Android TV player**, **Supabase** backend, shared **TypeScript** types.

## Layout

| Path | Description |
|------|-------------|
| `apps/web` | Next.js 14 (App Router), Tailwind, shadcn-style UI, Zustand, Supabase |
| `apps/android` | Kotlin, Jetpack Compose, Media3 ExoPlayer, Retrofit, Room |
| `packages/types` | Shared domain types |
| `packages/database` | SQL migrations + Supabase notes |

## Prerequisites

- [Node.js 20+](https://nodejs.org/)
- [pnpm 9+](https://pnpm.io/)
- [Supabase](https://supabase.com/) project (free tier is fine)
- Android Studio / JDK 17 for the TV app

## Quick start (Web)

```bash
cd digital-signage
pnpm install
cp apps/web/.env.example apps/web/.env.local
```

Apply migrations in the Supabase SQL editor (or CLI), then fill `apps/web/.env.local` with your project URL and anon key.

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Quick start (Android)

See `apps/android/README.md`. Use **Supabase Anonymous Auth** on the TV so Row Level Security and Realtime work without embedding a service role key.

## Pairing model (MVP)

1. TV app signs in **anonymously** and inserts a `devices` row with a random `pairing_code` and `registered_session_id = auth.uid()`.
2. On the web dashboard, the signed-in user runs **“Link device”** with that code; `owner_id` is set on the matching row.
3. TV keeps the same anonymous session; RLS allows the session to read its device and playlist assignments.

## Git commits

Use `type(scope): description`, e.g. `feat(devices): add device pairing flow`.

## Bangladesh / offline notes

- Media and playlists are designed for caching on the TV; prioritize resilient playback when bandwidth is variable.
- Payment hooks (bKash/Nagad/etc.) can be added later on the web app as separate modules without changing the core schema.
