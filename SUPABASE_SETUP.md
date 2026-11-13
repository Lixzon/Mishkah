# Mishkah backup retirement

The Manāra web application is configured separately with
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; see
`../Furqan/SUPABASE_SETUP.md`. The Expo Mishkah source no longer has its own
email sign-in or `mishkah` cloud-backup flow; local preferences and progress
remain on-device, while Manāra owns the single combined backup.

Apply the Supabase migrations in timestamp order. The old pairing migrations
are no-ops; the final Manāra migration removes the retired sync database
objects. Existing `mishkah` backup rows are left untouched; this change does
not delete or overwrite remote user data.
