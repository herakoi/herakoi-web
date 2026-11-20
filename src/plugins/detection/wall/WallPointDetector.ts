/**
 * Detector for a camera that watches the screen (monitor or projection) the
 * image is shown on. Fingertips are tracked in the camera image and mapped
 * onto the screen through the homography found by the screen mapping, so a
 * hand touching the screen plays the pixel under the finger.
 *
 * Emitted points are normalised to the image overlay canvas (like the
 * pointer detector), so the engine maps them 1:1.
 */

import type { DetectedPoint, ErrorOr, PointDetector } from "#src/core/interfaces";
import { NativeCamera } from "#src/plugins/detection/mediapipe/NativeCamera";
import type { WallCalibration, WallConfig } from "./config";
import { WallCameraStartError, WallModelLoadError, WallNotRunningError } from "./errors";
import { applyHomography, type Vec2 } from "./lib/homography";
import { OneEuroFilter2D } from "./lib/oneEuro";
import { createPointStream } from "./lib/pointStream";
import { type MappingIO, mapScreen, type Pattern } from "./lib/screenMapping";
import { type TrackResult, WallTracker } from "./lib/tracker";
import { accumulateLuma, type Gray } from "./lib/vision";
import { useWallStore } from "./store";

type WallDetectorOptions = {
  getConfig: () => WallConfig;
  setCalibration: (calibration: WallCalibration | null) => void;
  getOverlayCanvas: () => HTMLCanvasElement | null;
};

const CAMERA_WIDTH = 1920;
const CAMERA_HEIGHT = 1080;
/** Points slightly outside the screen still count and are clamped to the edge, so corners and
 * edges stay reachable despite small tracking errors. */
const EDGE_TOLERANCE = 0.06;
/** Viewport size change (CSS px) after which the mapping no longer matches the screen. */
const LAYOUT_TOLERANCE = 2;
/** Fastest plausible hand movement, in screen widths per second (~4 m/s on an 86" screen). */
const MAX_SPEED = 2;
/** A faster jump is only accepted once it repeats this many frames in the same place. */
const JUMP_CONFIRM_FRAMES = 3;

type PointTrack = {
  filter: OneEuroFilter2D;
  seen: number;
  /** Last accepted raw position (normalised screen). */
  last: [number, number] | null;
  candidate: [number, number] | null;
  candidateFrames: number;
};

/**
 * Rejects single-frame outliers: a move faster than a hand can travel is held back until it
 * repeats in the same place for a few frames (then it is a real relocation, e.g. a new person).
 */
