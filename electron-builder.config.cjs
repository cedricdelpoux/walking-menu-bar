try {
  process.loadEnvFile(".env")
} catch {
  // Building without a .env is fine: the app is then signed ad hoc.
}

// A stable identity keeps the macOS Keychain permission across builds. Ad hoc signatures change
// on every build, and Apple Silicon refuses to run a bundle whose signature is broken.
const AD_HOC_IDENTITY = "-"

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: "fr.cedricdelpoux.walkingbar",
  productName: "WalkingBar",
  directories: {
    buildResources: "build",
    output: "release",
  },
  files: ["out/**", "resources/**", "package.json"],
  asarUnpack: ["resources/**", "**/*.node"],
  // better-sqlite3 and noble ship N-API prebuilds that Electron loads as is.
  npmRebuild: false,
  mac: {
    target: [
      {target: "dmg", arch: "arm64"},
      {target: "zip", arch: "arm64"},
    ],
    category: "public.app-category.healthcare-fitness",
    icon: "build/icon.png",
    identity: process.env.WALKING_BAR_SIGNING_IDENTITY || AD_HOC_IDENTITY,
    hardenedRuntime: false,
    extendInfo: {
      LSUIElement: true,
      NSBluetoothAlwaysUsageDescription:
        "WalkingBar uses Bluetooth to connect to your treadmill.",
    },
  },
  dmg: {
    artifactName: "${productName}-${version}-${arch}.${ext}",
  },
}
