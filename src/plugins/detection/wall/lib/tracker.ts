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
/** Which point of the hand plays: the palm centre (steadier) or the index fingertip (precise). */
export type PlayTarget = "palm" | "fingertip";

/** BlazePose landmark ids per arm (the person's anatomical side). */
const ARMS = {
  right: { shoulder: 12, elbow: 14, wrist: 16, pinky: 18, index: 20 },
  left: { shoulder: 11, elbow: 13, wrist: 15, pinky: 17, index: 19 },
} as const;

export type TrackedPointer = {
  person: number;
  side: "right" | "left";
  /** Playing point (palm centre or index fingertip) in camera pixels. */
  tip: Vec2;
  /** hand = hand model this frame; hold = last hand position kept through a short dropout;
   * pose = body-model estimate (coarse). */
  source: "hand" | "hold" | "pose";
  /** Hand model's left/right label for the detection (diagnostics). */
  handedness: string | null;
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
  target: PlayTarget;
  /** Return false to skip the (costly) hand model for a pose index outside the area of interest. */
  isNearTarget?: (p: Vec2) => boolean;
};

const CROP_SIZE = 256;
/** How long a lost hand is still looked for around its last position (ms). */
const HAND_MEMORY_MS = 600;
/** Dropouts shorter than this keep the last hand position instead of the coarse pose estimate. */
const HOLD_MS = 300;
/** The pose estimate is only used when its arm points are confidently visible. */
const MIN_POSE_VISIBILITY = 0.5;
/** A hand-model detection must have its wrist within this many hand lengths of the pose wrist. */
const MAX_WRIST_OFFSET = 1.2;
/** A detection the hand model confidently labels as the other hand is rejected. */
const HANDEDNESS_REJECT_SCORE = 0.9;
/** How long an arm's state (fingertip offset, raised) is remembered without seeing it (ms). */
const ARM_MEMORY_MS = 10_000;
/** Arm counts as raised above RAISE_ON degrees from hanging, and stops below RAISE_OFF. */
const RAISE_ON = 35;
const RAISE_OFF = 25;
/** Fingertip estimate before the hand model ever locked on: past the pose "index" knuckle point,
 * along the wrist → index direction (in units of that distance). */
const DEFAULT_FINGERTIP_ALONG = 0.5;
/** Palm centre from the hand model: wrist and the four knuckles. */
const PALM_LANDMARKS = [0, 5, 9, 13, 17] as const;

const palmCentre = (hand: readonly Vec2[]): Vec2 => {
  let x = 0;
  let y = 0;
  for (const i of PALM_LANDMARKS) {
    x += hand[i][0];
    y += hand[i][1];
  }
  return [x / PALM_LANDMARKS.length, y / PALM_LANDMARKS.length];
};

type Crop = { cx: number; cy: number; size: number };
type ArmMemory = {
  /** Last hand landmarks and when they were found (null until the hand model locks on). */
  hand: Vec2[] | null;
  handAt: number;
  /** Playing point found by the hand model at handAt. */
  lastTip: Vec2 | null;
  /** Playing point relative to its pose estimate, in the wrist → index frame (smoothed). */
  along: number;
  across: number;
  raised: boolean;
  seen: number;
};

