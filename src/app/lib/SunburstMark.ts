export type SunburstMode = "spectrum" | "waveform";

export type SunburstConfig = {
  bg: string;
  rayColor: string;

  rays: number;
  coreRadius: number;
  coreColor: string;
  rayGap: number;
  rayWidth: number;
  baseLen: number;
  reactLen: number;

  noiseFloor: number;
  gain: number;
  gamma: number;

  attack: number;
  release: number;

  circularBlurPasses: number;

  rotate: boolean;
  rotateSpeed: number;

  baseWaveStrength: number;
  baseWaveWidthRays: number;

  propagateStrength: number;
  propagateSpeed: number;
  propagateSharpness: number;
};

export class SunburstMark {
  private state: Float32Array;
  private mags: Float32Array;
  private tmp: Float32Array;
  private signature: Float32Array;
  private readonly t0: number;
  private wavePhase = 0;
  private lastNow = performance.now();
  private propagatedOnce = false;

  constructor(private cfg: SunburstConfig) {
    this.state = new Float32Array(cfg.rays);
    this.mags = new Float32Array(cfg.rays);
    this.tmp = new Float32Array(cfg.rays);
    this.signature = new Float32Array(cfg.rays);
    this.buildSignature();
    this.t0 = performance.now();
  }

  updateConfig(cfg: SunburstConfig): void {
    if (cfg.rays !== this.cfg.rays) {
      this.cfg = cfg;
      this.state = new Float32Array(cfg.rays);
      this.mags = new Float32Array(cfg.rays);
      this.tmp = new Float32Array(cfg.rays);
      this.signature = new Float32Array(cfg.rays);
      this.buildSignature();
      return;
    }
    this.cfg = cfg;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    analysis: Uint8Array | null,
    mode: SunburstMode,
  ): void {
    this.computeMagnitudes(analysis, mode);
    this.applyPropagation();

    const cx = w / 2;
    const cy = h / 2;
    const baseR = this.cfg.coreRadius + this.cfg.rayGap;
    const now = performance.now();
    const rot = this.cfg.rotate ? (now - this.t0) * this.cfg.rotateSpeed : 0;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = this.cfg.bg;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);

    ctx.strokeStyle = this.cfg.rayColor;
    ctx.lineWidth = this.cfg.rayWidth;
    ctx.lineCap = "round";

    for (let i = 0; i < this.cfg.rays; i++) {
      const theta = (i / this.cfg.rays) * Math.PI * 2 - Math.PI / 2;

      const targetLen = this.cfg.baseLen + this.cfg.reactLen * this.mags[i];
      const k = targetLen > this.state[i] ? this.cfg.attack : this.cfg.release;
      this.state[i] = this.state[i] * k + targetLen * (1 - k);

      const x1 = Math.cos(theta) * baseR;
      const y1 = Math.sin(theta) * baseR;
      const x2 = Math.cos(theta) * (baseR + this.state[i]);
      const y2 = Math.sin(theta) * (baseR + this.state[i]);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(0, 0, this.cfg.coreRadius, 0, Math.PI * 2);
    ctx.fillStyle = this.cfg.coreColor;
    ctx.fill();

    ctx.restore();
  }

  private buildSignature(): void {
    for (let i = 0; i < this.cfg.rays; i++) {
      const t = i / this.cfg.rays;
      const v =
        0.9 +
        0.08 * Math.sin(t * Math.PI * 2 * 3.0 + 0.8) +
        0.05 * Math.sin(t * Math.PI * 2 * 7.0 + 1.4);
      this.signature[i] = clamp(v, 0.78, 1.06);
    }
  }

  private computeMagnitudes(analysis: Uint8Array | null, mode: SunburstMode): void {
    if (!analysis) {
      this.idleMagnitudes();
      return;
    }

    if (mode === "waveform") {
      this.waveformMagnitudes(analysis);
      return;
    }

    this.spectrumMagnitudes(analysis);
  }

  private idleMagnitudes(): void {
    const now = performance.now();
    for (let i = 0; i < this.cfg.rays; i++) {
      this.mags[i] = 0.1 + 0.07 * Math.sin(now * 0.0015 + i * 0.35);
    }
    this.circularBlur(this.cfg.circularBlurPasses);
  }

