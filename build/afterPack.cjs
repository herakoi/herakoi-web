const { execFileSync } = require("node:child_process");

/**
 * electron-builder afterPack hook — ad-hoc code signing for macOS.
 *
 * The macOS builds are intentionally unsigned (no Apple Developer ID), but an
 * unsigned bundle crashes at launch on Apple Silicon: dyld refuses to load the
 * Electron Framework because the main executable and the framework carry
 * inconsistent signatures ("different Team IDs"). Intel builds survive only
 * because Rosetta does not enforce this.
 *
 * Re-signing the whole bundle ad-hoc (`codesign --sign -`, with `--deep` so the
 * nested Electron Framework is re-signed too) makes the signatures consistent,
 * so the app launches natively on arm64 — without anyone having to run codesign
 * by hand. This runs BEFORE electron-builder's own signing step, so when a real
 * Developer ID is available that proper signature simply overrides the ad-hoc one.
 *
 * This is NOT notarization: a downloaded DMG stays quarantined, so Gatekeeper
 * still shows the "unidentified developer" prompt on first open (right-click →
 * Open). Removing that prompt requires notarization with a paid Apple account.
 *
 * Note: `mac.hardenedRuntime` MUST stay false in package.json for these unsigned
 * builds. Hardened runtime turns on Library Validation, which rejects an
 * ad-hoc-signed Electron Framework at launch ("different Team IDs") — the very
 * crash this hook would otherwise still hit. Re-enable it only together with a
 * real Developer ID signature + notarization.
 */
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;

  const appPath = `${context.appOutDir}/${context.packager.appInfo.productFilename}.app`;
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath], {
    stdio: "inherit",
  });
};