/** Square crop around detected hand landmarks, with room for the hand to move. */
const cropAroundHand = (hand: readonly Vec2[]): Crop => {
  let x0 = Number.POSITIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let y1 = Number.NEGATIVE_INFINITY;
  for (const [x, y] of hand) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return {
    cx: (x0 + x1) / 2,
    cy: (y0 + y1) / 2,
    size: Math.max(96, 2.2 * Math.max(x1 - x0, y1 - y0)),
  };
};
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
  /** Last hand found per arm: the next crop follows it, and short dropouts keep its offset. */
  private readonly memory = new Map<string, ArmMemory>();
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
        minHandDetectionConfidence: 0.3,
        minHandPresenceConfidence: 0.3,
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
    for (const [key, memory] of this.memory) {
      if (ts - memory.seen > ARM_MEMORY_MS) this.memory.delete(key);
    }

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
        const key = `${person}-${side}-${options.target}`;
        const memory: ArmMemory = this.memory.get(key) ?? {
          hand: null,
          handAt: Number.NEGATIVE_INFINITY,
          lastTip: null,
          along: options.target === "palm" ? 0 : DEFAULT_FINGERTIP_ALONG,
          across: 0,
          raised: false,
          seen: ts,
        };
        memory.seen = ts;
        this.memory.set(key, memory);
        // 0° = arm hanging straight down, 180° = straight up. Hysteresis avoids on/off flicker.
        const angle =
          (Math.atan2(Math.abs(wrist[0] - shoulder[0]), wrist[1] - shoulder[1]) * 180) / Math.PI;
        const raised = angle > (memory.raised ? RAISE_OFF : RAISE_ON);
        memory.raised = raised;

        // Wrist → index frame: the fingertip is expressed in it so the remembered offset follows
        // the arm's rotation and distance.
        const dx = index[0] - wrist[0];
        const dy = index[1] - wrist[1];
        const d2 = Math.max(dx * dx + dy * dy, 1);
        // Pose estimate of the playing point: the index point for the fingertip, the mean of
        // wrist, index and pinky points for the palm.
        const pinky = P[ids.pinky];
        const base: Vec2 =
          options.target === "palm"
            ? [(wrist[0] + index[0] + pinky[0]) / 3, (wrist[1] + index[1] + pinky[1]) / 3]
            : index;
        const fromBody = (along: number, across: number): Vec2 => [
          base[0] + along * dx - across * dy,
          base[1] + along * dy + across * dx,
        ];
        const pointer: TrackedPointer = {
          person,
          side,
          tip: fromBody(memory.along, memory.across),
          source: "pose",
          handedness: null,
          raised,
          hand: null,
          crop: null,
        };
        if (raised && (options.isNearTarget?.(index) ?? true)) {
          const handLength = Math.max(
            Math.hypot(dx, dy),
            Math.hypot(P[ids.pinky][0] - wrist[0], P[ids.pinky][1] - wrist[1]),
            12,
          );
          const size = Math.min(Math.max(3.4 * handLength, 96), 0.6 * Math.max(W, H));
          const cx = wrist[0] + 0.55 * dx;
          const cy = wrist[1] + 0.55 * dy;
          const recentHand =
            memory.hand && ts - memory.handAt < HAND_MEMORY_MS ? memory.hand : null;
          // Follow the hand found last frame, then the pose estimate, then a wider look.
          const attempts: Crop[] = [
            ...(recentHand ? [cropAroundHand(recentHand)] : []),
            { cx, cy, size },
            { cx, cy, size: Math.min(size * 1.6, 0.8 * Math.max(W, H)) },
          ];
          let hand: Vec2[] | null = null;
          for (const crop of attempts) {
            pointer.crop = crop;
            const found = this.handInCrop(video, crop, wrist, MAX_WRIST_OFFSET * handLength, side);
            if (found) {
              hand = found.points;
              pointer.handedness = found.handedness;
              break;
            }
          }
          if (hand) {
            const tip = options.target === "palm" ? palmCentre(hand) : hand[8];
            pointer.hand = hand;
            pointer.tip = tip;
            pointer.source = "hand";
            // Learn where the real fingertip sits relative to the pose estimate, so that when the
            // hand model drops out the fallback lands near the finger instead of the knuckles.
            const ox = tip[0] - base[0];
            const oy = tip[1] - base[1];
            const along = Math.min(2, Math.max(-0.5, (ox * dx + oy * dy) / d2));
            const across = Math.min(1, Math.max(-1, (oy * dx - ox * dy) / d2));
            const k = memory.hand ? 0.3 : 1;
            memory.along += k * (along - memory.along);
            memory.across += k * (across - memory.across);
            memory.hand = hand;
            memory.handAt = ts;
            memory.lastTip = tip;
          } else if (memory.lastTip && ts - memory.handAt < HOLD_MS) {
            // Short dropout (typically 2–6 frames): stay where the hand was.
            pointer.tip = memory.lastTip;
            pointer.source = "hold";
          } else {
            const poseVisible =
              V[ids.wrist] >= MIN_POSE_VISIBILITY &&
              V[ids.index] >= MIN_POSE_VISIBILITY &&
              V[ids.pinky] >= MIN_POSE_VISIBILITY * 0.8;
            // An unsure body estimate jumps around: better silent than playing the wrong place.
            if (!poseVisible) continue;
          }
        }
        pointers.push(pointer);
      }
    });
    return { people, pointers };
  }

  private handInCrop(
    video: HTMLVideoElement,
    { cx, cy, size }: Crop,
    wrist: Vec2,
    maxWristDistance: number,
    side: "right" | "left",
  ): { points: Vec2[]; handedness: string | null } | null {
    const ctx = this.cropCtx;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, CROP_SIZE, CROP_SIZE);
    ctx.drawImage(video, cx - size / 2, cy - size / 2, size, size, 0, 0, CROP_SIZE, CROP_SIZE);
    const r = this.hands.detect(this.crop);
    const lm = r.landmarks[0];
    if (!lm) return null;
    // Labels refer to the person's own hands (the camera image is not mirrored).
    const label = r.handedness[0]?.[0];
    if (
      label &&
      label.score >= HANDEDNESS_REJECT_SCORE &&
      label.categoryName.toLowerCase() !== side
    ) {
      return null;
    }
    const pts = lm.map((l) => [cx - size / 2 + l.x * size, cy - size / 2 + l.y * size] as Vec2);
    // Reject the other hand or someone else's hand inside the crop.
    if (Math.hypot(pts[0][0] - wrist[0], pts[0][1] - wrist[1]) > maxWristDistance) return null;
    return {
      points: pts,
      handedness: label ? `${label.categoryName}:${label.score.toFixed(2)}` : null,
    };
  }
}
