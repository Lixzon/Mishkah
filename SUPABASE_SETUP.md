# Furqan cloud backup setup

Furqan and Mishkah are independent apps. They do not sync Quran progress, daily verses, or app data with each other. Each app contains the same deterministic UTC Quran schedule locally: verses are selected without repeats in any 366-day period, and Friday selections come from Surah Al-Kahf. Daily Quran journey selections use the same date-based schedule in both apps. The verse schedule is duplicated in each app rather than fetched from or coordinated by the other.

The apps can link to one another, but opening the sibling app requires user confirmation. Mishkah loads verse text from the independent AlQuran Cloud API; this does not depend on Furqan or a Manara deployment.

## Configure Furqan backups

1. Configure a Supabase project for Furqan.
2. Apply the user-backup migration: `supabase/migrations/20261110120000_lixzon_user_backups.sql`.
3. Enable Supabase Auth's Email provider and configure the email template to include the one-time token as `{{ .Token }}`.
4. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. Set the same values in Furqan's hosting provider build environment if cloud backup is needed there.

Use only a Supabase publishable key (or legacy anon key) in the client. Never ship a `service_role` key. The backup table is protected by row-level security; each authenticated account can access only its own backup.

## Email cloud backup

Sign in from Furqan Settings using a one-time email code. Furqan stores its own backup, separate from Mishkah's backup. Restoring or replacing a backup requires confirmation. Automatic backup starts after the first backup or restore. Authentication tokens, audio downloads, and Quran text caches are not included. Cloud backups are limited to 1 MB; file export/import remains available for larger backups.

## Legacy pairing migrations

The `20261109130000_lixzon_pair_sync.sql` and `20261109210200_lixzon_revoke_pair.sql` migrations describe the retired app-pairing feature. Do not apply them to a new project. Existing deployments may still have the legacy pairing database objects, but these apps no longer read or write paired records. Removing old database objects and records requires a separate cleanup decision.
