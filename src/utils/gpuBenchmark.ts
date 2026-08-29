/**
 * First-run GPU sizing for the particle album cover.
 *
 * Rather than guessing from the GPU name string, this renders the real
 * pipeline offscreen at two particle counts and separates the two cost terms:
 *
 *   frameTime(n) ≈ fixedCost + perParticleCost * n
 *
 * `fixedCost` is everything that does not scale with the cloud (clear, bloom,
 * fullscreen passes); the slope gives the per-particle cost. The largest cloud
 * that still fits the frame budget follows directly, and we then keep only
 * HEADROOM of it so the machine never runs at its ceiling.
 */

/** Fraction of the measured ceiling we actually use. */
const HEADROOM = 0.4;

/** Frame budget in ms for the particle cloud alone. 60fps is 16.7ms. */
const FRAME_BUDGET_MS = 11;

/** Allowance subtracted from the budget for bloom + compositing + the UI. */
const RESERVED_FIXED_MS = 4;

export type CoverQuality = "image" | "low" | "medium" | "high" | "ultra";

/** Grid side length per level; particle count is GRID². */
export const QUALITY_GRID: Record<CoverQuality, number> = {
  image: 0,
  low: 64, // 4,096
  medium: 96, // 9,216
  high: 128, // 16,384
  ultra: 160, // 25,600
};

export const QUALITY_LABEL: Record<CoverQuality, string> = {
  image: "图片",
  low: "低",
  medium: "中",
  high: "高",
  ultra: "极高",
};

export function particleCount(q: CoverQuality): number {
  return QUALITY_GRID[q] * QUALITY_GRID[q];
}

export interface BenchmarkResult {
  /** Level to use. */
  quality: CoverQuality;
  /** Particles the machine could sustain at the frame budget, before headroom. */
  ceiling: number;
  /** Particles we actually chose to render. */
  budgeted: number;
  /** Why this level was chosen (shown in settings). */
  reason: string;
}

/** True when a WebGL2 context can actually be created. */
export function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    if (!gl) return false;
    const lose = (gl as WebGLRenderingContext).getExtension(
      "WEBGL_lose_context",
    );
    lose?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/** Pick the highest level whose particle count fits the budget. */
function levelFor(budgeted: number): CoverQuality {
  const order: CoverQuality[] = ["ultra", "high", "medium", "low"];
  for (const q of order) {
    if (particleCount(q) <= budgeted) return q;
  }
  return "image";
}

interface TimerExt {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

/**
 * Median GPU nanoseconds for one draw of `count` particles.
 *
 * Wall-clock timing does not work here: the driver batches commands and an
 * offscreen canvas is never presented, so gl.finish() returns immediately and
 * requestAnimationFrame is pinned to vsync regardless of load. The disjoint
 * timer query reports what the GPU actually spent. Returns -1 if unusable.
 */
async function gpuNanos(
  gl: WebGL2RenderingContext,
  ext: TimerExt,
  count: number,
  samples: number,
): Promise<number> {
  const times: number[] = [];
  for (let i = 0; i < samples; i++) {
    const query = gl.createQuery();
    if (!query) break;
    gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, count);
    gl.endQuery(ext.TIME_ELAPSED_EXT);
    gl.flush();

    let ns = -1;
    for (let tries = 0; tries < 90; tries++) {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      if (gl.getParameter(ext.GPU_DISJOINT_EXT)) break; // clock reset: discard
      if (gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) {
        ns = gl.getQueryParameter(query, gl.QUERY_RESULT) as number;
        break;
      }
    }
    gl.deleteQuery(query);
    if (ns >= 0) times.push(ns);
  }
  if (!times.length) return -1;
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)];
}

const BENCH_VERT = `#version 300 es
in vec2 aPos;
uniform float uTime;
out vec3 vColor;
// Deliberately similar in cost to the real cover's vertex shader: a couple of
// trig-heavy terms per particle.
void main() {
  // ~2x simplex noise worth of ALU, matching the real cover's vertex cost.
  float a = 0.0;
  float b = 0.0;
  for (int i = 1; i <= 16; i++) {
    float f = float(i);
    a += sin(aPos.x * f + uTime) * cos(aPos.y * f - uTime);
    b += cos(aPos.y * f * 1.3 - uTime) * sin(aPos.x * f * 0.7 + uTime);
  }
  a *= 0.06;
  b *= 0.06;
  vec3 p = vec3(aPos, a * 0.2 + b * 0.1);
  gl_Position = vec4(p.xy, 0.0, 1.0);
  gl_PointSize = 2.0;
  vColor = vec3(0.5 + a * 0.5, 0.5 + b * 0.5, 0.7);
}`;