const gate = (track: PointTrack, u: number, v: number, dt: number): [number, number] => {
  const last = track.last;
  if (last && Math.hypot(u - last[0], v - last[1]) > MAX_SPEED * dt + 0.03) {
    const c = track.candidate;
    if (c && Math.hypot(u - c[0], v - c[1]) < 0.05) track.candidateFrames++;
    else {
      track.candidate = [u, v];
      track.candidateFrames = 1;
    }
    if (track.candidateFrames < JUMP_CONFIRM_FRAMES) return last;
  }
  track.last = [u, v];
  track.candidate = null;
  track.candidateFrames = 0;
  return [u, v];
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class WallPointDetector implements PointDetector {
  private video: HTMLVideoElement | null = null;
  private camera: NativeCamera | null = null;
  private tracker: WallTracker | null = null;
  private readonly listeners = new Set<(points: DetectedPoint[]) => void>();
  private readonly filters = new Map<string, PointTrack>();
  private raf = 0;
  private lastVideoTime = -1;
  private mapping = false;
  private started = false;
  private grab: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null = null;
  private lastHasHands: boolean | null = null;
  private lastMapped: boolean | null = null;
  private lastLayoutChanged = false;
  /** Camera selection in use ("" = default); a mapping only applies to the camera it was made with. */
  private cameraId = "";
  /** Last tracking result, kept for debugging and the preview. */
  lastResult: TrackResult | null = null;

  constructor(private readonly options: WallDetectorOptions) {}

  async initialize(): Promise<ErrorOr<undefined>> {
    if (this.tracker) return;
    try {
      this.tracker = await WallTracker.create(this.options.getConfig().maxPeople);
    } catch (error) {
      return new WallModelLoadError({ cause: error });
    }
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("aria-hidden", "true");
    Object.assign(video.style, {
      position: "fixed",
      left: "0",
      top: "0",
      width: "2px",
      height: "2px",
      opacity: "0",
      pointerEvents: "none",
    });
    document.body.appendChild(video);
    this.video = video;
  }

  async start(): Promise<ErrorOr<undefined>> {
    if (!this.video || !this.tracker) {
      return new Error("WallPointDetector must be initialized before start()");
    }
    if (this.started) return;
    const error = await this.startCamera(this.options.getConfig().deviceId);
    if (error) return error;
    this.started = true;
    this.raf = requestAnimationFrame(this.loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.camera?.stop();
    this.camera = null;
    this.started = false;
    this.filters.clear();
    this.emit([]);
  }

  dispose(): void {
    this.stop();
    this.tracker?.close();
    this.tracker = null;
    this.video?.remove();
    this.video = null;
  }

  points(signal?: AbortSignal): AsyncIterable<DetectedPoint[]> {
    return createPointStream(this.listeners, signal);
  }

  async restartCamera(deviceId: string): Promise<void> {
    if (!this.started) return;
    this.camera?.stop();
    this.camera = null;
    await this.startCamera(deviceId);
  }

  async setMaxPeople(maxPeople: number): Promise<void> {
    await this.tracker?.setMaxPeople(maxPeople);
  }

  /** Runs the automatic screen mapping and stores the result in the plugin config. */
  async runMapping(): Promise<ErrorOr<WallCalibration>> {
    const video = this.video;
    if (!this.started || !video || video.videoWidth === 0) return new WallNotRunningError();
    this.mapping = true;
    this.emit([]);
    const store = useWallStore.getState();
    const io: MappingIO = {
      showPattern: (pattern: Pattern | null) =>
        new Promise<void>((resolve) => {
          const done = () => resolve();
          store.setPattern(pattern, done);
          // The overlay acknowledges paints; don't hang if it isn't mounted.
          setTimeout(done, pattern ? 1200 : 0);
        }),
      capture: (frames) => this.captureGray(video, frames),
      wait: sleep,
      progress: (step) => store.setMapping({ status: "running", step }),
    };
    try {
      // Countdown on screen so whoever pressed the button can step out of the camera view.
      for (let seconds = 3; seconds > 0; seconds--) {
        store.setPattern({ kind: "countdown", seconds }, null);
        await sleep(1000);
      }
      const result = await mapScreen(io, {
        viewportAspect: window.innerWidth / window.innerHeight,
      });
      if (result instanceof Error) return result;
      const errorPx = Number.isFinite(result.rms)
        ? (result.rms * (window.innerWidth + window.innerHeight)) / 2
        : null;
      const calibration: WallCalibration = {
        homography: result.homography,
        corners: result.corners,
        cameraWidth: result.cameraWidth,
        cameraHeight: result.cameraHeight,
        matchedDots: result.matchedDots,
        totalDots: result.totalDots,
        errorPx,
        cameraId: this.cameraId,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        createdAt: new Date().toISOString(),
      };
      this.options.setCalibration(calibration);
      this.filters.clear();
      return calibration;
    } finally {
      store.setPattern(null, null);
      this.mapping = false;
    }
  }

  private async startCamera(deviceId: string): Promise<WallCameraStartError | undefined> {
    if (!this.video) return new WallCameraStartError();
    // A camera that was unplugged (or a Continuity Camera that dropped) would fail with an
    // over-constrained error: use the default camera instead.
    const devices = await NativeCamera.enumerateVideoDevices();
    const available = deviceId !== "" && devices.some((device) => device.deviceId === deviceId);
    if (deviceId && !available) {
      console.warn("[wall] selected camera not found, using the default camera");
    }
    this.camera = new NativeCamera(this.video, {
      deviceId: available ? deviceId : undefined,
      width: CAMERA_WIDTH,
      height: CAMERA_HEIGHT,
      // Frames are pulled by our own loop (works while the video element is hidden).
      onFrame: () => {},
    });
    const result = await this.camera.start();
    if (result instanceof Error) {
      this.camera = null;
      const error = new WallCameraStartError({ cause: result });
      useWallStore.getState().setCameraError(error);
      return error;
    }
    this.cameraId = available ? deviceId : "";
    useWallStore.getState().setCameraError(null);
    return undefined;
  }

  private readonly loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const video = this.video;
    if (!video || !this.tracker || this.mapping || video.readyState < 2) return;
    if (video.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = video.currentTime;
    try {
      this.processFrame(video, this.tracker);
    } catch (error) {
      console.error("[wall] frame failed", error);
    }
  };

  /** Calibration made with this camera at this resolution, if any. */
  private activeCalibration(video: HTMLVideoElement): WallCalibration | null {
    const calibration = this.options.getConfig().calibration;
    if (!calibration) return null;
    if (calibration.cameraId !== undefined && calibration.cameraId !== this.cameraId) return null;
    if (
      calibration.cameraWidth !== video.videoWidth ||
      calibration.cameraHeight !== video.videoHeight
    ) {
      return null;
    }
    return calibration;
  }

  private processFrame(video: HTMLVideoElement, tracker: WallTracker) {
    const config = this.options.getConfig();
    const calibration = this.activeCalibration(video);
    // The mapping targets the viewport as it was laid out on the screen while mapping.
    const layoutChanged =
      calibration?.viewportWidth !== undefined &&
      (Math.abs(calibration.viewportWidth - window.innerWidth) > LAYOUT_TOLERANCE ||
        Math.abs((calibration.viewportHeight ?? 0) - window.innerHeight) > LAYOUT_TOLERANCE);
    const H = layoutChanged ? undefined : calibration?.homography;
    const toScreen = (p: Vec2) => (H ? applyHomography(H, p[0], p[1]) : null);

    const result = tracker.process(video, {
      hand: config.hand,
      // Configs saved before the option existed have no value: use the default.
      target: config.playWith ?? "palm",
      isNearTarget: (p) => {
        const s = toScreen(p);
        return !s || (s[0] > -0.15 && s[0] < 1.15 && s[1] > -0.15 && s[1] < 1.15);
      },
    });
    this.lastResult = result;

    const points: DetectedPoint[] = [];
    const now = performance.now() / 1000;
    if (H) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const rect = this.options.getOverlayCanvas()?.getBoundingClientRect();
      for (const pointer of result.pointers) {
        if (!pointer.raised) continue;
        const s = toScreen(pointer.tip);
        if (!s) continue;
        const [u, v] = s;
        if (u < -EDGE_TOLERANCE || u > 1 + EDGE_TOLERANCE) continue;
        if (v < -EDGE_TOLERANCE || v > 1 + EDGE_TOLERANCE) continue;
        const id = `wall-${pointer.person}-${pointer.side}`;
        let entry = this.filters.get(id);
        if (!entry || now - entry.seen > 0.5) {
          entry = {
            filter: new OneEuroFilter2D(0.8, 0.015),
            seen: now,
            last: null,
            candidate: null,
            candidateFrames: 0,
          };
          this.filters.set(id, entry);
        }
        const dt = Math.max(now - entry.seen, 1 / 60);
        entry.seen = now;
        const [gu, gv] = gate(entry, clamp01(u), clamp01(v), dt);
        const [sx, sy] = entry.filter.filter(gu * vw, gv * vh, now);
        const x = rect && rect.width > 0 ? (sx - rect.left) / rect.width : sx / vw;
        const y = rect && rect.height > 0 ? (sy - rect.top) / rect.height : sy / vh;
        points.push({ id, x: clamp01(x), y: clamp01(y) });
      }
    }

    this.drawPreview(video, result, calibration);
    this.emit(points);
    const mapped = calibration !== null && !layoutChanged;
    if (mapped !== this.lastMapped || layoutChanged !== this.lastLayoutChanged) {
      this.lastMapped = mapped;
      this.lastLayoutChanged = layoutChanged;
      useWallStore.getState().setMapped(mapped, layoutChanged);
    }
    const hasHands = points.length > 0;
    if (hasHands !== this.lastHasHands) {
      this.lastHasHands = hasHands;
      useWallStore.getState().setHasHands(hasHands);
    }
  }

  private emit(points: DetectedPoint[]) {
    for (const listener of this.listeners) listener(points);
  }

  private async nextFrame(video: HTMLVideoElement, after: number) {
    const start = performance.now();
    while (video.currentTime === after && performance.now() - start < 250) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }

  private async captureGray(video: HTMLVideoElement, frames: number): Promise<Gray> {
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!this.grab || this.grab.canvas.width !== width || this.grab.canvas.height !== height) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("2D canvas unavailable");
      this.grab = { canvas, ctx };
    }
    const { ctx } = this.grab;
    const acc = new Float32Array(width * height);
    let last = video.currentTime;
    for (let i = 0; i < frames; i++) {
      await this.nextFrame(video, last);
      last = video.currentTime;
      ctx.drawImage(video, 0, 0, width, height);
      accumulateLuma(ctx.getImageData(0, 0, width, height).data, acc);
    }
    for (let i = 0; i < acc.length; i++) acc[i] /= frames;
    return { data: acc, width, height };
  }

  private drawPreview(
    video: HTMLVideoElement,
    result: TrackResult,
    calibration: WallCalibration | null,
  ) {
    const canvas = useWallStore.getState().previewCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = video.videoWidth;
    const H = video.videoHeight;
    const cw = 480;
    const ch = Math.round((cw * H) / W);
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    const s = cw / W;
    ctx.drawImage(video, 0, 0, cw, ch);
    ctx.lineWidth = 2;

    if (calibration) {
      ctx.strokeStyle = "rgba(0, 230, 255, 0.95)";
      ctx.beginPath();
      calibration.corners.forEach(([x, y], i) => {
        if (i === 0) ctx.moveTo(x * s, y * s);
        else ctx.lineTo(x * s, y * s);
      });
      ctx.closePath();
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(255, 120, 255, 0.9)";
    for (const person of result.people) {
      for (const [a, b] of [
        [11, 12],
        [11, 13],
        [13, 15],
        [12, 14],
        [14, 16],
      ] as const) {
        if (person.visibility[a] < 0.3 || person.visibility[b] < 0.3) continue;
        ctx.beginPath();
        ctx.moveTo(person.points[a][0] * s, person.points[a][1] * s);
        ctx.lineTo(person.points[b][0] * s, person.points[b][1] * s);
        ctx.stroke();
      }
    }

    for (const pointer of result.pointers) {
      if (pointer.crop) {
        const { cx, cy, size } = pointer.crop;
        ctx.strokeStyle = "rgba(255, 230, 0, 0.8)";
        ctx.lineWidth = 1;
        ctx.strokeRect((cx - size / 2) * s, (cy - size / 2) * s, size * s, size * s);
      }
      if (pointer.hand) {
        ctx.fillStyle = "rgba(90, 255, 90, 0.9)";
        for (const [x, y] of pointer.hand) ctx.fillRect(x * s - 1, y * s - 1, 2, 2);
      }
      ctx.lineWidth = 2;
      ctx.strokeStyle = !pointer.raised
        ? "rgba(170, 170, 170, 0.9)"
        : pointer.source === "hand"
          ? "rgba(90, 255, 90, 1)"
          : pointer.source === "hold"
            ? "rgba(180, 255, 180, 1)"
            : "rgba(255, 170, 0, 1)";
      ctx.beginPath();
      ctx.arc(pointer.tip[0] * s, pointer.tip[1] * s, 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
