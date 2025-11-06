import { Hands, type HandsConfig, type Options } from "@mediapipe/hands";
import handFullModelUrl from "@mediapipe/hands/hand_landmark_full.tflite?url";
import handLiteModelUrl from "@mediapipe/hands/hand_landmark_lite.tflite?url";
import handsGraphUrl from "@mediapipe/hands/hands.binarypb?url";
import handsAssetsDataUrl from "@mediapipe/hands/hands_solution_packed_assets.data?url";
import handsAssetsLoaderUrl from "@mediapipe/hands/hands_solution_packed_assets_loader.js?url";
import handsSimdScriptUrl from "@mediapipe/hands/hands_solution_simd_wasm_bin.js?url";
import handsSimdWasmUrl from "@mediapipe/hands/hands_solution_simd_wasm_bin.wasm?url";
import handsWasmScriptUrl from "@mediapipe/hands/hands_solution_wasm_bin.js?url";
import handsWasmUrl from "@mediapipe/hands/hands_solution_wasm_bin.wasm?url";

type HandsFileKey =
  | "hands_solution_packed_assets_loader.js"
  | "hands_solution_packed_assets.data"
  | "hands_solution_simd_wasm_bin.js"
  | "hands_solution_simd_wasm_bin.wasm"
  | "hands_solution_wasm_bin.js"
  | "hands_solution_wasm_bin.wasm"
  | "hand_landmark_full.tflite"
  | "hand_landmark_lite.tflite"
  | "hands.binarypb";

const mediaPipeAssets = new Map<HandsFileKey, string>([
  ["hands_solution_packed_assets_loader.js", handsAssetsLoaderUrl],
  ["hands_solution_packed_assets.data", handsAssetsDataUrl],
  ["hands_solution_simd_wasm_bin.js", handsSimdScriptUrl],
  ["hands_solution_simd_wasm_bin.wasm", handsSimdWasmUrl],
  ["hands_solution_wasm_bin.js", handsWasmScriptUrl],
  ["hands_solution_wasm_bin.wasm", handsWasmUrl],
  ["hand_landmark_full.tflite", handFullModelUrl],
  ["hand_landmark_lite.tflite", handLiteModelUrl],
  ["hands.binarypb", handsGraphUrl],
]);

/**
 * Wraps the MediaPipe Hands solution so we control asset resolution.
 * Mirrors legacy_html/herakoi_web_test/herakoi.html:96, swapping the CDN for bundled assets
 * that Vite exposes via `?url` imports.
 */
export class HandsDetector {
  private readonly hands: Hands;

  constructor(options?: Options) {
    const locateFile: NonNullable<HandsConfig["locateFile"]> = (fileName) => {
      const asset = mediaPipeAssets.get(fileName as HandsFileKey);
      if (!asset) {
        throw new Error(`Missing MediaPipe asset mapping for "${fileName}".`);
      }
      return asset;
    };

    const handsConfig: HandsConfig = {
      locateFile,
    };

    this.hands = new Hands(handsConfig);

    if (options && Object.keys(options).length > 0) {
      this.hands.setOptions(options);
    }
  }

  /**
   * Future controllers can reach for the underlying MediaPipe instance when they need
   * to register callbacks or trigger graph operations. We expose it read-only to keep
   * construction concerns encapsulated here.
   */
  public getInstance(): Hands {
    return this.hands;
  }
}
