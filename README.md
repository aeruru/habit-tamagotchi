# Habit Tamagotchi

A local-first habit tracker with an animated piglet, editable history, and optional Google Sheets sync. The v1 requirements live in [the design spec](design/habit-pet-design-spec.md).

## Run locally

Use Node.js 22 or later. There are no package dependencies.

```sh
npm start
npm test
```

Open [localhost:43183](http://localhost:43183). The local profile works immediately. Choose **History** to backfill, move, or remove an entry, and **Settings** to configure habits and pet effects.

## Enable Google Sheets

1. In Google Cloud, enable the Google Drive and Google Sheets APIs and configure the OAuth consent screen. Add test accounts if the app is in testing.
2. Create a Web application OAuth client. Add `http://localhost:43183` and any HTTPS hosting origin to its authorized JavaScript origins.
3. Put the public client ID in the `google-client-id` meta tag in `src/index.html`, or enter it in **Connect Google**. The app uses Google Identity Services in the browser and requires no client secret.
4. Connect your account. The spreadsheet link appears in the footer. Reconnect after a reload or when the token expires. Google profiles and the device-local profile have separate histories.

App operations are stored locally and synced to Google's private app-data folder. The spreadsheet is an export with app-managed **Habit records**, **Habit settings**, and **Pet settings** tabs. Place your own charts and analysis on a separate tab. App retries reuse record and operation IDs. The client serializes sync in a browser where Web Locks are available. Simultaneous first-time spreadsheet creation from separate devices can race. A later sync selects a single tagged spreadsheet consistently.

## Defaults

- Weeks start Monday. A sleep period closes at the end of the day after its intended night. Bedtime uses a noon-to-noon clock.
- Sleep goals default to 8 hours with an almost goal of 7. A closed night without a sleep-duration log falls below goal. A closed night without bedtime counts as almost.
- Hunger uses a 1–5 scale and defaults to logging only. Enabling a hunger goal counts check-ins independently of ratings.
- Walks award one randomly selected treat per achieved daily goal by default. Hunger can award treats per observation. History changes recalculate progress without playing rewards.
- Mood and hut have eight levels each. The scene uses original provisional Canvas artwork with a ramen preview and reusable placement anchors.
