# Strava

By default the app publishes one activity per day that adds up every session of the day: a `Walk` marked as a trainer activity, starting with the first session, with the total time and distance. Its description lists each session (time, duration, distance, average speed), then the totals, steps, average speed and max speed. In the settings, you can publish one activity per session instead.

The distance comes from the belt speed and the walking time, because the pad only reports its distance in 10 m steps. Pauses are left out of the uploaded file, so the Strava graph only shows the changes of speed.

## Configure the Strava application

Strava lets a new API application serve only its owner, so every user brings their own application:

1. Create an API application on [strava.com/settings/api](https://www.strava.com/settings/api), or reuse one you already have. Strava allows a single application per account.
2. Set its **Authorization Callback Domain** to `localhost`. Strava always accepts `localhost` and `127.0.0.1` as redirects whatever this domain is, so an application already set up for another domain works as well.
3. In the app, open **Settings › Strava**, enter the client ID and secret, and save them. They are encrypted with Electron's `safeStorage`, whose key lives in the macOS Keychain.
4. Click **Connect Strava**. The browser opens the Strava authorization page with the `activity:read_all,activity:write` scopes, and a one-shot local server on `127.0.0.1` receives the authorization code. The tokens are encrypted the same way and are refreshed before they expire.

Saving other credentials disconnects Strava, because tokens belong to the application that issued them.

For your own builds, you can also set the credentials in a `.env` file instead (copy `.env.example`):

```sh
MAIN_VITE_STRAVA_CLIENT_ID=12345
MAIN_VITE_STRAVA_CLIENT_SECRET=...
```

These values are built into the app by `npm run dev` and `npm run dist`, and the ones saved in the settings take priority. A desktop app has no server to hide a secret, so never share a build made with a `.env`. Build without one for anything you distribute. `.env` is ignored by git.

## Publishing

**Publish now** on the home screen, or the upload icon in the history, opens a preview where the title and description can be edited before sending.

With **Publish automatically**, a day leaves at the time you choose, and a session leaves as soon as it ends.

A day or a session is never published twice. Its Strava activity id is stored in the database once published, and before creating an activity the app looks for one it may have created during an attempt that crashed before saving the id. A failed attempt is recorded with its error and can be retried. A walk that is already on Strava, created by hand for example, can be marked as such so it is never published.

The Strava API cannot delete an activity, so that has to be done on Strava. The app notices it the next time its window opens, and the walk can then be published again.

The Strava API cannot set who sees an activity: new activities follow the default privacy of your Strava account. The app can only hide the activity from the home feed.