  private spectrumMagnitudes(freq: Uint8Array): void {
    const nBins = freq.length;

    for (let i = 0; i < this.cfg.rays; i++) {
      const t = i / (this.cfg.rays - 1);
      const idx = logIndex(t, nBins);
      const span = Math.max(2, Math.floor(idx * 0.02));

      const a = Math.max(0, idx - span);
      const b = Math.min(nBins - 1, idx + span);

      let v = bandAvg(freq, a, b);
      v = applyResponseCurve(v, this.cfg, this.signature[i]);
      this.mags[i] = v;
    }

    this.circularBlur(this.cfg.circularBlurPasses);
    for (let i = 0; i < this.cfg.rays; i++) this.mags[i] = clamp01(this.mags[i]);
  }

  private waveformMagnitudes(wave: Uint8Array): void {
    const n = wave.length;

    for (let i = 0; i < this.cfg.rays; i++) {
      const t0 = i / this.cfg.rays;
      const t1 = (i + 1) / this.cfg.rays;

      const a = clamp(Math.floor(t0 * n), 0, n - 1);
      const b = clamp(Math.floor(t1 * n), a + 1, n);

      let sum = 0;
      for (let j = a; j < b; j++) {
        sum += Math.abs((wave[j] - 128) / 128);
      }
      const v = sum / Math.max(1, b - a);

      this.mags[i] = applyResponseCurve(v, this.cfg, this.signature[i]);
    }

    this.circularBlur(this.cfg.circularBlurPasses);
    for (let i = 0; i < this.cfg.rays; i++) this.mags[i] = clamp01(this.mags[i]);
  }

  private circularBlur(passes: number): void {
    const a = this.mags;
    const t = this.tmp;
    for (let pass = 0; pass < passes; pass++) {
      for (let i = 0; i < a.length; i++) {
        const im1 = (i - 1 + a.length) % a.length;
        const ip1 = (i + 1) % a.length;
        t[i] = 0.22 * a[im1] + 0.56 * a[i] + 0.22 * a[ip1];
      }
      a.set(t);
    }
  }

  private applyPropagation(): void {
    const baseWaveStrength = this.cfg.baseWaveStrength;
    const audioStrength = this.cfg.propagateStrength;
    if (baseWaveStrength <= 0 && audioStrength <= 0) return;

    const now = performance.now();
    const dt = Math.max(0, (now - this.lastNow) / 1000);
    this.lastNow = now;

    const rays = this.cfg.rays;
    const speed = this.cfg.propagateSpeed;
    this.wavePhase = (this.wavePhase + dt * speed * Math.PI * 2) % (Math.PI * 2);

    let energy = 0;
    let max = 0;
    for (let i = 0; i < rays; i++) {
      const v = this.mags[i] ?? 0;
      energy += v * v;
      if (v > max) max = v;
    }
    energy = Math.sqrt(energy / Math.max(1, rays));

    const sharpness = Math.max(1, this.cfg.propagateSharpness);
    const out = this.tmp;
    const center = (this.wavePhase / (Math.PI * 2)) * rays;
    const widthRays = Math.max(2, this.cfg.baseWaveWidthRays || rays / (sharpness * 1.8));

    let packet = clamp01((Math.max(energy, max) - 0.02) / 0.45);
    if (this.propagatedOnce) {
      packet = Math.max(packet, 0.06);
    } else if (packet > 0.08) {
      this.propagatedOnce = true;
    }

    const totalPacket = Math.min(1.8, baseWaveStrength + packet * audioStrength);

    for (let i = 0; i < rays; i++) {
      const dist = circularDistance(i, center, rays);
      const wave = Math.max(0, 1 - dist / widthRays) ** sharpness;

      const v = this.mags[i] ?? 0;
      const highlight = (0.34 + 0.66 * v) * totalPacket * wave;
      out[i] = clamp01(v + highlight);
    }

    this.mags.set(out);
    this.circularBlur(1);
  }
}

function circularDistance(i: number, center: number, rays: number): number {
  const d = Math.abs(i - center);
  return Math.min(d, rays - d);
}

function applyResponseCurve(raw: number, cfg: SunburstConfig, signature: number): number {
  let v = clamp01((raw - cfg.noiseFloor) / (1 - cfg.noiseFloor));
  v = clamp01(v * cfg.gain);
  v = v ** cfg.gamma;
  v *= signature;
  return clamp01(v);
}

function bandAvg(arr: Uint8Array, a: number, b: number): number {
  let sum = 0;
  const n = Math.max(1, b - a);
  for (let i = a; i < b; i++) sum += arr[i] ?? 0;
  return sum / n / 255;
}

function logIndex(t: number, nBins: number): number {
  const min = 3;
  const max = nBins - 3;
  const idx = Math.floor(min * (max / min) ** t);
  return clamp(idx, 0, max);
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function clamp(x: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, x));
}
