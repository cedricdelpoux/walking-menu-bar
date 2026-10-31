# The pad

## Protocol

There is no official API. The protocol is ported from the unofficial Python library [ph4-walkingpad](https://github.com/ph4r05/ph4-walkingpad) and lives in [src/main/pad/protocol](../src/main/pad/protocol), a pure module without any Bluetooth dependency.

Most pads (A1, R1, R2, C1, C2…) expose the KingSmith service `fe00`, with notifications on `fe01` and commands written to `fe02`. Some newer models only expose the standard Fitness Machine Service (`1826`). The probe detects them and dumps their raw frames, but the app does not support them yet. Speed ranges per model live in [pad-models.ts](../src/main/pad/pad-models.ts), and unknown models get 0.5 to 6 km/h.

## Scripts without UI

The probe scans for the pad, connects to it, prints its GATT services and streams live statuses. It never sends a command that moves the belt.

1. Power the pad on and make sure the KS Fit app is **not** connected to it. The pad accepts only one BLE connection at a time, so quit the menu bar app as well.
2. Allow your terminal in **System Settings › Privacy & Security › Bluetooth**.
3. Run:

```sh
npm run probe                      # finds the first WalkingPad and streams statuses
npm run probe -- --list            # lists every BLE device nearby, candidates marked with ★
npm run probe -- --id <id>         # connects to a specific peripheral id from --list
npm run probe -- --raw             # also prints the raw frames in hex
```

The recorder does what the app does in the background, without any UI:

```sh
npm run record -- --db /tmp/test.db --pause-minutes 1 --verbose
```
