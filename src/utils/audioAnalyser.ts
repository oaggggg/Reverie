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
    // 256 采样点：低/中/高频段划分更细，频谱通量对鼓点的定位也更准。
    elementAnalyser.fftSize = 256;
    elementAnalyser.smoothingTimeConstant = 0.7;
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

/**
 * 暂停播放时挂起上下文：AudioContext 的渲染线程停止空转（否则即使
 * 静音也按采样率持续调度），后台挂机时音频侧 CPU 占用归零。
 * 所有恢复播放的路径都会调用 resumeAnalyser()，无须在此恢复。
 */
export function suspendAnalyser(): void {
  if (ctx && ctx.state === "running") ctx.suspend().catch(() => {});
}

/**
 * 当前音频图状态：未接入 Web Audio 时返回 null。
 * "suspended"/"interrupted"/"closed" 的上下文会让媒体元素照常走表但整条
 * 输出链静音（播放栏一切正常却没有声音），调用方需要据此自愈重试。
 */
export function audioGraphState(): AudioContextState | null {
  return ctx ? ctx.state : null;
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

/* -------------------------- 节奏 / 节拍分析 -------------------------- */
/*
 * 在频谱三段能量之上叠加 onset（节拍）检测，供 3D 粒子封面做
 * 完全由歌曲节奏驱动的无规则律动：
 * - 频谱通量 flux：当前帧相对上一帧新增能量的总和，对鼓点/重音远比
 *   绝对能量敏感；
 * - 自适应阈值：滑动的短时能量均值 × 灵敏度，并要求距上次节拍至少
 *   MIN_BEAT_GAP_MS（人耳节拍密度上限 ≈ 4-5 拍/秒），避免连成一片；
 * - beat 冲击值：onset 时置 1，按指数衰减，粒子层据此做"打击感"。
 */

/** 节拍间距下限（ms）：约 250 拍/分钟封顶。 */
const MIN_BEAT_GAP_MS = 200;
/** 能量历史窗口长度（帧）：约 1 秒 @60fps。 */
const ENERGY_HISTORY = 60;
/** beat 冲击的半衰期（ms）：约 220ms 衰减到一半，符合打击感的体感。 */
const BEAT_DECAY_MS = 220;

export interface Rhythm extends Bands {
  /** 0..1 节拍冲击值，onset 后指数衰减。 */
  beat: number;
  /** 距上次节拍的毫秒数。 */
  sinceBeat: number;
  /** 0..n 频谱通量原始值（本帧新增能量总和）。 */
  flux: number;
}

let prevSpectrum: Uint8Array<ArrayBuffer> | null = null;
const energyHistory: number[] = [];
let beatValue = 0;
let lastBeatAt = 0;
let lastReadAt = 0;

export function readRhythm(): Rhythm | null {
  if (!analyser || !data) return null;
  analyser.getByteFrequencyData(data);
  const now = performance.now();
  const dt = lastReadAt ? Math.min(now - lastReadAt, 200) : 16;
  lastReadAt = now;

  const n = data.length;
  const lowEnd = Math.max(1, Math.floor(n * 0.18));
  const midEnd = Math.max(lowEnd + 1, Math.floor(n * 0.55));
  let low = 0;
  let mid = 0;
  let high = 0;
  let flux = 0;
  for (let i = 0; i < n; i++) {
    const v = data[i] / 255;
    if (i < lowEnd) low += v;
    else if (i < midEnd) mid += v;
    else high += v;
    if (prevSpectrum) {
      const d = v - prevSpectrum[i] / 255;
      if (d > 0) flux += d;
    }
  }
  low /= lowEnd;
  mid /= midEnd - lowEnd;
  high /= Math.max(1, n - midEnd);
  const total = (low + mid + high) / 3;

  if (!prevSpectrum || prevSpectrum.length !== n) {
    prevSpectrum = new Uint8Array(data);
  } else {
    prevSpectrum.set(data);
  }

  // 自适应节拍判定：短时均值 × 灵敏度，且通量显著（重音而非缓变）。
  energyHistory.push(total);
  if (energyHistory.length > ENERGY_HISTORY) energyHistory.shift();
  const avg =
    energyHistory.reduce((a, b) => a + b, 0) / Math.max(1, energyHistory.length);
  const sinceBeat = now - lastBeatAt;
  if (
    total > avg * 1.32 + 0.015 &&
    flux > 0.55 &&
    sinceBeat >= MIN_BEAT_GAP_MS
  ) {
    beatValue = 1;
    lastBeatAt = now;
  } else {
    beatValue *= Math.exp(-dt / BEAT_DECAY_MS);
    if (beatValue < 0.01) beatValue = 0;
  }

  return { low, mid, high, total, beat: beatValue, sinceBeat, flux };
}
