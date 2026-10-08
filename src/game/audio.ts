/**
 * WebAudio sound effects. The context is created lazily on first user
 * gesture (browsers require it) and all tones are short synthesized
 * blips — no audio assets.
 */
export class Sfx {
  muted = false;

  private actx: AudioContext | null = null;
  private wakaOn = 0;

  /** Create/resume the AudioContext. Call from a user-gesture handler. */
  ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.actx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return null;
      this.actx = new AC();
    }
    if (this.actx.state === "suspended") void this.actx.resume();
    return this.actx;
  }

  private tone(
    f0: number,
    f1: number,
    dur: number,
    type: OscillatorType = "square",
    vol = 0.05,
    delay = 0,
  ): void {
    if (this.muted) return;
    const a = this.ensure();
    if (!a) return;
    const t0 = a.currentTime + delay;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(a.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  waka(): void {
    this.wakaOn ^= 1;
    this.tone(this.wakaOn ? 520 : 390, this.wakaOn ? 390 : 520, 0.07, "triangle", 0.06);
  }

  pellet(): void {
    this.tone(220, 640, 0.18, "sine", 0.06);
  }

  ghost(): void {
    this.tone(340, 1080, 0.28, "sawtooth", 0.05);
    this.tone(170, 540, 0.28, "square", 0.03);
  }

  die(): void {
    this.tone(620, 70, 0.9, "sawtooth", 0.06);
  }

  level(): void {
    [440, 554, 659, 880].forEach((f, i) => this.tone(f, f, 0.09, "square", 0.05, i * 0.09));
  }

  life(): void {
    [660, 880, 990, 1320].forEach((f, i) => this.tone(f, f, 0.08, "square", 0.05, i * 0.07));
  }
}
