# WalkingBar

WalkingBar is an unofficial macOS menu bar app for your WalkingPad. It drives a KingSmith pad over Bluetooth LE, records every session locally and publishes your walks to Strava, one activity per day or per session.

> This project is not affiliated with or endorsed by KingSmith, Xiaomi or Strava. WalkingPad and Strava are trademarks of their respective owners.
>
> It has only been tested on a WalkingPad C2 and on Apple Silicon. Other models with the KingSmith Bluetooth service should work, and reports are welcome.

<img src="docs/history.png" alt="The history of the app, with the speed chart of a walk" width="360">

## Features

- WalkingPad control from the macOS menu bar
- Live stats next to the icon
- Custom speed shortcuts
- Distance and time goals
- History with speed charts
- Strava publication (manual or automatic)
- English, French, Spanish, Italian, German and Dutch

## Getting started

WalkingBar needs macOS on Apple Silicon, and Node.js 24 with npm 11 to build it.

```sh
git clone https://github.com/cedricdelpoux/walkingbar.git
cd walkingbar
npm install
npm run dist
```

Open the DMG written to `release/`, then [connect your Strava application](docs/strava.md#configure-the-strava-application) to publish your walks.

## Documentation

- [Strava](docs/strava.md): set up your application and publish your walks
- [Build](docs/build.md): package the app and sign it
- [Development](docs/development.md): commands, debugging, project layout and translations
- [The pad](docs/pad.md): Bluetooth protocol and test scripts
- [How sessions are recorded](docs/sessions.md)

## License

[MIT](LICENSE)
