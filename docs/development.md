# Development

## Requirements

- macOS on Apple Silicon
- Node.js 22.14 or later, 24 LTS recommended (see `.nvmrc`), with npm 11

`better-sqlite3` needs N-API 10. It crashes with a segfault on older Node versions such as 23.4. npm 10.9 also fails to install this project with `Cannot read properties of null (reading 'edgesOut')`, which npm 11 fixes.

```sh
npm install
```

npm 11 only runs the install scripts listed in `allowScripts` in `package.json`.

## Commands

```sh
npm run dev         # starts the app with hot reload
npm test            # unit tests
npm run typecheck
npm run lint
npm run format
```

`npm test` runs vitest with the Node.js bundled in Electron, so the native modules load whatever Node version is installed.

The first time the app runs, macOS asks to allow Bluetooth for it (Electron in development, WalkingBar once packaged). Development runs keep their data in `~/Library/Application Support/WalkingBar Dev`, apart from the installed app.

A few environment variables help when working on the UI:

| Variable                             | Effect                                                      |
| ------------------------------------ | ----------------------------------------------------------- |
| `WALKING_BAR_SHOW_ON_START=1`        | Opens the popover on start                                  |
| `WALKING_BAR_KEEP_OPEN=1`            | Keeps the popover open when it loses focus                  |
| `WALKING_BAR_VIEW=history`           | Opens another view (`history`, `settings`)                  |
| `WALKING_BAR_CAPTURE=/path/shot.png` | Saves a screenshot of the popover a few seconds after start |

Some tools (the VS Code extension host for example) export `ELECTRON_RUN_AS_NODE=1`, which turns Electron into a plain Node.js process. The `dev` and `preview` scripts unset it. Unset it as well when you start the packaged app from such a terminal, or it quits right away.

## Project layout

```
src/main       Electron main process: BLE, sessions, SQLite, tray, IPC
src/preload    contextBridge API exposed to the UI
src/renderer   React UI of the popover
src/shared     Types, translations and pure helpers used on both sides
scripts        Probe and recorder scripts
```

## Translations

Each language is a dictionary in [src/shared/i18n](../src/shared/i18n), used by both the main process and the UI. To add one, copy `en.ts`, translate it, and register it in `index.ts`. The `Dictionary` type and a unit test make sure every key is translated. A value can be a function when the text takes parameters.