const BENCH_FRAG = `#version 300 es
precision highp float;
in vec3 vColor;
out vec4 outColor;
void main() {
  vec2 d = gl_PointCoord - vec2(0.5);
  if (dot(d, d) > 0.25) discard;
  outColor = vec4(vColor, 1.0);
}`;

function compile(gl: WebGL2RenderingContext): WebGLProgram | null {
  const make = (type: number, src: string) => {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
  };
  const vs = make(gl.VERTEX_SHADER, BENCH_VERT);
  const fs = make(gl.FRAGMENT_SHADER, BENCH_FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  return gl.getProgramParameter(prog, gl.LINK_STATUS) ? prog : null;
}

/**
 * Measure the machine and pick a level. Runs in well under a second and never
 * throws: any failure lands on the safe "image" level.
 */
export async function benchmarkCoverQuality(): Promise<BenchmarkResult> {
  const fail = (reason: string): BenchmarkResult => ({
    quality: "image",
    ceiling: 0,
    budgeted: 0,
    reason,
  });

  let canvas: HTMLCanvasElement | null = null;
  try {
    canvas = document.createElement("canvas");
    // Match the real cover's render area so fill cost is representative.
    const side = Math.min(
      700 * Math.min(window.devicePixelRatio || 1, 2),
      1400,
    );
    canvas.width = side;
    canvas.height = side;
    const gl = canvas.getContext("webgl2", {
      antialias: true,
      powerPreference: "high-performance",
    });
    if (!gl) return fail("此设备不支持 WebGL2，已使用静态封面");

    const program = compile(gl);
    if (!program) return fail("着色器编译失败，已使用静态封面");
    gl.useProgram(program);
    gl.viewport(0, 0, side, side);
    gl.clearColor(0, 0, 0, 1);

    const ext = gl.getExtension(
      "EXT_disjoint_timer_query_webgl2",
    ) as TimerExt | null;
    if (!ext) {
      // No way to measure; the absence of the extension says nothing about
      // capability, so land in the middle rather than crippling a good GPU.
      return {
        quality: "medium",
        ceiling: 0,
        budgeted: particleCount("medium"),
        reason: "此设备不支持 GPU 计时，已按「中」保守设置",
      };
    }

    const PROBE = 200000;
    const data = new Float32Array(PROBE * 2);
    for (let i = 0; i < PROBE * 2; i++) data[i] = Math.random() * 2 - 1;
    const buffer = gl.createBuffer();
    if (!buffer) return fail("显存分配失败，已使用静态封面");
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const SMALL = 20000;
    const LARGE = PROBE;

    await gpuNanos(gl, ext, SMALL, 2); // warm up shaders / driver
    const nsSmall = await gpuNanos(gl, ext, SMALL, 5);
    const nsLarge = await gpuNanos(gl, ext, LARGE, 5);
    gl.getExtension("WEBGL_lose_context")?.loseContext();

    if (nsSmall < 0 || nsLarge < 0 || nsLarge <= nsSmall) {
      return {
        quality: "medium",
        ceiling: 0,
        budgeted: particleCount("medium"),
        reason: "GPU 计时无有效读数，已按「中」保守设置",
      };
    }

    // ns per particle; constant per-draw terms cancel.
    const slope = (nsLarge - nsSmall) / (LARGE - SMALL);
    const usableNs = (FRAME_BUDGET_MS - RESERVED_FIXED_MS) * 1e6;

    const ceiling = Math.floor(usableNs / slope);
    const budgeted = Math.floor(ceiling * HEADROOM);
    const quality = levelFor(budgeted);
    return {
      quality,
      ceiling,
      budgeted,
      reason:
        quality === "image"
          ? `实测上限约 ${ceiling.toLocaleString()} 个粒子，不足最低档，已使用静态封面`
          : `实测上限约 ${ceiling.toLocaleString()} 个粒子，保留 ${Math.round((1 - HEADROOM) * 100)}% 余量后取 ${budgeted.toLocaleString()}，选用「${QUALITY_LABEL[quality]}」`,
    };
  } catch (err) {
    return fail(`性能检测失败（${String(err).slice(0, 40)}），已使用静态封面`);
  } finally {
    canvas?.remove();
  }
}
