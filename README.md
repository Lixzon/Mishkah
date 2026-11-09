# Mishkah

Mishkah is a cross-platform, offline-first React Native application by LIXZON.
Its tagline is â€œThe Seeker who carries the Light of Guidance across horizons.â€
It remains independently deployable; optional cross-device data sync uses a
shared HTTPS service rather than direct access to a sibling app's local data.

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

### Web

Run the browser version locally with `npm run web`, or create and preview a
production web export with:

```powershell
npm run web:build
npm run web:serve
```

The public website is deployed from `main` to
https://lixzon.github.io/Mishkah/ by the GitHub Pages workflow. The web version
uses the same offline prayer calculations, guide, worship library, and saved preferences. Native
scheduled notifications and encrypted device diagnostics remain available only
in the iOS and Android apps.

For Vercel, import the Mishkah repository and deploy from its repository root.
The included `vercel.json` builds `dist` with `npm run web:build`; use the
deployment URL Vercel provides to open the app. A GitHub repository URL or a
source file URL displays project files, not the running app.

After the website is deployed over HTTPS, install it from the browser: in
Android Chrome, choose **Install app** from the browser menu; on iPhone, open
the site in Safari and choose **Add to Home Screen** from Share. The PWA caches
the app shell for offline launching after its first successful load. This
installs the website as a home-screen app; it is not an APK or App Store binary.

### Worship library

The **More** section groups Hadith, Tasbeeh, daily Adhkar, Duas, reciters, and
settings. The Hadith library includes 40 short teaching summaries attributed
to the Nawawi collection plus selected Sahih Bukhari/Muslim summaries. Those
summaries are not verbatim translations; references are shown with each entry.
The Bukhari/Muslim selection unlocks at a seven-day Mishkah practice streak.
Morning/evening remembrance and the Hisn al-Muslim Dua selection include Arabic,
transliteration, concise meanings, repetition counts, and references. The
Tasbeeh counter and custom Dhikr persist locally. Reciter audio is streamed and
requires a network connection; the reciter library unlocks at 21 days.

These are curated offline selections, not a complete scholarly edition of
Hisn al-Muslim or a substitute for checking religious rulings with a trusted
scholar. English wording is concise explanatory meaning, not a published
translation.

### Pairing with Furqan

Mishkah and Furqan share progress through one private 20-character pairing
code; there is no Google or email sign-in. Set `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_ANON_KEY` for the shared Supabase project, apply both
migrations listed in `SUPABASE_SETUP.md`, then create a code in Furqan
(Settings -> Pair Mishkah) and enter it in Mishkah (Settings -> Pair with
Furqan).

While paired, Mishkah shows Furqan's reading streak, the same verse of the
day, and opens Qur'an references in the full surah inside Furqan. The code is
stored in SecureStore on native devices and AsyncStorage on web. Unpairing
removes it from this device only.

Without those settings Mishkah stays local-only and does not claim that sync
is active. The weekly system report in Settings shows storage, preferences,
pairing, and today's verse, and stays on the device.

### Rafiq online answers

Rafiq always keeps the offline guide available. To enable current online answers,
set `EXPO_PUBLIC_RAFIQ_API_URL` to your secured HTTPS backend before building.
The app sends a question and locale to that endpoint; it does not contain AI or
search-provider credentials. The backend must return JSON shaped like
`{ "answer": "A concise response", "sources": [{ "title": "Source", "url": "https://example.org/article" }] }`.
Only HTTPS source links are displayed, with up to five citations. The backend
should retrieve current material, prioritize reputable primary sources, apply
rate limits and abuse protection, and avoid presenting religious rulings as
authoritative. Without this configuration, Rafiq continues to answer from the
offline library and clearly reports that online answers are unavailable.

Voice search is available in browsers that implement the Web Speech API and
requires microphone permission. Recognition and data handling depend on the
browser's speech service; native builds can use typed search.

Furqan's Rafiq service contract and the steps for enabling its online mode are
documented in [Furqan's Rafiq setup guide](https://github.com/Lixzon/furqan-quran-app/blob/main/RAFIQ_SETUP.md).

## Architecture

- `assets/brand-mark.svg` is the source for Mishkah's header, splash, app icon,
  favicon, and Android adaptive icon. `npm run icons` regenerates the PNG assets.
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
  `src/services/rafiq.ts` optionally calls a secured backend for current online
  answers and validates that its cited source links use HTTPS.

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
