# TODO: Manual test — desktop camera permissions (Electron)

The Electron-native camera permission handling (macOS TCC pre-flight, IPC bridge,
"open system settings" deep-link) is implemented and unit-tested, but the
OS-level prompt and settings deep-link can only be verified by hand on a real
machine. Tick these off before considering the feature shippable.

## Why the dev server can look "broken"

In `pnpm electron:dev` the running binary is the generic Electron helper, so
macOS attributes the camera permission to its bundle id (`com.github.Electron`),
**not** `org.herakoi.app`. If any past Electron project was granted camera
access, the status is already `granted` → no prompt appears and the pre-flight
falls straight through, looking unchanged. Use the packaged build for a faithful
test, and target `Electron` (not `Herakoi`) when toggling permissions in dev.

## A. Quick bridge diagnosis (DevTools console)

- [ ] Restart `pnpm electron:dev` (preload is rebuilt only on restart).
- [ ] Console: `window.herakoiNative` returns an object with `platform: "darwin"` and 3 functions (preload loaded under sandbox + contextIsolation).
- [ ] Console: `await window.herakoiNative.getCameraPermissionStatus()` returns a status string.
- [ ] Console: `await window.herakoiNative.openCameraSettings()` opens System Settings → Privacy → Camera (IPC + `shell.openExternal` OK).

## B. Denied-state UX in dev (simulated)

- [ ] System Settings → Privacy & Security → Camera → toggle **Electron** OFF.
- [ ] Start the engine in Herakoi → no `getUserMedia` call; Italian message
      "La fotocamera è bloccata nelle impostazioni di sistema…" + an
      **"Apri impostazioni"** button.
- [ ] Click the button → System Settings opens at the Camera pane.
- [ ] Re-enable **Electron** to restore normal behaviour.

## C. Faithful test on the packaged build

The bundle is ad-hoc signed by `build/afterPack.cjs`, so it launches natively on
Apple Silicon without any manual `codesign` step. It is **not** notarized, so a
downloaded DMG is quarantined and Gatekeeper prompts on first open.

- [ ] `pnpm electron:build:mac`, copy `Herakoi.app` out of the DMG into /Applications
      (do not run it from the mounted DMG, and eject stale `Herakoi*` volumes first).
- [ ] First open: right-click → **Open** (or System Settings → Privacy & Security →
      "Open Anyway"). It must launch — no `dyld` "different Team IDs" crash.
      (Alternatively clear quarantine: `xattr -dr com.apple.quarantine /Applications/Herakoi.app`.)
- [ ] `tccutil reset Camera org.herakoi.app` → relaunch → first engine start shows
      the macOS prompt. Allow → camera runs.
- [ ] `tccutil reset Camera org.herakoi.app` → relaunch → Deny → friendly message
      + working "Apri impostazioni" deep-link.

## Notes / fallbacks

- Reset all apps (dev fallback, affects every app): `tccutil reset Camera`.
- Watch the OS decision while starting the engine:
  `log stream --predicate 'subsystem == "com.apple.TCC"' --info`
  (`denying request: source not entitled` ⇒ blocked at system level, typical for
  an unsigned/un-notarized build).
- Windows/Linux: pre-flight is a no-op (`getCameraPermissionStatus` → `"granted"`);
  Linux has no settings deep-link, so `openCameraSettings()` returns `false` and
  no button is shown.
