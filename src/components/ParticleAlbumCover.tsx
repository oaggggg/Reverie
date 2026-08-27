import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type { ParticleEffect } from "../store/playerStore";
import { readBands } from "../utils/audioAnalyser";
import { PARTICLE_FRAGMENT, PARTICLE_VERTEX } from "./particleShaders";

interface ParticleAlbumCoverProps {
  imageUrl: string;
  effect: ParticleEffect;
  /** Sampling grid side; the cloud holds grid² particles. */
  grid: number;
  /** Called once when this machine clearly cannot sustain the current level. */
  onOverload?: () => void;
  onDoubleClick?: () => void;
}

/** Below this the bloom pass costs more than the cloud it decorates. */
const BLOOM_MIN_GRID = 130;

/** World size of the particle plane. */
const PLANE = 4;

/** Per-effect targets, lerped towards so switching never snaps. */
const EFFECT_TARGETS: Record<
  ParticleEffect,
  { amp: number; freq: number; speed: number }
> = {
  none: { amp: 0, freq: 0.9, speed: 0.2 },
  spin: { amp: 0.05, freq: 0.9, speed: 0.12 },
  wave: { amp: 0.2, freq: 0.8, speed: 0.3 },
  audio: { amp: 0.3, freq: 1.0, speed: 0.3 },
  orbit: { amp: 0.12, freq: 1.2, speed: 0.46 },
  ripple: { amp: 0.28, freq: 1.8, speed: 0.36 },
  shimmer: { amp: 0.08, freq: 2.6, speed: 0.72 },
};

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

export default function ParticleAlbumCover({
  imageUrl,
  effect,
  grid,
  onOverload,
  onDoubleClick,
}: ParticleAlbumCoverProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Both callbacks/props are read through refs so neither can re-trigger the
  // effect below: rebuilding the scene costs a renderer, a composer and a
  // texture decode, and the parent re-renders on every playback tick.
  const onDoubleClickRef = useRef(onDoubleClick);
  const effectRef = useRef(effect);
  const onOverloadRef = useRef(onOverload);
  useEffect(() => {
    onOverloadRef.current = onOverload;
  }, [onOverload]);
  useEffect(() => {
    onDoubleClickRef.current = onDoubleClick;
  }, [onDoubleClick]);
  useEffect(() => {
    effectRef.current = effect;
  }, [effect]);

  useEffect(() => {
    if (!containerRef.current) return;
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
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.z = 4.2;

    /** CSS px per world unit at unit distance, for gl_PointSize. */
    const projScale = () =>
      height / (2 * Math.tan(((camera.fov / 2) * Math.PI) / 180));

    const renderer = new THREE.WebGLRenderer({ antialias: useBloom });
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 1);
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
    geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    geometry.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(),
      PLANE, // fixed: displacement happens on the GPU, so auto-bounds would clip
    );

    const uniforms = {
      uTime: { value: 0 },
      uAmp: { value: 0 },
      uFreq: { value: 0.9 },
      uSpeed: { value: 0.2 },
      uPulse: { value: 0 },
      uShimmer: { value: 0 },
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

    // --- colours from the cover
    const img = new Image();
    img.crossOrigin = "anonymous";
    let disposed = false;
    img.onload = () => {
      if (disposed) return;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      canvas.width = GRID;
      canvas.height = GRID;
      ctx.drawImage(img, 0, 0, GRID, GRID);
      const { data } = ctx.getImageData(0, 0, GRID, GRID);
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const px = i * 4;
        // OutputPass converts linear->sRGB on the way out; the direct path
        // has no such step, so feed it the sRGB values unchanged.
        const conv = useBloom ? srgbToLinear : (c: number) => c;
        colors[i * 3] = conv(data[px] / 255);
        colors[i * 3 + 1] = conv(data[px + 1] / 255);
        colors[i * 3 + 2] = conv(data[px + 2] / 255);
      }
      geometry.attributes.aColor.needsUpdate = true;
      // Release the temporary CPU-side raster as soon as the attribute upload
      // has been queued. The WebGL buffer owns the data from this point on.
      canvas.width = 0;
      canvas.height = 0;
    };
    img.onerror = () => {
      // Avoid retaining a failed image request until the scene is destroyed.
      img.onload = null;
    };
    img.src = imageUrl;

    // --- drag to rotate, double click to reset
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
    };
    const finishDrag = (e: PointerEvent) => {
      isDragging = false;
      if (el.hasPointerCapture(e.pointerId)) {
        el.releasePointerCapture(e.pointerId);
      }
    };
    const onDblClick = () => {
      target.x = 0;
      target.y = 0;
      onDoubleClickRef.current?.();
    };
    const el = renderer.domElement;
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", finishDrag);
    el.addEventListener("pointercancel", finishDrag);
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

    let spin = 0;
    let pulse = 0;
    let shimmer = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      // 卸载后可能有已调度的帧或 visibilitychange 触发的补帧，此处硬停。
      if (disposed || isBackgrounded()) {
        running = false;
        return;
      }
      running = true;
      frameId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.1);
      const eff = effectRef.current;
      const preset = EFFECT_TARGETS[eff];

      let ampTarget = preset.amp;
      let speedTarget = preset.speed;

      if (eff === "audio") {
        const bands = readBands();
        if (bands) {
          pulse += (bands.total - pulse) * 0.18;
          shimmer += (bands.high - shimmer) * 0.15;
          ampTarget = 0.12 + bands.low * 1;
          speedTarget = 0.25 + bands.high * 0.7;
        } else {
          // no spectrum available: behave like the plain wave
          pulse += (0 - pulse) * 0.1;
          shimmer += (0 - shimmer) * 0.1;
          ampTarget = EFFECT_TARGETS.wave.amp;
          speedTarget = EFFECT_TARGETS.wave.speed;
        }
      } else {
        pulse += (0 - pulse) * 0.1;
        shimmer += (0 - shimmer) * 0.1;
      }

      uniforms.uTime.value += dt;
      uniforms.uAmp.value += (ampTarget - uniforms.uAmp.value) * 0.06;
      uniforms.uSpeed.value += (speedTarget - uniforms.uSpeed.value) * 0.06;
      uniforms.uFreq.value += (preset.freq - uniforms.uFreq.value) * 0.06;
      uniforms.uPulse.value = pulse;
      uniforms.uShimmer.value = shimmer;
      if (useBloom) bloom.strength = 0.14 + pulse * 0.16;

      if (eff === "spin") spin += 0.0022;
      if (eff === "orbit") spin += 0.0048;
      rotation.x += (target.x - rotation.x) * 0.1;
      rotation.y += (target.y - rotation.y) * 0.1;
      particles.rotation.x = rotation.x;
      particles.rotation.y = rotation.y + spin;

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

      if (!watchdogFired) {
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
      img.onload = null;
      img.onerror = null;
      img.src = "";
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onVisibilityChange);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", finishDrag);
      el.removeEventListener("pointercancel", finishDrag);
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
  }, [imageUrl, grid]);

  return <div ref={containerRef} className="particle-album-cover" />;
}
