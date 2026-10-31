# Build

```sh
npm run dist
```

This writes a DMG and a zip for arm64 to `release/`, using the configuration in `electron-builder.config.cjs`.

The app is not distributed through a Developer ID. By default it is signed ad hoc, and an ad hoc signature changes on every build: macOS then asks again for access to the Keychain item that holds the Strava tokens, and the app stays frozen until you answer. To avoid that, sign with a stable local identity:

1. Create a self-signed code signing certificate, for example with OpenSSL, and import it into the login keychain.
2. Trust it for code signing: `security add-trusted-cert -r trustRoot -p codeSign -k ~/Library/Keychains/login.keychain-db cert.pem`.
3. Check that it is listed by `security find-identity -v -p codesigning`, then set its name in `.env`:

```sh
WALKING_BAR_SIGNING_IDENTITY=WalkingBar Local
```

macOS asks for Keychain access once more after switching identity, then no longer between builds.

`better-sqlite3` and `@stoprocent/noble` ship N-API prebuilds, which Electron loads without recompiling them for its ABI. That is why `npmRebuild` is disabled in `electron-builder.config.cjs`.
