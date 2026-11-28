# Habit Tamagotchi

A local-first habit tracker with an animated piglet, editable history, and optional Google Sheets sync. The v1 requirements live in [the design spec](design/habit-pet-design-spec.md).

## Run locally

Use Node.js 22 or later. There are no package dependencies.

```sh
npm start
npm test
```

Open [localhost:43183](http://localhost:43183) and connect Google to see and log check-ins. To try the app with sample entries, choose **Load test data** in the footer. Edits in test mode are temporary and never sync. Use **History** to edit or remove a check-in, **Trends** to view charts or backfill, and **Settings** to configure habits and pet effects.

Under **Settings → Habits**, edit a starter habit or add your own. Every habit has a name, emoji, daily or weekly goal, and a Count, Clock time, or Number check-in. Count entries add their entered number of occurrences. Clock-time and number entries each count once. Clock-time habits can require a check-in by a goal time and set a later almost-goal time. Numbers range from 0 to 10,000 and allow up to two decimal places (for example, 7.55 or 120). Choose **No goal** under **Goal based on** to record check-ins without awarding progress or treats. Changing the schedule regroups past check-ins, and changing the input type applies to new check-ins. Notes can be up to 500 characters.

## Enable Google Sheets

1. In Google Cloud, enable the Google Drive and Google Sheets APIs and configure the OAuth consent screen. Add test accounts if the app is in testing.
2. Create a Web application OAuth client. Add `http://localhost:43183` and any HTTPS hosting origin to its authorized JavaScript origins.
3. Put the public client ID in the `google-client-id` meta tag in `index.html`, or enter it in **Connect Google**. The app uses Google Identity Services in the browser and requires no client secret.
4. Connect your account. The spreadsheet link appears in the footer. The current tab can reuse its short-lived Google token after reload. Reconnect when the token expires or when starting a new browser session. Google profiles and the device-local profile have separate histories.

If sync pauses with HTTP 403, check the operation and Google reason shown in the footer. For `SERVICE_DISABLED` or `accessNotConfigured`, enable the named API in the same Google Cloud project as the OAuth client, then choose **Sync now**. For `ACCESS_TOKEN_SCOPE_INSUFFICIENT` or `insufficientPermissions`, disconnect, reconnect, and grant the requested permissions.

App operations are stored locally and synced to Google's private app-data folder. Set **Category** to **Health**, **Work**, or **Family** in the habit editor. Sync puts check-ins in the corresponding **Health habits**, **Work habits**, or **Family habits** tab in the same spreadsheet, alongside shared **Habits**, **Habit settings**, and **Pet settings** tabs. Existing habits default to Health, and an existing **Habit records** tab is renamed **Health habits** on the next sync. Place your own charts and analysis on a separate tab. App retries reuse record and operation IDs. The client serializes sync in a browser where Web Locks are available. Simultaneous first-time spreadsheet creation from separate devices can race. A later sync selects a single tagged spreadsheet consistently.

## Defaults

- Weeks start Monday. Bedtime defaults to one check-in by 11:00 p.m. per day, with 11:30 p.m. as the almost-goal time. Sleep defaults to one entry in hours per day. Saved times and durations retain their original units in History.
- Exercise defaults to three occurrences a week, walks to two occurrences a day, and hunger to one number check-in a day. The recorded hunger number does not affect whether the goal is met.
- Walks award one randomly selected treat per achieved daily goal by default. History changes recalculate progress without playing rewards.
- Mood and hut have eight levels each. The scene uses original provisional Canvas artwork with a ramen preview and reusable placement anchors.
