# The pad

## Protocol

The app speaks two protocols, which live in [src/main/pad/protocol](../src/main/pad/protocol), a pure module without any Bluetooth dependency. When a pad exposes both, the app uses the KingSmith one.

### KingSmith

There is no official API. This protocol is ported from the unofficial Python library [ph4-walkingpad](https://github.com/ph4r05/ph4-walkingpad). Most pads (A1, R1, R2, C1, C2…) expose its service `fe00`, with notifications on `fe01` and commands written to `fe02`. It is the one tested, on a C2.

### FTMS

Newer models only expose the standard Fitness Machine Service (`1826`). The pad pushes Treadmill Data notifications (`2acd`), and the app writes its commands to the control point (`2ad9`), asking for control before each of them and spacing them by 400 ms. KingSmith adds a few things to the standard, which the app follows:

- The `KS-HD-*` pads (Z1…) stay silent and ignore every command until they are unlocked on a vendor service (`24e2521c-…`). The unlock code comes from the last four characters of the Bluetooth name.
- The MC-21 pads (`KS-MC21-*`, `KS-SMC21C-*`, `ZP-ZEALR1-*`) only take a command right after a vendor frame written to `d18d2c10-…`.
- The steps come in a KingSmith extension of the Treadmill Data (flag bit 13), and the speed range is read from the pad (`2ad4`).

This protocol has no manual and automatic modes, so the app hides the mode switch for these pads. The details come from [walkingpad-controller](https://github.com/mcdax/walkingpad-controller/blob/main/docs/ftms-protocol-reference.md) and [z1-walkingpad-mcp](https://github.com/slandau3/z1-walkingpad-mcp/blob/main/docs/protocol.md), both built from KS Fit captures. The app has not been tried on a real FTMS pad yet: reports from owners of these models are welcome, ideally with the output of `npm run probe -- --raw`.

Speed ranges per model live in [pad-models.ts](../src/main/pad/pad-models.ts), and unknown models get 0.5 to 6 km/h.

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
