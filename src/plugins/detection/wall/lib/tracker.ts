/**
 * Fingertip tracking for people standing several metres from the camera.
 *
 * A hand at 3–5 m is only ~60–90 px wide in a 1080p frame, too small for the
 * hand model on the full frame. So: body pose on the whole frame (robust at a
 * distance) → square crop around each selected wrist → hand landmarks on the
 * crop → index fingertip. If the hand model can't lock on, the pose model's
 * own index estimate is used (coarser).
 */

import { HandLandmarker, type NormalizedLandmark, PoseLandmarker } from "@mediapipe/tasks-vision";
import visionWasmLoaderUrl from "@mediapipe/tasks-vision/vision_wasm_internal.js?url";
import visionWasmBinaryUrl from "@mediapipe/tasks-vision/vision_wasm_internal.wasm?url";
import handModelUrl from "../assets/hand_landmarker.task?url";
import poseModelUrl from "../assets/pose_landmarker_full.task?url";
import type { Vec2 } from "./homography";

export type HandSide = "right" | "left" | "both";

/** BlazePose landmark ids per arm (the person's anatomical side). */
const ARMS = {
  right: { shoulder: 12, elbow: 14, wrist: 16, pinky: 18, index: 20 },
  left: { shoulder: 11, elbow: 13, wrist: 15, pinky: 17, index: 19 },
} as const;

export type TrackedPointer = {
  person: number;
  side: "right" | "left";
  /** Fingertip in camera pixels. */
  tip: Vec2;
  source: "hand" | "pose";
  /** Arm lifted away from the body (a hanging arm never plays). */
  raised: boolean;
  /** 21 hand landmarks in camera pixels when the hand model locked on. */
  hand: Vec2[] | null;
  crop: { cx: number; cy: number; size: number } | null;
};

export type TrackedPerson = { points: Vec2[]; visibility: number[] };

export type TrackResult = { people: TrackedPerson[]; pointers: TrackedPointer[] };

export type TrackOptions = {
  hand: HandSide;
  /** Return false to skip the (costly) hand model for a pose index outside the area of interest. */
  isNearTarget?: (p: Vec2) => boolean;
};

const CROP_SIZE = 256;
/** Ignore bodies whose shoulders span less than this share of the frame width (e.g. a person
 * shown on the screen itself, inside a camera preview). */
const MIN_SHOULDER_WIDTH = 0.03;

const fileset: Parameters<typeof PoseLandmarker.createFromOptions>[0] = {
  wasmLoaderPath: visionWasmLoaderUrl,
  wasmBinaryPath: visionWasmBinaryUrl,
};

const createWithFallback = async <T>(create: (delegate: "GPU" | "CPU") => Promise<T>) => {
  try {
    return await create("GPU");
  } catch (gpuError) {
    console.warn("[wall] GPU delegate unavailable, using CPU", gpuError);
    return create("CPU");
  }
};

export class WallTracker {
  private lastTimestamp = 0;
  private readonly crop: HTMLCanvasElement;
  private readonly cropCtx: CanvasRenderingContext2D;

  private constructor(
    private readonly pose: PoseLandmarker,
    private readonly hands: HandLandmarker,
  ) {
    this.crop = document.createElement("canvas");
    this.crop.width = CROP_SIZE;
    this.crop.height = CROP_SIZE;
    const ctx = this.crop.getContext("2d", { willReadFrequently: false });
    if (!ctx) throw new Error("2D canvas unavailable");
    this.cropCtx = ctx;
  }

  static async create(maxPeople: number): Promise<WallTracker> {
    const pose = await createWithFallback((delegate) =>
      PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: poseModelUrl, delegate },
        runningMode: "VIDEO",
        numPoses: maxPeople,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      }),
    );
    const hands = await createWithFallback((delegate) =>
      HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: handModelUrl, delegate },
        runningMode: "IMAGE",
        numHands: 1,
        minHandDetectionConfidence: 0.35,
        minHandPresenceConfidence: 0.35,
      }),
    );
    return new WallTracker(pose, hands);
  }

  async setMaxPeople(maxPeople: number) {
    await this.pose.setOptions({ numPoses: maxPeople });
  }

  close() {
    this.pose.close();
    this.hands.close();
  }

  process(video: HTMLVideoElement, options: TrackOptions): TrackResult {
    const W = video.videoWidth;
    const H = video.videoHeight;
    const ts = Math.max(this.lastTimestamp + 1, performance.now());
    this.lastTimestamp = ts;
    const result = this.pose.detectForVideo(video, ts);
    const people: TrackedPerson[] = [];
    const pointers: TrackedPointer[] = [];

    result.landmarks.forEach((landmarks: NormalizedLandmark[], person) => {
      const P = landmarks.map((l) => [l.x * W, l.y * H] as Vec2);
      const V = landmarks.map((l) => l.visibility ?? 0);
      const shoulders = Math.hypot(P[11][0] - P[12][0], P[11][1] - P[12][1]);
      if (shoulders < MIN_SHOULDER_WIDTH * W) return;
      people.push({ points: P, visibility: V });

      const sides = options.hand === "both" ? (["right", "left"] as const) : [options.hand];
      for (const side of sides) {
        const ids = ARMS[side];
        if (V[ids.wrist] < 0.25 && V[ids.index] < 0.25) continue;
        const wrist = P[ids.wrist];
        const index = P[ids.index];
        const shoulder = P[ids.shoulder];
        // 0° = arm hanging straight down, 180° = straight up.
        const angle =
          (Math.atan2(Math.abs(wrist[0] - shoulder[0]), wrist[1] - shoulder[1]) * 180) / Math.PI;
        const raised = angle > 35;
        const pointer: TrackedPointer = {
          person,
          side,
          tip: index,
          source: "pose",
          raised,
          hand: null,
          crop: null,
        };
        if (raised && (options.isNearTarget?.(index) ?? true)) {
          const handLength = Math.max(
            Math.hypot(index[0] - wrist[0], index[1] - wrist[1]),
            Math.hypot(P[ids.pinky][0] - wrist[0], P[ids.pinky][1] - wrist[1]),
            12,
          );
          const size = Math.min(Math.max(3.4 * handLength, 96), 0.6 * Math.max(W, H));
          const cx = wrist[0] + 0.55 * (index[0] - wrist[0]);
          const cy = wrist[1] + 0.55 * (index[1] - wrist[1]);
          pointer.crop = { cx, cy, size };
          const hand = this.handInCrop(video, cx, cy, size, wrist);
          if (hand) {
            pointer.hand = hand;
            pointer.tip = hand[8];
            pointer.source = "hand";
          }
        }
        pointers.push(pointer);
      }
    });
    return { people, pointers };
  }

  private handInCrop(
    video: HTMLVideoElement,
    cx: number,
    cy: number,
    size: number,
    wrist: Vec2,
  ): Vec2[] | null {
    const ctx = this.cropCtx;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, CROP_SIZE, CROP_SIZE);
    ctx.drawImage(video, cx - size / 2, cy - size / 2, size, size, 0, 0, CROP_SIZE, CROP_SIZE);
    const r = this.hands.detect(this.crop);
    const lm = r.landmarks[0];
    if (!lm) return null;
    const pts = lm.map((l) => [cx - size / 2 + l.x * size, cy - size / 2 + l.y * size] as Vec2);
    // Reject the other hand or someone else's hand inside the crop.
    if (Math.hypot(pts[0][0] - wrist[0], pts[0][1] - wrist[1]) > 0.45 * size) return null;
    return pts;
  }
}
