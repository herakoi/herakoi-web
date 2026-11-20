/**
 * 1-euro filter (Casiez et al.): strong smoothing when the point is still,
 * little lag when it moves fast. Works on 2D points in any unit.
 */
export class OneEuroFilter2D {
  private x: [number, number] | null = null;
  private dx: [number, number] = [0, 0];
  private t = 0;

  constructor(
    private readonly minCutoff = 1.2,
    private readonly beta = 0.01,
    private readonly dCutoff = 1.0,
  ) {}

  private static alpha(cutoff: number, dt: number) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  /** `t` in seconds. */
  filter(px: number, py: number, t: number): [number, number] {
    if (!this.x) {
      this.x = [px, py];
      this.t = t;
      return [px, py];
    }
    const dt = Math.max(t - this.t, 1e-3);
    this.t = t;
    const ad = OneEuroFilter2D.alpha(this.dCutoff, dt);
    this.dx = [
      ad * ((px - this.x[0]) / dt) + (1 - ad) * this.dx[0],
      ad * ((py - this.x[1]) / dt) + (1 - ad) * this.dx[1],
    ];
    const speed = Math.hypot(this.dx[0], this.dx[1]);
    const a = OneEuroFilter2D.alpha(this.minCutoff + this.beta * speed, dt);
    this.x = [a * px + (1 - a) * this.x[0], a * py + (1 - a) * this.x[1]];
    return [this.x[0], this.x[1]];
  }
}
