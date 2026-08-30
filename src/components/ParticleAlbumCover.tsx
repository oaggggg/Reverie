import { memo, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { readRhythm } from "../utils/audioAnalyser";
import { PARTICLE_FRAGMENT, PARTICLE_VERTEX } from "./particleShaders";

interface ParticleAlbumCoverProps {
  imageUrl: string;
  /** Sampling grid side; the cloud holds grid² particles. */
  grid: number;
  /** 渲染帧率上限；0 = 跟随显示器刷新率。 */
  fpsLimit?: number;
  /** 律动幅度系数 0~1.5（DIY 可调），乘在节奏驱动的位移与节拍冲击上。 */
  rhythmGain?: number;
  /** 虚空等场景暂时隐藏时置 true：跳过渲染但保持场景挂载，切回零重建。 */
  paused?: boolean;
  /** Visual playback is inactive; keep the last frame but stop all animation work. */
  active?: boolean;
  /** Shared wake listeners used by the lyric layers during pointer motion. */
  motionListenersRef?: { current: Set<() => void> };
  /**
   * 父组件持有的共享旋转。拖拽粒子封面时逐帧写入（含自转分量），
   * 3D 歌词层每帧读取同一份数据，保证歌词与封面是一体的。
   */
  rotationRef?: { current: { x: number; y: number } };
  /**
   * 父组件持有的共享缩放。滚轮推拉相机后逐帧写入
   * （静息为 1，推近大于 1），3D 歌词层读取同一份数据一起缩放。
   */
  zoomRef?: { current: number };
  /** Called once when this machine clearly cannot sustain the current level. */
  onOverload?: () => void;
  onDoubleClick?: () => void;
}

/** Below this the bloom pass costs more than the cloud it decorates. */
const BLOOM_MIN_GRID = 150;

/** World size of the particle plane. */
const PLANE = 4;

/** sRGB -> linear, so OutputPass converts back to the album's true colours. */
function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Sustained frame time above this (≈36fps) means the level is too high. */
const OVERLOAD_FRAME_MS = 28;
/** Foreground-only warmup, excluding shader compile and the texture upload. */
const WATCHDOG_WARMUP_MS = 1500;
/** Foreground-only sampling window after the warmup. */
const WATCHDOG_WINDOW_MS = 2500;
/** Fewer frames than this inside the window is itself proof of overload. */
const WATCHDOG_MIN_FRAMES = 6;
/**
 * A gap longer than this is a stall, not a slow frame, and must not be
 * measured. Even software rasterisation of the largest cloud lands near 400ms,
 * while a minimised window, an occluded one, or a sleeping machine produces
 * multi-second gaps. macOS in particular throttles a minimised window without
 * ever setting document.hidden, so the visibility check alone is not enough.
 */
const WATCHDOG_MAX_GAP_MS = 1000;

/** 相机静息距离：滚轮缩放围绕该值推拉。 */
const CAMERA_Z_REST = 4.2;

function ParticleAlbumCover({
  imageUrl,
  grid,
  fpsLimit = 0,
  rhythmGain = 0.55,
  paused = false,
  active = true,
  rotationRef,
  zoomRef,
  motionListenersRef,
  onOverload,
  onDoubleClick,
}: ParticleAlbumCoverProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Both callbacks/props are read through refs so neither can re-trigger the
  // effect below: rebuilding the scene costs a renderer, a composer and a
  // texture decode, and the parent re-renders on every playback tick.
  const onDoubleClickRef = useRef(onDoubleClick);
  const onOverloadRef = useRef(onOverload);
  const fpsLimitRef = useRef(fpsLimit);
  const rhythmGainRef = useRef(rhythmGain);
  const pausedRef = useRef(paused);
  const activeRef = useRef(active);
  const zoomTargetRef = useRef(0);
  useEffect(() => {
    onOverloadRef.current = onOverload;
  }, [onOverload]);
  useEffect(() => {
    onDoubleClickRef.current = onDoubleClick;
  }, [onDoubleClick]);
  useEffect(() => {
    fpsLimitRef.current = fpsLimit;
  }, [fpsLimit]);
  useEffect(() => {
    rhythmGainRef.current = rhythmGain;
  }, [rhythmGain]);
  useEffect(() => {
    pausedRef.current = paused;
    activeRef.current = active;
    if (!paused && active) wakeRef.current?.();
  }, [active, paused]);

  const wakeRef = useRef<(() => void) | null>(null);

  // 深度休眠：页面隐藏持续 60s 后整体卸载 WebGL 场景（cleanup 会
  // dispose 全部资源并 forceContextLoss，显存全额释放），恢复可见时
  // 重建。着色器与纹理缓存仍热，重建在亚秒级；后台长时间挂机时
  // 播放页的 GPU 占用归零。
  const [deepSleep, setDeepSleep] = useState(false);
  useEffect(() => {
    const HIDE_SLEEP_MS = 60_000;
    let timer = 0;
    const onVis = () => {
      window.clearTimeout(timer);
      if (document.hidden) {
        timer = window.setTimeout(() => setDeepSleep(true), HIDE_SLEEP_MS);
      } else {
        setDeepSleep(false);
      }
    };
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // 场景对象跨 imageUrl 复用：换歌只重采样颜色，绝不重建 WebGL 上下文。
  // 反复 forceContextLoss + 重建是切歌时整个 WebView 白屏一瞬的元凶。
  const recolorRef = useRef<{
    colors: Float32Array;
    attr: THREE.BufferAttribute;
    count: number;
    conv: (c: number) => number;
  } | null>(null);

  useEffect(() => {
    // 深度休眠时不持有任何 WebGL 资源。
    if (!containerRef.current || deepSleep) return;
    const container = containerRef.current;
    const GRID = Math.max(16, Math.min(grid, 160)); // 限制最大网格防止内存爆炸
    const PARTICLE_COUNT = GRID * GRID;
    const useBloom = GRID >= BLOOM_MIN_GRID;
    let width = container.clientWidth;
    let height = container.clientHeight;
    // Fill rate, not particle count, is what sinks a weak GPU: the render
    // area scales with the square of the pixel ratio. Cap it by tier.
    const maxRatio = GRID >= 160 ? 1.5 : GRID >= 130 ? 1.2 : 1;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, maxRatio);

    const scene = new THREE.Scene();
    let disposed = false;
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.z = CAMERA_Z_REST;

    /** CSS px per world unit at unit distance, for gl_PointSize. */
    const projScale = () =>
      height / (2 * Math.tan(((camera.fov / 2) * Math.PI) / 180));

    // alpha 画布：粒子间隙透出反歌词层（正歌词 -> 粒子封面 -> 反歌词）。
    const renderer = new THREE.WebGLRenderer({ antialias: useBloom, alpha: true });
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // --- geometry: a flat grid, coloured from the cover, displaced in the shader
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const seeds = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const row = Math.floor(i / GRID);
      const col = i % GRID;
      positions[i * 3] = (col / (GRID - 1) - 0.5) * PLANE;
      positions[i * 3 + 1] = -(row / (GRID - 1) - 0.5) * PLANE;
      positions[i * 3 + 2] = 0;
      seeds[i] = Math.random();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const colorAttr = new THREE.BufferAttribute(colors, 3);
    geometry.setAttribute("aColor", colorAttr);
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    geometry.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(),
      PLANE, // fixed: displacement happens on the GPU, so auto-bounds would clip
    );

    const uniforms = {
      uTime: { value: 0 },
      uAmp: { value: 0.08 },
      uFreq: { value: 0.9 },
      uSpeed: { value: 0.25 },
      uPulse: { value: 0 },
      uShimmer: { value: 0 },
      uBeat: { value: 0 },
      // Keep a little breathing room between points. Oversized sprites make
      // bright areas merge into a solid white mass once bloom is applied.
      uSize: { value: (PLANE / GRID) * 1.08 },
      uProjScale: { value: 1 },
      uPixelRatio: { value: pixelRatio },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: PARTICLE_VERTEX,
      fragmentShader: PARTICLE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    uniforms.uProjScale.value = projScale();

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // --- restrained bloom: a highlight, not a second exposure of the cover
    // Without bloom there is nothing to post-process, and going through the
    // composer would still cost a full-screen render target plus an OutputPass
    // blit every frame.
    const composer = useBloom ? new EffectComposer(renderer) : null;
    composer?.setPixelRatio(pixelRatio);
    composer?.setSize(width, height);
    composer?.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.16, // strength
      0.28, // radius
      0.82, // threshold: preserve detail in bright parts of the artwork
    );
    if (useBloom) composer?.addPass(bloom);
    composer?.addPass(new OutputPass());

    // 换歌重采样所需的上下文交给 recolorRef，imageUrl effect 通过它复用场景。
    recolorRef.current = {
      colors,
      attr: colorAttr,
      count: PARTICLE_COUNT,
      conv: useBloom ? srgbToLinear : (c: number) => c,
    };

    // --- drag to rotate, wheel to zoom, double click to reset
    let isDragging = false;
    let previous = { x: 0, y: 0 };
    const rotation = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      previous = { x: e.clientX, y: e.clientY };
      // Keep receiving move/up events after the pointer leaves the canvas.
      // Without capture, releasing outside leaves the cover stuck in drag mode.
      el.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      target.y += (e.clientX - previous.x) * 0.01;
      target.x += (e.clientY - previous.y) * 0.01;
      previous = { x: e.clientX, y: e.clientY };
      wakeRef.current?.();
    };
    const finishDrag = (e: PointerEvent) => {
      isDragging = false;
      if (el.hasPointerCapture(e.pointerId)) {
        el.releasePointerCapture(e.pointerId);
      }
    };
    const onWheel = (e: WheelEvent) => {
      // deltaY 向下滚 = 拉远（缩小），向上滚 = 推近（放大）。
      const t = zoomTargetRef.current + e.deltaY * 0.0016;
      zoomTargetRef.current = Math.max(-1.9, Math.min(2.6, t));
      wakeRef.current?.();
    };
    const onDblClick = () => {
      target.x = 0;
      target.y = 0;
      zoomTargetRef.current = 0;
      onDoubleClickRef.current?.();
    };
    const el = renderer.domElement;
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", finishDrag);
    el.addEventListener("pointercancel", finishDrag);
    el.addEventListener("wheel", onWheel, { passive: true });
    el.addEventListener("dblclick", onDblClick);

    // --- animation
    // The benchmark predicts; this checks. A static probe cannot model every
    // driver, so measure what the machine actually achieves and step down if
    // the chosen level does not hold up.
    // Counting frames would never conclude on the machines that need this
    // most: at 2fps a 180-frame window takes 90 seconds. So judge by time —
    // but only time the window actually spent on screen. A backgrounded window
    // is throttled or stopped outright, and letting that count would read as
    // "no frames arrived" and demote a perfectly capable GPU.
    const watchdogGaps: number[] = [];
    let watchdogVisibleMs = 0;
    let watchdogFired = false;
    let watchdogLast = performance.now();
    // The first gap after mounting, and after every visibility change, spans a
    // pause rather than a rendered frame.
    let watchdogSkipGap = true;
    let frameId = 0;
    let running = false;
    // Losing window focus (for example when using another app) must not stop
    // the player scene. Only a truly hidden document is backgrounded; audio
    // playback and the visible scene continue while the desktop window is
    // unfocused.
    const isBackgrounded = () => document.hidden;
    const onVisibilityChange = () => {
      watchdogSkipGap = true;
      if (isBackgrounded()) {
        cancelAnimationFrame(frameId);
        frameId = 0;
        running = false;
      } else if (!running) {
        animate();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onVisibilityChange);

    let pulse = 0;
    let shimmer = 0;
    let beat = 0;
    const clock = new THREE.Clock();

    // 帧率上限：不到间隔就不渲染，rAF 仍然照常调度；耗时统计跨帧累计。
    let lastRender = performance.now();
    let pendingDt = 0;

    const renderOnce = () => {
      try {
        if (composer) composer.render();
        else renderer.render(scene, camera);
      } catch {
        // Context loss is handled by the normal cleanup path.
      }
    };

    const animate = () => {
      // 卸载后可能有已调度的帧或 visibilitychange 触发的补帧，此处硬停。
      if (disposed || isBackgrounded() || pausedRef.current || !activeRef.current) {
        running = false;
        if (!disposed && !isBackgrounded()) renderOnce();
        return;
      }
      running = true;
      frameId = requestAnimationFrame(animate);
      const rawDt = Math.min(clock.getDelta(), 0.1);
      const limit = fpsLimitRef.current;
      let dt = rawDt;
      if (limit > 0) {
        pendingDt += rawDt;
        const now = performance.now();
        // 1.5ms 容差吸收 rAF 抖动，避免 60Hz 屏上锁 60fps 时隔帧渲染。
        if (now - lastRender < 1000 / limit - 1.5) return;
        lastRender = now;
        dt = Math.min(pendingDt, 0.1);
        pendingDt = 0;
      }
      // 律动完全由歌曲节奏分析驱动（无效果预设、无自转）：
      // 频谱三段能量提供基础起伏，节拍冲击提供"炸开-归位"的打击感；
      // 拿不到频谱（未播放 / CORS 限制）时退化为缓慢呼吸，保持画面 alive。
      const rhythm = readRhythm();
      const gain = rhythmGainRef.current;
      let ampTarget: number;
      let speedTarget: number;
      let freqTarget: number;
      if (rhythm) {
        pulse += (Math.min(1, rhythm.total * 1.25) - pulse) * 0.18;
        shimmer += (Math.min(1, rhythm.high * 1.5) - shimmer) * 0.15;
        // beat 上升沿快跟、衰减段慢放，突出打击感。
        beat += (rhythm.beat - beat) * (rhythm.beat > beat ? 0.55 : 0.14);
        ampTarget = (0.06 + rhythm.low * 0.5 + rhythm.beat * 0.28) * gain;
        speedTarget = 0.22 + rhythm.mid * 0.55;
        freqTarget = 0.9 + rhythm.mid * 0.7;
      } else {
        const breath = 0.18 + Math.sin(uniforms.uTime.value * 1.1) * 0.1;
        pulse += (breath * 0.4 - pulse) * 0.05;
        shimmer += (0 - shimmer) * 0.1;
        beat += (0 - beat) * 0.1;
        ampTarget = 0.1 * Math.max(gain, 0.4);
        speedTarget = 0.2;
        freqTarget = 0.9;
      }

      uniforms.uTime.value += dt;
      uniforms.uAmp.value += (ampTarget - uniforms.uAmp.value) * 0.08;
      uniforms.uSpeed.value += (speedTarget - uniforms.uSpeed.value) * 0.06;
      uniforms.uFreq.value += (freqTarget - uniforms.uFreq.value) * 0.06;
      uniforms.uPulse.value = pulse;
      uniforms.uShimmer.value = shimmer;
      // uBeat 平滑逼近目标值：节拍包络本身带冲击，直接写入会显得卡顿，
      // 这里做一帧惯性让"打击感"变成"荡开感"。
      const beatTarget = beat * gain;
      uniforms.uBeat.value += (beatTarget - uniforms.uBeat.value) * 0.22;
      if (useBloom) bloom.strength = 0.14 + pulse * 0.16 + beat * 0.1;

      rotation.x += (target.x - rotation.x) * 0.1;
      rotation.y += (target.y - rotation.y) * 0.1;
      particles.rotation.x = rotation.x;
      particles.rotation.y = rotation.y;

      // 滚轮缩放：推拉相机，同样做平滑插值。
      const zoomTarget = -zoomTargetRef.current;
      camera.position.z +=
        (CAMERA_Z_REST + zoomTarget - camera.position.z) * 0.12;

      // 歌词层每帧读取同一旋转，封面与歌词保持一体。
      if (rotationRef) {
        rotationRef.current.x = rotation.x;
        rotationRef.current.y = rotation.y;
      }
      // 缩放同样共享给歌词层：相机推近时歌词一起放大。
      if (zoomRef) {
        zoomRef.current = CAMERA_Z_REST / camera.position.z;
      }

      const moved =
        Math.abs(rotation.x - target.x) > 0.0001 ||
        Math.abs(rotation.y - target.y) > 0.0001 ||
        Math.abs(camera.position.z - (CAMERA_Z_REST - zoomTargetRef.current)) > 0.001;
      if (moved) motionListenersRef?.current.forEach((listener) => listener());

      // 渲染管线损坏（如 WebGL 上下文丢失后属性被置空）时每帧都会抛错，
      // 先调度后渲染的循环结构会让异常无限续帧；渲染失败即终止循环。
      try {
        if (composer) composer.render();
        else renderer.render(scene, camera);
      } catch {
        cancelAnimationFrame(frameId);
        frameId = 0;
        running = false;
        return;
      }

      // 帧率被主动限制时，帧间隔反映的是设置而非 GPU 能力，看门狗失真。
      if (!watchdogFired && fpsLimitRef.current === 0) {
        const now = performance.now();
        const gap = now - watchdogLast;
        watchdogLast = now;
        if (document.hidden || gap > WATCHDOG_MAX_GAP_MS) {
          // Throttled or stalled: this frame says nothing about the GPU.
          watchdogSkipGap = true;
        } else if (watchdogSkipGap) {
          watchdogSkipGap = false;
        } else {
          watchdogVisibleMs += gap;
          if (watchdogVisibleMs > WATCHDOG_WARMUP_MS) watchdogGaps.push(gap);
          if (watchdogVisibleMs > WATCHDOG_WARMUP_MS + WATCHDOG_WINDOW_MS) {
            watchdogFired = true;
            if (watchdogGaps.length < WATCHDOG_MIN_FRAMES) {
              // Too few frames to even form a sample: unambiguously too slow.
              onOverloadRef.current?.();
            } else {
              const sorted = [...watchdogGaps].sort((a, b) => a - b);
              const median = sorted[Math.floor(sorted.length / 2)];
              if (median > OVERLOAD_FRAME_MS) onOverloadRef.current?.();
            }
          }
        }
      }
    };
    wakeRef.current = () => {
      if (!running && !disposed && !isBackgrounded() && !pausedRef.current && activeRef.current) {
        animate();
      }
    };
    animate();

    const handleResize = () => {
      width = container.clientWidth;
      height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      composer?.setSize(width, height);
      if (useBloom) bloom.setSize(width, height);
      uniforms.uProjScale.value = projScale();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      disposed = true;
      wakeRef.current = null;
      recolorRef.current = null;
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onVisibilityChange);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", finishDrag);
      el.removeEventListener("pointercancel", finishDrag);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("dblclick", onDblClick);
      container.removeChild(el);

      // 彻底清理 Three.js 资源
      geometry.dispose();
      material.dispose();
      composer?.dispose();

      // 强制释放 WebGL 上下文和 TypedArray 内存
      renderer.forceContextLoss();
      renderer.dispose();

      // Remove attribute references after disposal so the CPU-side buffers can
      // be collected without bypassing Three.js types.
      geometry.deleteAttribute("position");
      geometry.deleteAttribute("aColor");
      geometry.deleteAttribute("aSeed");
    };
    // grid changes the buffer layout, so rebuilding on it is correct.
    // imageUrl 不在此列：换歌走独立的重采样 effect，不重建场景。
    // deepSleep：休眠即卸载场景，唤醒重建。
  }, [grid, rotationRef, deepSleep]);

  // 换歌：复用现有场景，仅重采样封面颜色。加载完成前保留上一首的颜色，
  // 避免粒子云闪空。grid 变化时场景重建、此 effect 随后重新填充颜色。
  useEffect(() => {
    let disposed = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const ctxHolder = recolorRef.current;
      if (disposed || !ctxHolder) return;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      const side = Math.round(Math.sqrt(ctxHolder.count));
      canvas.width = side;
      canvas.height = side;
      ctx.drawImage(img, 0, 0, side, side);
      const { data } = ctx.getImageData(0, 0, side, side);
      const { colors, attr, count, conv } = ctxHolder;
      for (let i = 0; i < count; i++) {
        const px = i * 4;
        // OutputPass converts linear->sRGB on the way out; the direct path
        // has no such step, so feed it the sRGB values unchanged.
        colors[i * 3] = conv(data[px] / 255);
        colors[i * 3 + 1] = conv(data[px + 1] / 255);
        colors[i * 3 + 2] = conv(data[px + 2] / 255);
      }
      attr.needsUpdate = true;
      // A paused scene renders once; wake it after the asynchronous colour
      // upload so a paused player still shows the correct cover.
      wakeRef.current?.();
      // Release the temporary CPU-side raster as soon as the attribute upload
      // has been queued. The WebGL buffer owns the data from this point on.
      canvas.width = 0;
      canvas.height = 0;
    };
    img.onerror = () => {
      // 失败时保留上一首的颜色即可，无需清理（scene 复用中）。
      img.onload = null;
    };
    img.src = imageUrl;

    return () => {
      disposed = true;
      img.onload = null;
      img.onerror = null;
      img.src = "";
    };
    // deepSleep：深度休眠唤醒后场景重建，需重新采样颜色。
  }, [imageUrl, grid, deepSleep]);

  return <div ref={containerRef} className="particle-album-cover" />;
}

export default memo(ParticleAlbumCover);
