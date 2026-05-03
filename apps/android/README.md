# Android TV Player

Kotlin + Jetpack Compose TV primitives, **Media3 ExoPlayer** (disk cache + stall recovery), **Supabase** (anonymous auth, PostgREST, **Realtime** on `device_playlists` / `playlist_items`), and **DataStore** for device state.

HTTPS uses the **platform TLS stack** (system trust store) for Supabase, Coil, and ExoPlayer. If images or video fail while the API still works, check **system date/time**, OS updates for root CAs, and captive portals / TLS-inspecting networks.

## Configure

1. Copy `local.properties.example` → `local.properties` at this directory (`apps/android/`), **or** put the same keys in `local.properties` at the **repository root** (Gradle merges both; values in `apps/android/` override the root file).
2. Fill `sdk.dir`, `supabase.url`, and `supabase.anon.key` (same anon key as the web app). Replace every `YOUR_…` placeholder — leaving the template values produces a **missing config** error at launch instead of connecting.
3. In Supabase Dashboard → **Authentication → Providers**, enable **Anonymous sign-ins**.

## Run

Open this folder in Android Studio and run on an Android TV / emulator with a landscape display.

## Tests

- **Unit:** `./gradlew :app:testDebugUnitTest`
- **Instrumented (device/emulator):** `./gradlew :app:connectedDebugAndroidTest`

## Release builds

`release` has **R8 minification** enabled. After dependency upgrades, verify `./gradlew :app:assembleRelease` and smoke-test pairing + image + video on a real device.

## MVP behavior

- On first launch the app signs in **anonymously**, generates a **six-digit pairing code**, inserts a `devices` row (`registered_session_id` = anonymous user id), and shows the code full-screen.
- It polls the `devices` row until an admin links it from the web dashboard (`owner_id` set via `link_device_by_pairing_code`). **Realtime** nudges manifest refresh when assignments or playlist items change.
- Cached playback JSON allows a cold start with the last known slides when the network is down (best-effort).
- Use **Reset registration** during development to clear local pairing state.

## Pre-release QA (manual)

1. Pair a TV with the web dashboard; confirm **playback** (image + video) and **orientation** if you use it.
2. Edit the assigned playlist on the web; confirm the TV picks up changes (Realtime + poll).
3. Toggle **admin playback pause** if implemented; confirm standby vs slides.
4. **Airplane mode** or unplug Ethernet briefly; confirm recovery and cache behavior match expectations.

## Future work

- **Room** (or similar) for structured offline playlist metadata if you outgrow JSON cache + Exo disk cache alone.
