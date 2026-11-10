# Mishkah <-> Furqan sync and cloud backup

Mishkah and Furqan can share progress through a private pairing code and back up each app's data to one email account. Pairing and account backup are separate: pairing does not create or recover an account.

## Configure the project

Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in the build environment. These are client configuration values; a Supabase service-role key must never be embedded in the app.

For the GitHub Pages deployment, add repository Actions secrets named `SUPABASE_URL` and `SUPABASE_ANON_KEY`. The deploy workflow maps them to the Expo build variables. Without these secrets, the deployed build remains local-only.

Enable GitHub Pages once in the repository: Settings -> Pages -> Build and deployment -> Source -> GitHub Actions. The deployment workflow cannot enable Pages itself; GitHub currently rejects that operation from the workflow token. After Pages and the secrets are configured, push or rerun the `Deploy web` workflow.

Apply these pairing migrations from the Furqan repository to the shared project, in order:

- `supabase/migrations/20261109130000_lixzon_pair_sync.sql`
- `supabase/migrations/20261109210200_lixzon_revoke_pair.sql`
- `supabase/migrations/20261110120000_lixzon_user_backups.sql`

The earlier `20261108150000_lixzon_sync_records.sql` migration belongs to the old authenticated-record sync path and is not required for pairing. If it is already installed, leave it in place; pairing uses its separate `lixzon_sync_pairs` and `lixzon_paired_sync_records` tables.

Enable Supabase Auth's Email provider. Set its email template to include the one-time token as `{{ .Token }}` (rather than requiring a magic-link redirect); both apps verify the code in-app, so no redirect URL is needed. The client only uses the publishable/anon key; never put a `service_role` key in either build.

Without these environment variables, migrations, and the Email provider, pairing and cloud backup remain unavailable and local data stays on the device.

## What Mishkah reads and writes

- Reads `furqan.progression` for Furqan's reading streak, latest reading position, and saved-verse references.
- Reads `furqan.memorized:<surah>:<ayah>` for memorization progress and shows the shared Quran library summary on Home.
- Reads `quran.daily-highlight:<date>` so the verse of the day matches Furqan exactly.
- Writes `mishkah.engagement` with its own streak and unlocked features when paired.

The daily verse, weekly surah spotlight, and daily Quran journey use matching UTC-based selections in both apps. Mishkah also links to Furqan's Friday Al-Kahf reading recommendation. The daily verse uses a UTC date key so the paired apps show the same verse even when devices are in different time zones. Furqan publishes the shared verse and Quran progress records, and both apps refresh paired data automatically.

The pairing code is stored in SecureStore on native and in AsyncStorage on web. **Disconnect this device** removes the code locally while other devices remain paired. **Revoke pairing everywhere** invalidates the code and deletes shared cloud records; each device keeps its local data and can pair again with a new code.

Any number of trusted app installations can use the same code. Each new code creates an isolated sync space, so different codes do not mix data. Treat each code like a password.

## Email cloud backup

Sign in from Settings using a one-time email code. Mishkah automatically backs up its preferences, prayer/checklist and dhikr progress, and reading streak. Furqan stores its own separate backup under the same email account, including Quran reading progress, bookmarks, memorized ayahs, likes, playlists, theme, and settings. Each app keeps its own backup row; signing in does not pair the apps.

When a cloud backup already exists on a new device, choose **Restore cloud backup to this device** or explicitly replace the cloud copy with the data on this device. After restoring or creating the first backup, saved changes are backed up automatically. Pairing codes, authentication tokens, and downloaded media are not included. Each backup is limited to 1 MB; use the existing file export/import for larger Furqan backups.

## In-app report

Mishkah keeps its last weekly system report on the device, showing storage, preferences, pairing, and today's verse. Open Settings -> Weekly system report to run a new one. Nothing in that report is uploaded.
