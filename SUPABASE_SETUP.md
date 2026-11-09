# Mishkah <-> Furqan pairing sync

Mishkah and Furqan share progress through one private pairing code. There is no account sign-in in either app.

## Configure the project

Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in the build environment. These are client configuration values; a Supabase service-role key must never be embedded in the app.

For the GitHub Pages deployment, add repository Actions secrets named `SUPABASE_URL` and `SUPABASE_ANON_KEY`. The deploy workflow maps them to the Expo build variables. Without these secrets, the deployed build remains local-only.

Enable GitHub Pages once in the repository: Settings -> Pages -> Build and deployment -> Source -> GitHub Actions. The deployment workflow cannot enable Pages itself; GitHub currently rejects that operation from the workflow token. After Pages and the secrets are configured, push or rerun the `Deploy web` workflow.

Apply these pairing migrations from the Furqan repository to the shared project, in order:

- `supabase/migrations/20261109130000_lixzon_pair_sync.sql`
- `supabase/migrations/20261109210200_lixzon_revoke_pair.sql`

The earlier `20261108150000_lixzon_sync_records.sql` migration belongs to the old authenticated-record sync path and is not required for pairing. If it is already installed, leave it in place; pairing uses its separate `lixzon_sync_pairs` and `lixzon_paired_sync_records` tables.

No Auth provider or redirect URL is required. Without these settings, Mishkah stays local-only and never claims that sync is active.

## What Mishkah reads and writes

- Reads `furqan.progression` for the reading streak shown in the header, profile, and streak sheet.
- Reads `quran.daily-highlight:<date>` so the verse of the day matches Furqan exactly.
- Writes `mishkah.engagement` with its own streak and unlocked features when paired.

The pairing code is stored in SecureStore on native and in AsyncStorage on web. **Disconnect this device** removes the code locally while other devices remain paired. **Revoke pairing everywhere** invalidates the code and deletes shared cloud records; each device keeps its local data and can pair again with a new code.

Any number of trusted app installations can use the same code. Each new code creates an isolated sync space, so different codes do not mix data. Treat each code like a password.

## In-app report

Mishkah keeps its last weekly system report on the device, showing storage, preferences, pairing, and today's verse. Open Settings -> Weekly system report to run a new one. Nothing in that report is uploaded.
