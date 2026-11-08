# Mishkah shared progress setup

Mishkah shares account-scoped progress with Furqan through Supabase. Use the same Supabase project and Google identity in both apps. The canonical schema, row-level security policies, Realtime publication, and Furqan setup steps are documented in the [Furqan Supabase setup guide](https://github.com/Lixzon/furqan-quran-app/blob/main/SUPABASE_SETUP.md).

Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in the build environment. These are client configuration values; a Supabase service-role key must never be embedded in the app. Apply the shared migration from the Furqan repository before enabling sync. Configure the Supabase Google provider to accept Mishkah's native Google client IDs and the same Google account users link in Furqan.

Without those external settings, Mishkah keeps using its existing local-first queue and does not claim that cross-device sync is active. The app uses Supabase Auth user sessions, SecureStore on native, and user-scoped RLS for shared records.

The shared record keys are `furqan.progression`, `furqan.memorized:<surah>:<ayah>`, `mishkah.engagement`, and `quran.daily-highlight:<date>`. Furqan and Mishkah must use the same project and Google identity for real-time progress sync.
