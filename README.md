# Mishkah

Mishkah is a standalone, offline-first React Native application by LIXZON.
Its tagline is “The Seeker who carries the Light of Guidance across horizons.”
This phase is intentionally independent: no sibling-app bridge, donations, or
bank-payment code is included.

## Run and verify

```powershell
npm install
npm run typecheck
npm test
npx expo start
```

Use the Expo Go app or an iOS/Android development build to run the mobile app.
Flutter is not required. The city catalogue, prayer engine, checklists, guide
answers, and scheduled reminders work without a network connection.

## Architecture

- `src/domain/cities.ts` is a compact, tuple-based city/time-zone index. City
  objects and prayer calculations are hydrated only when needed. Five pins
  maximum are enforced by the same domain helper used by the interface.
- `src/domain/prayer.ts` computes solar noon, twilight, sunrise, sunset, and
  Asr from the selected city and its civil time zone. Supported conventions
  are MWL, ISNA, Egyptian, and Umm al-Qura. Unavailable high-latitude twilight
  events use a one-seventh night estimate. These are estimates; local mosque
  timetables may apply further adjustments.
- `src/services/preferences.ts` keeps city pins, display choices, checklists,
  and reminder settings in local app storage.
- `src/services/notifications.ts` schedules device-local suhoor and iftar
  notifications for the next 14 days. Opening the app refreshes the schedule.
  The operating system controls notification delivery and permissions.
- `src/services/diagnostics.ts` stores up to 20 exception records as
  AES-256-GCM ciphertext. The random encryption key is held in iOS Keychain or
  Android Keystore through SecureStore. No diagnostic data is uploaded or
  exported. The user health check reports status without showing log contents.
- `src/services/batteryGovernor.ts` suspends the foreground clock loop when
  the app leaves the foreground. Mishkah acquires no wake locks and registers
  no background audio listeners or services.
- `src/domain/assistant.ts` contains the offline FAQ and checklist answers.
  User questions are matched on-device; there is no remote AI service.

## Developer diagnostics key

Developer tools are locked unless `LIXZON_MASTER_KEY` is present in the local
build environment. The build config requires at least 32 bytes and places only
its SHA-256 digest in the application configuration. The key itself is never
written to source files or app storage.

In PowerShell, set a unique random value in the build shell before starting
Expo or creating a native build:

```powershell
$env:LIXZON_MASTER_KEY = '<unique random value of at least 32 bytes>'
npx expo start
```

Do not commit the key or use it as a server credential. A key check inside a
mobile application is a local access gate, not a security boundary against a
modified or compromised device. The diagnostic buffer is protected at rest
with a per-install encryption key in the platform secure store.

## Privacy and visual design

Mishkah uses no background photography or external image assets. Its
water-inspired palette and decorative details are geometric and symbolic.
Pinned places, schedules, reminders, checklist selections, guide questions,
and diagnostic data remain on the device. Instagram and Discord links open
only when the user taps them.
