/**
 * Spectrum analysis for the particle cover's "音乐律动" effect.
 *
 * The player's <audio> element is routed through an AnalyserNode. That routing
 * is one-shot per element (createMediaElementSource throws on a second call),
 * so the graph is built lazily and kept for the lifetime of the page. The
 * element's own `volume` is applied before this graph, so the volume slider
 * keeps working unchanged.
 *
 * The media must be CORS-readable (the element carries crossOrigin="anonymous")
 * or the spec requires the source node to output silence; readBands() then
 * reports zero energy and callers fall back to a non-audio effect.
 */

let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
const analyserByElement = new WeakMap<
  HTMLAudioElement,
  { analyser: AnalyserNode; data: Uint8Array<ArrayBuffer> }
>();
// Explicit ArrayBuffer generic: getByteFrequencyData rejects ArrayBufferLike.
let data: Uint8Array<ArrayBuffer> | null = null;

export interface Bands {
  /** 0..1 average energy of the low / mid / high thirds of the spectrum. */
  low: number;
  mid: number;
  high: number;
  /** 0..1 overall energy. */
  total: number;
}

/**
 * Route `el` through an analyser, reusing the existing graph. Both player
 * elements need their own source node because the app swaps decoders during
 * preloading; otherwise the promoted decoder can advance silently.
 * Returns false when Web Audio is unavailable in this environment.
 */
export function ensureAnalyser(el: HTMLAudioElement): boolean {
  const existing = analyserByElement.get(el);
  if (existing) {
    analyser = existing.analyser;
    data = existing.data;
    return true;
  }
  let source: MediaElementAudioSourceNode | null = null;
  try {
    ctx ??= new AudioContext();
    source = ctx.createMediaElementSource(el);
    const elementAnalyser = ctx.createAnalyser();
    elementAnalyser.fftSize = 128;
    elementAnalyser.smoothingTimeConstant = 0.75;
    source.connect(elementAnalyser);
    elementAnalyser.connect(ctx.destination);
    const elementData = new Uint8Array(
      elementAnalyser.frequencyBinCount,
    ) as Uint8Array<ArrayBuffer>;
    analyserByElement.set(el, { analyser: elementAnalyser, data: elementData });
    analyser = elementAnalyser;
    data = elementData;
    return true;
  } catch {
    // createMediaElementSource reroutes the element away from its native
    // output immediately. If analyser setup fails afterwards, restore a
    // direct output path instead of leaving the player silent.
    try {
      if (source && ctx) source.connect(ctx.destination);
    } catch {
      // The browser may reject reconnecting a failed or closed context.
    }
    return false;
  }
}

/** Browsers may start the context suspended; call this when playback starts. */
export function resumeAnalyser(): void {
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
}

/** Current spectrum energy, or null when no analyser is wired up. */
export function readBands(): Bands | null {
  if (!analyser || !data) return null;
  analyser.getByteFrequencyData(data);
  const n = data.length;
  const lowEnd = Math.max(1, Math.floor(n * 0.18));
  const midEnd = Math.max(lowEnd + 1, Math.floor(n * 0.55));
  let low = 0;
  let mid = 0;
  let high = 0;
  for (let i = 0; i < n; i++) {
    const v = data[i] / 255;
    if (i < lowEnd) low += v;
    else if (i < midEnd) mid += v;
    else high += v;
  }
  low /= lowEnd;
  mid /= midEnd - lowEnd;
  high /= Math.max(1, n - midEnd);
  return { low, mid, high, total: (low + mid + high) / 3 };
}
