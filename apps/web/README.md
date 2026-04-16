# Web Dashboard

Next.js 14 (App Router) console for managing TVs, playlists, and uploads.

## Setup

```bash
pnpm install
cp .env.example .env.local
```

Fill `.env.local` with your Supabase URL and anon key, then apply SQL migrations from `packages/database/migrations` in the Supabase SQL editor.

Enable **Anonymous sign-ins** (Authentication → Providers) so the Android TV app can register devices without a service role key.

## Develop

```bash
pnpm dev
```

## Stack notes

- Drag-and-drop uses [`@hello-pangea/dnd`](https://github.com/hello-pangea/dnd), the maintained fork compatible with React 18 (same API as `react-beautiful-dnd`).
- Sessions are handled with `@supabase/ssr` and `middleware.ts` so protected routes stay in sync with cookies.

## Deploy (Vercel)

Set the same `NEXT_PUBLIC_*` variables in the Vercel project settings and connect your Supabase project.
