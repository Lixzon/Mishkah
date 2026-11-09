# Mishkah <-> Furqan pairing sync

Mishkah and Furqan share progress through one private pairing code. There is no account sign-in in either app.

## Configure the project

Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in the build environment. These are client configuration values; a Supabase service-role key must never be embedded in the app.

Apply both migrations from the Furqan repository to the same project:

- `supabase/migrations/20261108150000_lixzon_sync_records.sql`
- `supabase/migrations/20261109130000_lixzon_pair_sync.sql`

No Auth provider or redirect URL is required. Without these settings, Mishkah stays local-only and never claims that sync is active.

## What Mishkah reads and writes

- Reads `furqan.progression` for the reading streak shown in the header, profile, and streak sheet.
- Reads `quran.daily-highlight:<date>` so the verse of the day matches Furqan exactly.
- Writes `mishkah.engagement` with its own streak and unlocked features when paired.

The pairing code is stored in SecureStore on native and in AsyncStorage on web. Unpairing removes it from that device only.

## In-app report

Mishkah keeps its last weekly system report on the device, showing storage, preferences, pairing, and today's verse. Open Settings -> Weekly system report to run a new one. Nothing in that report is uploaded.
