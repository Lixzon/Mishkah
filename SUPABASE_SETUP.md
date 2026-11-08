# Mishkah account sync setup

Mishkah uses Supabase for its own account-scoped sync. It does not import progress from or sync an account with Furqan.

Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in the build environment. These are client configuration values; a Supabase service-role key must never be embedded in the app. Apply the schema migration in the Furqan repository if you are using that schema. Configure the Supabase Google provider for Mishkah's native client IDs and the app's redirect URLs.

Without those external settings, Mishkah keeps using its local-first queue and does not claim that cloud sync is active. Supabase Auth sessions use SecureStore on native and user-scoped row-level security.

Mishkah stores its own engagement snapshot as `mishkah.engagement`. Furqan progress and Quran records are not read by Mishkah.
