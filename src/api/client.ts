import type {
  LoginStatusResponse,
  LyricResponse,
  PlaylistInfo,
  QrCheckResponse,
  QrCreateResponse,
  QrCreateResult,
  QrKeyResponse,
  SearchResponse,
  Song,
  PlaybackQuality,
  SongDetailResponse,
  SongUrlResponse,
  UserProfile,
} from "./types";

const API_BASE: string =
  (typeof window !== "undefined" && window.ncm?.apiBase) ||
  "http://127.0.0.1:3939";

const COOKIE_KEY = "ncm_player_cookie";

let cookie: string = "";
let authGeneration = 0;
try {
  cookie = localStorage.getItem(COOKIE_KEY) || "";
} catch {
  cookie = "";
}

export function getCookie(): string {
  return cookie;
}

/** 只保留身份相关的 Cookie 键，丢弃 Set-Cookie 属性噪声。 */
const IDENTITY_COOKIE_RE =
  /^(MUSIC_U|MUSIC_A|__csrf_token|NMTID|os|osver|appver|channel|deviceId)=/i;

/**
 * 清洗扫码接口返回的会话凭证：上游把多条 Set-Cookie 原始串直接
 * join(';')，里面混着 Path=/、Max-Age、带逗号的 GMT 时间等属性，
 * 整串存入 Cookie 头会污染服务端解析。只保留身份键值对；
 * 一个都认不出来时按原样返回兜底。
 */
export function sanitizeNcmCookie(raw: string): string {
  const text = String(raw ?? "");
  const pairs = text
    .split(/;\s*|\s*,\s*/)
    .map((piece) => piece.trim())
    .filter((piece) => IDENTITY_COOKIE_RE.test(piece));
  return pairs.length ? pairs.join("; ") : text.trim();
}

/** 会话凭证最近一次写入的时间戳：用于登录后的宽限期判断。 */
let cookieSetAt = 0;

export function isCookieFreshlySet(windowMs = 60_000): boolean {
  return cookieSetAt > 0 && Date.now() - cookieSetAt < windowMs;
}

export function setCookie(c: string): void {
  const value = sanitizeNcmCookie(c);
  if (cookie !== value) {
    authGeneration += 1;
    clearResponseCache();
  }
  cookie = value;
  cookieSetAt = Date.now();
  try {
    localStorage.setItem(COOKIE_KEY, value);
  } catch {
    /* ignore */
  }
}

export function clearCookie(): void {
  if (cookie) {
    authGeneration += 1;
    clearResponseCache();
  }
  cookie = "";
  try {
    localStorage.removeItem(COOKIE_KEY);
  } catch {
    /* ignore */
  }
}

export interface RequestOptions {
  method?: "GET" | "POST";
  body?: BodyInit;
  headers?: HeadersInit;
  /** Override the per-attempt timeout for unusually slow endpoints. */
  timeoutMs?: number;
  /** Enable retries for a request that is not a safe GET. */
  retry?: boolean;
  /**
   * Send `params` as a typed JSON body instead of query-string values.
   * Needed when the upstream module embeds the params verbatim into an
   * outgoing JSON payload (e.g. listen-together commands): URL round-trips
   * would turn booleans and numbers into strings.
   */
  json?: boolean;
}

/* ------------------------------------------------------------------ */
/*  In-memory GET cache with in-flight dedup                          */
/* ------------------------------------------------------------------ */

interface CacheEntry {
  at: number;
  data: unknown;
}

const responseCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();
const MAX_CACHE_ENTRIES = 120;
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const MAX_GET_ATTEMPTS = 4;
const MAX_STALE_CACHE_AGE_MS = 6 * 60 * 60 * 1000;

class ApiRequestError extends Error {
  readonly status: number;
  readonly path: string;

  constructor(message: string, status: number, path: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.path = path;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelay(attempt: number): number {
  const backoff = Math.min(250 * 2 ** attempt, 2_000);
  return backoff + Math.floor(Math.random() * 120);
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof ApiRequestError) return isRetryableStatus(error.status);
  return error instanceof TypeError || error instanceof SyntaxError;
}

function cacheKey(path: string, params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  }
  return `${authGeneration}:${path}?${q.toString()}`;
}

/**
 * GET wrapper with a per-call TTL and single-flight dedup: identical
 * concurrent calls share one fetch, and fresh results are served from
 * memory without touching the local API server again.
 */
export async function cachedRequest<T>(
  path: string,
  params: Record<string, string | number | boolean | null | undefined>,
  ttlMs: number,
): Promise<T> {
  const key = cacheKey(path, params);
  const hit = responseCache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) {
    return hit.data as T;
  }
  const running = inFlight.get(key);
  if (running) return running as Promise<T>;
  const run = request<T>(path, params)
    .then((data) => {
      responseCache.set(key, { at: Date.now(), data });
      while (responseCache.size > MAX_CACHE_ENTRIES) {
        const oldest = responseCache.keys().next().value;
        if (oldest === undefined) break;
        responseCache.delete(oldest);
      }
      return data;
    })
    .catch((error) => {
      // Read-only data can remain useful during a short upstream outage. Never
      // use a stale entry beyond the bounded grace period or across auth scope.
      if (hit && Date.now() - hit.at < MAX_STALE_CACHE_AGE_MS) {
        return hit.data as T;
      }
      throw error;
    })
    .finally(() => {
      if (inFlight.get(key) === run) inFlight.delete(key);
    });
  inFlight.set(key, run);
  return run;
}

/** Drop cached entries (e.g. after login state changes). */
export function clearResponseCache(): void {
  responseCache.clear();
}

/**
 * Drop cached GET entries whose path matches one of the given prefixes.
 * Called after mutating operations so the next read observes fresh data
 * instead of a stale TTL entry (e.g. playlist tracks right after an edit).
 */
export function invalidateResponseCache(paths: string[]): void {
  for (const key of [...responseCache.keys()]) {
    const normalized = key.slice(key.indexOf(":") + 1);
    if (paths.some((p) => normalized.startsWith(p))) {
      responseCache.delete(key);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Local sidecar auth                                                 */
/* ------------------------------------------------------------------ */

/**
 * Per-launch shared secret between the Tauri shell and the local API
 * sidecar. Any HTTP request without it is rejected by the sidecar, so
 * random web pages cannot drive the user's NetEase account through
 * localhost even though the server listens on 127.0.0.1.
 */
let apiAuthToken = "";
/** 在首个请求发出前等待 token 注入完成（Tauri 环境）。 */
let apiAuthTokenReady: Promise<void> = Promise.resolve();

export function setApiAuthToken(token: string): void {
  apiAuthToken = token;
}

/**
 * 由 Tauri 壳层在启动时调用：从 Rust 侧取回本次运行的共享密钥。
 * 所有后续请求都会携带该密钥，本地 sidecar 拒绝其余来源。
 */
export function initApiAuthToken(provider: () => Promise<string>): void {
  apiAuthTokenReady = provider()
    .then((token) => {
      if (token) apiAuthToken = token;
    })
    .catch(() => {
      /* 非 Tauri 或命令失败：退回无密钥模式（sidecar 未启用鉴权时仍可用） */
    });
}

function authHeaders(base: HeadersInit | undefined): HeadersInit {
  const headers: Record<string, string> = {};
  if (base) Object.assign(headers, base as Record<string, string>);
  // Cookie travels in a header instead of the URL so the long-lived
  // MUSIC_U session never lands in logs or cache keys.
  if (cookie) headers["x-ncm-cookie"] = cookie;
  if (apiAuthToken) headers["x-reverie-auth"] = apiAuthToken;
  return headers;
}

export async function request<T = unknown>(
  path: string,
  params: Record<string, string | number | boolean | null | undefined> = {},
  cacheBust = true,
  options: RequestOptions = {},
): Promise<T> {
  await apiAuthTokenReady;
  const headers = authHeaders(options.headers);
  let url: string;
  let method: "GET" | "POST";
  let body: BodyInit | undefined;
  if (options.json) {
    // Typed JSON body keeps booleans/numbers intact for the upstream module.
    url = `${API_BASE}${path}`;
    method = "POST";
    body = JSON.stringify({
      ...params,
      ...(cacheBust ? { timestamp: Date.now() } : {}),
    });
  } else {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
    }
    // cookie 通过 x-ncm-cookie 请求头传递（见 authHeaders），
    // 不再拼进 URL，避免会话凭证泄漏到日志与缓存键。
    if (cacheBust) q.set("timestamp", String(Date.now()));
    const query = q.toString();
    url = `${API_BASE}${path}${query ? `?${query}` : ""}`;
    method = options.method ?? "GET";
    body = method === "GET" ? undefined : options.body;
  }
  const canRetry =
    (method === "GET" && !options.json) || options.retry === true;
  const attempts = canRetry ? MAX_GET_ATTEMPTS : 1;
  const timeoutMs = Math.max(
    1_000,
    Math.min(options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS, 120_000),
  );
  let lastError: unknown = new Error(`请求 ${path} 失败`);
  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const fetchOptions: RequestInit = {
      method,
      headers,
      body,
      signal: controller.signal,
    };
    try {
      const res = await fetch(url, fetchOptions);
      if (!res.ok) {
        const detail = (await res.text().catch(() => "")).trim();
        const suffix = detail ? `: ${detail.slice(0, 240)}` : "";
        throw new ApiRequestError(
          `HTTP ${res.status} for ${path}${suffix}`,
          res.status,
          path,
        );
      }
      if (res.status === 204) return {} as T;
      return (await res.json()) as T;
    } catch (error) {
      // AbortController timeouts must retain a retryable status. Converting
      // them to a generic Error makes GET retries silently stop on slow or
      // temporarily stalled sidecars.
      lastError = controller.signal.aborted
        ? new ApiRequestError(`请求 ${path} 超时`, 408, path)
        : error;
      if (attempt + 1 >= attempts || !isRetryableError(lastError))
        throw lastError;
      await sleep(retryDelay(attempt));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

/* ------------------------------------------------------------------ */
/*  Search & enrich                                                    */
/* ------------------------------------------------------------------ */

/**
 * 歌曲本身支持的最好音质等级（账号无关，用于列表音质标识）：
 * maxBrLevel / playMaxBrLevel / downloadMaxBrLevel 是官方下发的
 * 曲目最高支持档；行内布尔 jm/jymaster 作兜底映射为 jymaster。
 */
const LEVEL_RANK: Record<string, number> = {
  standard: 0,
  higher: 1,
  exhigh: 2,
  lossless: 3,
  hires: 4,
  dolby: 5,
  jyeffect: 6,
  jymaster: 7,
  sky: 8,
  vivid: 9,
};

function privilegeMaxLevel(
  p: Record<string, unknown> | null | undefined,
): string | null {
  if (!p || typeof p !== "object") return null;
  const candidates = [
    String(p.maxBrLevel ?? ""),
    String(p.playMaxBrLevel ?? ""),
    String(p.downloadMaxBrLevel ?? ""),
  ].filter((l) => l in LEVEL_RANK);
  if (candidates.length) {
    return candidates.reduce((a, b) => (LEVEL_RANK[b] > LEVEL_RANK[a] ? b : a));
  }
  if (p.jm ?? p.jymaster ?? p.master) return "jymaster";
  return null;
}

/** 用特权数据补全歌曲的「最好支持音质」标识字段（取两路较高者）。 */
function songWithMaxLevel(song: Song, p?: Record<string, unknown>): Song {
  if (!p) return song;
  const lvl = privilegeMaxLevel(p);
  if (!lvl) return song;
  const cur = song.maxLevel ? (LEVEL_RANK[song.maxLevel] ?? -1) : -1;
  if (LEVEL_RANK[lvl] <= cur) return song;
  return { ...song, master: lvl === "jymaster", maxLevel: lvl };
}

export function normalizeSong(raw: unknown): Song | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const id = Number(s.id);
  if (!Number.isSafeInteger(id) || id <= 0) return null;

  // artist(s): prefer `ar`/`artists`, accept both shapes
  let artistNames: string[] = [];
  const ar = s.ar as Array<Record<string, unknown>> | undefined;
  const artists = s.artists as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(ar) && ar.length) {
    artistNames = ar.map((a) => String(a?.name ?? "")).filter(Boolean);
  } else if (Array.isArray(artists) && artists.length) {
    artistNames = artists.map((a) => String(a?.name ?? "")).filter(Boolean);
  } else if (typeof s.name === "string") {
    // some endpoints have flat `artist` string
    const flat = s.artists as unknown;
    if (typeof flat === "string") artistNames = [flat];
  }

  const al = s.al as Record<string, unknown> | undefined;
  const album = s.album as Record<string, unknown> | undefined;

  const picUrl = String(al?.picUrl || album?.picUrl || "");
  const artistSource = Array.isArray(ar) && ar.length ? ar : artists;

  const duration = Number(s.dt ?? s.duration ?? 0);
  const fee = Number(s.fee ?? 0);

  // 官方别名：/song/detail 与多数列表接口为 alias，部分艺术家接口为 alia。
  const aliasRaw = Array.isArray(s.alias)
    ? s.alias
    : Array.isArray(s.alia)
      ? s.alia
      : [];
  const alias = aliasRaw.map((a) => String(a ?? "").trim()).filter(Boolean);

  return {
    id,
    name: String(s.name ?? "未知歌曲"),
    artists: artistNames.join(" / ") || "未知歌手",
    artistNames,
    artistIds: Array.isArray(artistSource)
      ? artistSource.map((a) => Number(a?.id ?? 0)).filter((id) => id > 0)
      : [],
    album: String(al?.name ?? album?.name ?? "未知专辑"),
    albumId: Number(al?.id ?? album?.id ?? 0),
    picUrl,
    duration,
    fee,
    mvId:
      typeof s.mv === "number"
        ? s.mv
        : typeof s.mvid === "number"
          ? s.mvid
          : undefined,
    alias: alias.length ? alias : undefined,
    // 行内自带 privilege（/playlist/detail 的 tracks 等）时直接取
    // 歌曲最好支持音质作为标识。
    ...(() => {
      const lvl = privilegeMaxLevel(
        s.privilege as Record<string, unknown> | null | undefined,
      );
      return lvl
        ? { master: lvl === "jymaster" || undefined, maxLevel: lvl }
        : {};
    })(),
  };
}

/** Enrich a list of raw songs via `/song/detail` (fills picUrl/ar/al uniformly). */
async function enrichSongs(ids: number[]): Promise<Map<number, Song>> {
  const map = new Map<number, Song>();
  if (!ids.length) return map;
  const res = await request<SongDetailResponse>("/song/detail", {
    ids: ids.join(","),
  });
  const privs = new Map<number, Record<string, unknown>>();
  for (const p of (res as { privileges?: unknown[] }).privileges ?? []) {
    const o = p as Record<string, unknown>;
    const pid = Number(o?.id ?? 0);
    if (pid > 0) privs.set(pid, o);
  }
  for (const raw of res.songs ?? []) {
    const song = normalizeSong(raw);
    if (!song) continue;
    map.set(song.id, songWithMaxLevel(song, privs.get(song.id)));
  }
  return map;
}

export async function searchSongs(
  keyword: string,
  limit = 40,
): Promise<Song[]> {
  let res: SearchResponse;
  try {
    res = await request<SearchResponse>("/cloudsearch", {
      keywords: keyword,
      limit,
      type: 1,
    });
  } catch {
    res = await request<SearchResponse>("/search", {
      keywords: keyword,
      limit,
      type: 1,
    });
  }
  const raws = (res.result?.songs ?? []) as unknown[];
  const normalized = raws
    .map((r) => normalizeSong(r))
    .filter((s): s is Song => s !== null);
  // cloudsearch 的特权在 result.privileges 平级数组里，按 id 合并出母带标。
  const searchPrivs = new Map<number, Record<string, unknown>>();
  for (const p of ((res.result as Record<string, unknown> | undefined)?.[
    "privileges"
  ] ?? []) as unknown[]) {
    const o = p as Record<string, unknown>;
    const pid = Number(o?.id ?? 0);
    if (pid > 0) searchPrivs.set(pid, o);
  }
  const withLevel = normalized.map((song) =>
    songWithMaxLevel(song, searchPrivs.get(song.id)),
  );

  // Search responses usually include album art. Only fetch details for the
  // missing covers instead of delaying every result behind a second request.
  const missingCoverIds = normalized
    .filter((song) => !song.picUrl)
    .slice(0, 20)
    .map((song) => song.id);
  const enriched = await enrichSongs(missingCoverIds).catch(
    () => new Map<number, Song>(),
  );
  // 补封面时以 enrich 结果覆盖，最好音质标识取两路较高者。
  const songs = withLevel.map((song) => {
    const e = enriched.get(song.id);
    if (!e) return song;
    return songWithMaxLevel(
      e,
      song.maxLevel ? { maxBrLevel: song.maxLevel } : undefined,
    );
  });

  const normalizeTerm = (value: string) =>
    value.toLocaleLowerCase("zh-CN").replace(/[\s·・_\-—/\\]+/g, "");
  const query = normalizeTerm(keyword);
  const scoreField = (
    value: string,
    exact: number,
    prefix: number,
    contains: number,
  ) => {
    const term = normalizeTerm(value);
    if (!term || !query) return 0;
    if (term === query) return exact;
    if (term.startsWith(query)) return prefix;
    return term.includes(query) ? contains : 0;
  };

  return songs
    .map((song, index) => ({
      song,
      index,
      score:
        scoreField(song.name, 1200, 760, 420) +
        scoreField(song.artists, 620, 380, 220) +
        scoreField(song.album, 340, 210, 120),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ song }) => song);
}

/* ------------------------------------------------------------------ */
/*  Playback                                                           */
/* ------------------------------------------------------------------ */

/** Song URLs stay valid for hours upstream; reuse them instead of re-asking. */
const SONG_URL_CACHE_TTL = 30 * 60 * 1000;

function freeTrialDuration(
  info:
    | {
        start?: number;
        end?: number;
        startTime?: number;
        endTime?: number;
      }
    | null
    | undefined,
): number | undefined {
  if (!info || typeof info !== "object") return undefined;
  const value = info as Record<string, unknown>;
  const start = Number(value.start ?? value.startTime ?? 0);
  const end = Number(value.end ?? value.endTime ?? 0);
  if (!Number.isFinite(end) || end <= 0) return undefined;
  const rawDuration = end > start ? end - start : end;
  if (!Number.isFinite(rawDuration) || rawDuration <= 0) return undefined;
  return rawDuration < 1000 ? rawDuration * 1000 : rawDuration;
}

export async function getSongUrl(
  id: number,
  level: PlaybackQuality = "exhigh",
): Promise<{
  url: string | null;
  br: number;
  code?: number;
  message?: string;
  previewEnd?: number;
}> {
  const key = cacheKey("/song/url/v1", { id, level });
  const hit = responseCache.get(key);
  if (hit && Date.now() - hit.at < SONG_URL_CACHE_TTL) {
    return hit.data as { url: string | null; br: number };
  }
  const running = inFlight.get(key);
  if (running) return running as Promise<{ url: string | null; br: number }>;
  const run = request<SongUrlResponse>("/song/url/v1", { id, level })
    .then((res) => {
      const d = res.data?.[0];
      const out = {
        url: d?.url ?? null,
        br: d?.br ?? 0,
        code: Number(d?.code ?? res.code ?? 0),
        message: String(d?.message ?? d?.msg ?? ""),
        previewEnd: freeTrialDuration(d?.freeTrialInfo),
      };
      // Only cache playable results; a null url may become available later
      // (e.g. right after login).
      if (out.url) responseCache.set(key, { at: Date.now(), data: out });
      return out;
    })
    .finally(() => {
      if (inFlight.get(key) === run) inFlight.delete(key);
    });
  inFlight.set(key, run);
  return run;
}

export async function getSongDownloadUrl(
  id: number,
  level: PlaybackQuality = "exhigh",
): Promise<{ url: string | null; br: number }> {
  const response = await request<{
    data?: { url?: string; br?: number };
  }>("/song/download/url/v1", { id, level });
  return {
    url: response.data?.url ?? null,
    br: Number(response.data?.br ?? 0),
  };
}

/** Derive a file extension from the download URL (fallback .mp3). */
function extensionFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const match = /\.([a-z0-9]{2,5})$/i.exec(pathname);
    if (match) {
      const ext = match[1]!.toLowerCase();
      if (/^(mp3|flac|ape|wav|m4a|aac|ogg|wma)$/.test(ext)) return ext;
    }
  } catch {
    /* ignore */
  }
  return "mp3";
}

export async function downloadSongFile(song: Song): Promise<void> {
  let result = await getSongDownloadUrl(song.id).catch(() => ({
    url: null,
    br: 0,
  }));
  if (!result.url) result = await getLegacySongUrl(song.id);
  if (!result.url) throw new Error("该歌曲暂时没有可下载地址");
  const configuredPath =
    localStorage.getItem("reverie_download_path") || "D:\\Reverie\\Downloads";
  const ext = extensionFromUrl(result.url);
  const safeName = `${song.name} - ${song.artists}.${ext}`.replace(
    /[\\/:*?"<>|]/g,
    "_",
  );
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    const { invoke } = await import("@tauri-apps/api/core");
    const response = await fetch(result.url);
    if (!response.ok || !response.body) throw new Error("歌曲下载失败");
    // 分块落盘，避免无损整曲一次性转成 number[] 造成数百 MB 内存峰值。
    const reader = response.body.getReader();
    let first = true;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.length) continue;
      const bytes = Array.from(value);
      await invoke("save_download_file", {
        path: configuredPath.replace(/[\\/]+$/, "") + "/" + safeName,
        data: bytes,
        append: !first,
      });
      first = false;
    }
    if (first) throw new Error("歌曲下载失败：内容为空");
    return;
  }
  if (typeof document === "undefined") return;
  const anchor = document.createElement("a");
  anchor.href = result.url;
  anchor.download = safeName;
  anchor.target = "_blank";
  anchor.rel = "noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export async function getLegacySongUrl(id: number): Promise<{
  url: string | null;
  br: number;
  code?: number;
  message?: string;
  previewEnd?: number;
}> {
  const res = await request<SongUrlResponse>("/song/url", {
    id,
    br: 320000,
  });
  const d = res.data?.[0];
  return {
    url: d?.url ?? null,
    br: d?.br ?? 0,
    code: Number(d?.code ?? res.code ?? 0),
    message: String(d?.message ?? d?.msg ?? ""),
    previewEnd: freeTrialDuration(d?.freeTrialInfo),
  };
}

export async function getLyric(id: number): Promise<{
  lrc: string;
  tlyric: string;
  nolyric: boolean;
}> {
  if (!id) return { lrc: "", tlyric: "", nolyric: true };
  type ModernLyricResponse = LyricResponse & {
    yrc?: { lyric?: string };
    romalrc?: { lyric?: string };
  };
  const read = (res: ModernLyricResponse) => ({
    // The v1 route includes逐字歌词 in yrc. The player parser consumes the
    // regular lrc field, so prefer it while retaining the v1 translation.
    lrc: res.lrc?.lyric ?? res.yrc?.lyric ?? "",
    tlyric: res.tlyric?.lyric ?? res.romalrc?.lyric ?? "",
    nolyric: !!res.nolyric,
  });
  try {
    const modern = await cachedRequest<ModernLyricResponse>(
      "/lyric/new",
      {
        id,
        cp: false,
        tv: 0,
        lv: 0,
        rv: 0,
        kv: 0,
        yv: 0,
        ytv: 0,
        yrv: 0,
      },
      12 * 60 * 60 * 1000,
    );
    const normalized = read(modern);
    if (normalized.lrc || normalized.tlyric || normalized.nolyric) {
      return normalized;
    }
  } catch {
    // Older sidecars may not expose /lyric/new; use the stable legacy route.
  }
  return read(
    await cachedRequest<LyricResponse>("/lyric", { id }, 12 * 60 * 60 * 1000),
  );
}

/* ------------------------------------------------------------------ */
/*  Discovery: charts / playlists / recommend / FM                     */
/* ------------------------------------------------------------------ */

export async function getTopSongs(type = 0, limit = 100): Promise<Song[]> {
  const res = await cachedRequest<{ code?: number; data?: unknown[] }>(
    "/top/song",
    { type },
    10 * 60 * 1000,
  );
  const raws = (res.data ?? []).slice(0, limit) as unknown[];
  return raws.map((r) => normalizeSong(r)).filter((s): s is Song => s !== null);
}

export async function getPlaylistDetail(id: number): Promise<{
  id: number;
  name: string;
  coverImgUrl: string;
  description: string;
  creatorId: number;
  creatorName: string;
  subscribed: boolean;
  songs: Song[];
}> {
  const res = await cachedRequest<{
    code?: number;
    playlist?: Record<string, unknown>;
  }>("/playlist/detail", { id }, 5 * 60 * 1000);
  const pl = res.playlist ?? {};
  const creator = (pl.creator ?? {}) as Record<string, unknown>;
  const tracks = (pl.tracks ?? []) as unknown[];
  return {
    id: Number(pl.id ?? id),
    name: String(pl.name ?? "歌单"),
    coverImgUrl: String(pl.coverImgUrl ?? ""),
    description: String(pl.description ?? ""),
    creatorId: Number(creator.userId ?? 0),
    creatorName: String(creator.nickname ?? ""),
    subscribed: Boolean(pl.subscribed),
    songs: tracks
      .map((r) => normalizeSong(r))
      .filter((s): s is Song => s !== null),
  };
}

export async function getHotPlaylists(
  limit = 30,
  offset = 0,
): Promise<PlaylistInfo[]> {
  const res = await cachedRequest<{ code?: number; playlists?: unknown[] }>(
    "/top/playlist",
    { limit, offset, order: "hot", cat: "全部" },
    30 * 60 * 1000,
  );
  return (res.playlists ?? [])
    .map((p) => {
      const o = p as Record<string, unknown>;
      const creator = (o.creator ?? {}) as Record<string, unknown>;
      return {
        id: Number(o.id),
        name: String(o.name ?? ""),
        coverImgUrl: String(o.coverImgUrl ?? ""),
        trackCount: Number(o.trackCount ?? 0),
        description: String(o.description ?? ""),
        creatorId: Number(creator.userId ?? 0),
        creatorName: String(creator.nickname ?? ""),
        subscribed: Boolean(o.subscribed),
        privacy: Number(o.privacy ?? 0),
      };
    })
    .filter((p) => p.id > 0);
}

export async function getRecommendSongs(): Promise<Song[]> {
  const res = await cachedRequest<{
    code?: number;
    data?: { dailySongs?: unknown[] };
  }>("/recommend/songs", {}, 10 * 60 * 1000);
  const raws = (res.data?.dailySongs ?? []) as unknown[];
  return raws.map((r) => normalizeSong(r)).filter((s): s is Song => s !== null);
}

export async function dislikeRecommendSong(id: number): Promise<void> {
  await request("/recommend/songs/dislike", { id }, false, { method: "POST" });
}

export async function fmTrash(id: number): Promise<void> {
  await request("/fm_trash", { id });
}

export async function getUserPlaylists(uid: number): Promise<PlaylistInfo[]> {
  // 分页拉全量：固定 limit 会静默截断多歌单用户。
  const PAGE = 50;
  const MAX_PAGES = 20; // 上限 1000 个歌单，防御异常死循环
  const rows: unknown[] = [];
  const seenIds = new Set<number>();
  for (let offset = 0; offset < MAX_PAGES * PAGE; offset += PAGE) {
    const res = await cachedRequest<{
      code?: number;
      playlist?: unknown[];
      more?: boolean;
    }>("/user/playlist", { uid, limit: PAGE, offset }, 2 * 60 * 1000);
    const page = res.playlist ?? [];
    let added = 0;
    for (const item of page) {
      const id = Number((item as Record<string, unknown>).id ?? 0);
      if (id > 0 && !seenIds.has(id)) {
        seenIds.add(id);
        rows.push(item);
        added++;
      }
    }
    // Some sidecar/proxy versions ignore offset and repeat the first page.
    // Stop instead of returning duplicated playlists or spinning to the cap.
    if (page.length > 0 && added === 0) break;
    if (page.length < PAGE || res.more === false) break;
  }
  return rows
    .map((p) => {
      const o = p as Record<string, unknown>;
      const creator = (o.creator ?? {}) as Record<string, unknown>;
      return {
        id: Number(o.id),
        name: String(o.name ?? ""),
        coverImgUrl: String(o.coverImgUrl ?? ""),
        trackCount: Number(o.trackCount ?? 0),
        description: String(o.description ?? ""),
        creatorId: Number(creator.userId ?? 0),
        creatorName: String(creator.nickname ?? ""),
        subscribed: Boolean(o.subscribed),
        privacy: Number(o.privacy ?? 0),
      };
    })
    .filter((p) => p.id > 0);
}

/* ------------------------------------------------------------------ */
/*  Login (QR code)                                                    */
/* ------------------------------------------------------------------ */

export async function qrKey(): Promise<string> {
  const res = await request<QrKeyResponse>("/login/qr/key", {}, true);
  return res.data?.unikey ?? "";
}

export async function qrCreate(key: string): Promise<QrCreateResult> {
  const res = await request<QrCreateResponse>(
    "/login/qr/create",
    { key, qrimg: "true", platform: "web" },
    false,
  );
  return {
    qrimg: res.data?.qrimg ?? "",
    qrurl: res.data?.qrurl ?? "",
  };
}

export async function qrCheck(key: string): Promise<QrCheckResponse> {
  return request<QrCheckResponse>(
    "/login/qr/check",
    { key, timestamp: Date.now() },
    false,
  );
}

/** 读取佩戴中的个性化头像框：profile.avatarDetail.identityIconUrl。 */
function pickAvatarFrame(profileRaw: Record<string, unknown> | null): string {
  if (!profileRaw) return "";
  const detail = profileRaw.avatarDetail;
  if (detail && typeof detail === "object") {
    const d = detail as Record<string, unknown>;
    const url = String(d.identityIconUrl ?? d.iconUrl ?? "");
    if (/^https?:\/\//i.test(url)) return url;
  }
  const direct = profileRaw.avatarFrameUrl ?? profileRaw.frameUrl;
  return typeof direct === "string" && /^https?:\/\//i.test(direct)
    ? direct
    : "";
}

export async function loginStatus(): Promise<UserProfile | null> {
  const res = await request<LoginStatusResponse>("/login/status");
  const profile = (res.data?.profile ?? res.profile ?? null) as Record<
    string,
    unknown
  > | null;
  const account = (res.data?.account ?? res.account ?? null) as Record<
    string,
    unknown
  > | null;
  // 网易云接口在会话缺失/失效时会回退到“匿名账号”：code 仍为 200，
  // account 存在但 type=1000（游客）且没有 profile 字段。
  // 此时必须视为未登录——否则会构造出只有兜底昵称、游客 userId 的幽灵用户，
  // 界面误显示已登录，而后续所有用户信息请求都拿不到真实数据。
  if (!profile || Number(account?.type) === 1000) return null;
  return {
    userId: Number(profile.userId ?? 0),
    nickname: String(profile.nickname ?? "网易云用户"),
    avatarUrl: String(profile.avatarUrl ?? ""),
    avatarFrameUrl: pickAvatarFrame(profile) || undefined,
    signature: profile.signature ? String(profile.signature) : undefined,
    vipType: Math.max(
      Number(account?.vipType ?? 0),
      Number(profile.vipType ?? 0),
    ),
    // 徽标同 getVipInfo 的口径：先走官方品牌位（含 SVIP redplus 节点），
    // 深扫只作兜底，避免把静态等级胶囊或无关图标当官方铭牌。
    badgeUrl:
      pickOfficialBrandIcon(findVipRights(res.data ?? res))?.url ||
      deepFindBadgeUrl(res.data ?? res) ||
      undefined,
  };
}

/* ------------------------------------------------------------------ */
/*  Like / red heart                                                   */
/* ------------------------------------------------------------------ */

export async function likeSong(id: number, like: boolean): Promise<void> {
  await request("/like", { id, like: like ? "true" : "false" }, false);
  invalidateResponseCache(["/likelist"]);
}

export async function getLikedIds(uid: number): Promise<number[]> {
  const res = await request<{ ids?: number[] }>("/likelist", { uid }, false);
  return res.ids ?? [];
}

/**
 * 听歌打卡：把一次有效播放上报给官方（/api/feedback/weblog）。
 * 这是官方「最近播放 / 听歌排行 / 年度报告」的唯一数据源——不在官方
 * 客户端里听的歌若不上报，两端数据就会永久分叉。官方规则为单次
 * 播放满 30s 记一次 playend；sourceid 用于归属来源列表，0 表示未带
 * 上下文（仍计入播放记录）。
 */
export async function reportSongPlayed(
  songId: number,
  playedMs: number,
): Promise<void> {
  if (!getCookie() || !songId) return;
  await request(
    "/scrobble",
    { id: songId, sourceid: 0, time: Math.max(0, Math.round(playedMs)) },
    true,
  );
}

export interface VipInfo {
  vipType: number;
  vipLevel: number;
  /** milliseconds epoch; 0 = not a member */
  expireTime: number;
  /** official/custom member badge image url from the API */
  badgeUrl?: string;
  /**
   * 黑胶超级会员（SVIP）：黑胶 VIP 与畅听包同时生效——对应官方
   * vipType 110 组合态，是沉浸环绕声/超清母带等 SVIP 特权的判定依据。
   */
  svip?: boolean;
}

/**
 * 官方品牌位解析（对齐 music.163.com 自身模板的判定树，一字不差）：
 * 1) redplus.vipCode===300 且 rights → 黑胶超级会员（brand-svip），
 *    这是官方口径里 SVIP 的权威证据，优先于一切等级推断；
 * 2) associator.rights → associator.iconUrl，缺失则按 redVipLevel
 *    取官方静态等级资产（1..7）；
 * 3) musicPackage.rights → musicPackage.iconUrl（畅听包）；
 * 4) redVipAnnualCount>=1 → 年费 VIP 资产；
 * 5) associator.rights 无等级 → 默认 VIP 资产。
 * 静态资产直链抄自官方模板（useNewVipIcon 新版一套），属官方图片。
 */
const OFFICIAL_VIP_LEVEL_ASSETS: Record<number, string> = {
  1: "https://p5.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/31289771075/9cde/206c/1521/ae97069bf19817f1fff4e3afda1d3998.png",
  2: "https://p5.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/31289779981/0735/9a76/996b/2b858ffcf51cb298412b566407c4cc75.png",
  3: "https://p5.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/31289796623/21a9/2cb2/8817/596f81c8bb28d1bca5f332ac3dc9a79e.png",
  4: "https://p5.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/31289814330/170d/189e/70cb/75a12e81f2f6f92407419e417e9777b0.png",
  5: "https://p5.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/31289819871/cae8/cbb4/63e2/feee66e7a731f20d2ce7aab9e92d1f68.png",
  6: "https://p5.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/31289839236/54ce/9c06/9eae/861f11a2e2666f34ad7f201e001d9221.png",
  7: "https://p5.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/31289847457/5230/7279/6543/ee2a0c6b2941a9647669e3ca522c350a.png",
};
const OFFICIAL_ANNUAL_VIP_ASSET =
  "https://p6.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/31290261228/d8c6/b0fb/b236/ccc907aabf076e224ac6f2ae76d045e3.png";
const OFFICIAL_DEFAULT_VIP_ASSET =
  "https://p6.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/31289879300/0ce6/0791/894f/2d90cb8ac138e4e4eda83f13d7979e88.png";

export interface OfficialBrandIcon {
  url: string;
  /** 该图标是否为黑胶超级会员（SVIP）身份位。 */
  svip: boolean;
}

function officialImg(v: unknown): string {
  return typeof v === "string" && /^https?:\/\//i.test(v) ? v : "";
}

export function pickOfficialBrandIcon(
  vipRights: unknown,
): OfficialBrandIcon | null {
  if (!vipRights || typeof vipRights !== "object") return null;
  const vr = vipRights as Record<string, unknown>;
  const redplus = vr.redplus as Record<string, unknown> | undefined;
  if (
    Number(redplus?.vipCode) === 300 &&
    Boolean(redplus?.rights) &&
    officialImg(redplus?.iconUrl)
  ) {
    return { url: officialImg(redplus?.iconUrl), svip: true };
  }
  const associator = vr.associator as Record<string, unknown> | undefined;
  if (Boolean(associator?.rights)) {
    const icon = officialImg(associator?.iconUrl);
    if (icon) return { url: icon, svip: false };
    const level = Number(vr.redVipLevel ?? 0);
    const asset = OFFICIAL_VIP_LEVEL_ASSETS[level];
    if (asset) return { url: asset, svip: false };
  }
  const musicPackage = vr.musicPackage as Record<string, unknown> | undefined;
  if (Boolean(musicPackage?.rights)) {
    const icon = officialImg(musicPackage?.iconUrl);
    if (icon) return { url: icon, svip: false };
  }
  // redplus 只差图标时的 SVIP 身份仍要成立（无图时上层走文字铭牌）
  if (Number(redplus?.vipCode) === 300 && Boolean(redplus?.rights))
    return { url: "", svip: true };
  if (Number(vr.redVipAnnualCount ?? 0) >= 1)
    return { url: OFFICIAL_ANNUAL_VIP_ASSET, svip: false };
  if (Boolean(associator?.rights))
    return { url: OFFICIAL_DEFAULT_VIP_ASSET, svip: false };
  return null;
}

/**
 * 从任意响应对象中递归找出 profile.vipRights（login/status、
 * /user/detail 系列都有该结构），供官方品牌位解析使用。
 */
export function findVipRights(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") return null;
  const root = obj as Record<string, unknown>;
  const candidates: unknown[] = [
    root.profile,
    (root.data as Record<string, unknown> | undefined)?.profile,
    root.data,
    root,
  ];
  for (const c of candidates) {
    if (c && typeof c === "object" && (c as Record<string, unknown>).vipRights)
      return (c as Record<string, unknown>).vipRights;
  }
  return null;
}

/** Parse an epoch value that may be seconds or ms, or a "YYYY-MM-DD" date string. */
function parseEpoch(v: unknown): number {
  if (typeof v === "number") return v > 1e11 ? v : v * 1000;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n) && n > 1e8) return n > 1e11 ? n : n * 1000;
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
      const t = Date.parse(v);
      if (Number.isFinite(t)) return t;
    }
  }
  return 0;
}

/** Recursively find the membership expire time under any field name (takes the max). */
function deepFindExpireMs(obj: unknown): number {
  if (!obj || typeof obj !== "object") return 0;
  let best = 0;
  const walk = (o: unknown, depth: number) => {
    if (!o || typeof o !== "object" || depth > 4) return;
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (/expire|endtime|end_time|deadline|validto|valid_to/i.test(k)) {
        const n = parseEpoch(v);
        if (n > best) best = n;
      }
      if (v && typeof v === "object") walk(v, depth + 1);
    }
  };
  walk(obj, 0);
  return best;
}

/** Recursively find the best badge-like image URL (vip icon / custom badge). */
function deepFindBadgeUrl(obj: unknown): string {
  if (!obj || typeof obj !== "object") return "";
  let best = "";
  let bestScore = 0;
  const walk = (o: unknown, depth: number) => {
    if (!o || typeof o !== "object" || depth > 6) return;
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (typeof v === "string" && /^https?:\/\//i.test(v)) {
        if (/avatar|background|cover|img1v1|default/i.test(k)) continue;
        let score = 0;
        // the official app shows the ANIMATED member badge next to the
        // nickname; redVipDynamicIconUrl is the dynamic *level* badge when set
        if (/^redVipDynamicIconUrl/i.test(k))
          score = 500; // dynamic level badge
        else if (/dynamicicon/i.test(k))
          score = 400; // animated member badge (what official apps use)
        else if (/levelicon|level_icon|viplevelicon/i.test(k))
          score = 300; // static level badge fallback
        else if (/identityicon/i.test(k)) score = 120;
        else if (/vipicon/i.test(k)) score = 110;
        else if (/badge/i.test(k)) score = 100;
        else if (/decorat/i.test(k)) score = 90;
        else if (/vip/i.test(k)) score = 60;
        else if (/icon/i.test(k)) score = 40;
        else if (/level/i.test(k)) score = 25;
        if (score > bestScore) {
          bestScore = score;
          best = v;
        }
      }
      if (v && typeof v === "object") walk(v, depth + 1);
    }
  };
  walk(obj, 0);
  return best;
}

/**
 * 深度查找「佩戴中的个性化会员铭牌」：用户在会员中心装备的自定义
 * 铭牌会以独立字段出现在会员信息或用户资料里（customBadge/nameplate/
 * medal/decorate 一类命名）。与通用择优不同，这里只认铭牌类键，
 * 且命中即为最高优先级——官方客户端在佩戴了个性化铭牌时，
 * 昵称旁展示的就是它而不是默认的黑胶动图。
 */
function deepFindCustomPlate(obj: unknown): string {
  if (!obj || typeof obj !== "object") return "";
  let best = "";
  let bestScore = 0;
  const walk = (o: unknown, depth: number) => {
    if (!o || typeof o !== "object" || depth > 6) return;
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (typeof v === "string" && /^https?:\/\//i.test(v)) {
        if (/avatar|background|cover|img1v1|default|dynamic/i.test(k)) continue;
        let score = 0;
        if (/custom.*badge|badge.*custom/i.test(k)) score = 500;
        else if (/nameplate|mingpai|铭牌/i.test(k)) score = 480;
        else if (/medal/i.test(k)) score = 460;
        else if (/decorat/.test(k)) score = 440;
        else if (/wear|equipped|using/i.test(k)) score = 420;
        else if (/badge/i.test(k)) score = 400;
        if (score > bestScore) {
          bestScore = score;
          best = v;
        }
      }
      if (v && typeof v === "object") walk(v, depth + 1);
    }
  };
  walk(obj, 0);
  return best;
}

/**
 * 取「当前正在生效」的官方动态会员图标：/vip/info 会同时返回多个会员包
 * （associator 黑胶会员、musicPackage 畅听包等），每个都带自己的
 * dynamicIconUrl 与过期时间——已过期的包仍会残留旧图标，直接按字段名
 * 挑最优可能拿到失效的。此函数按官方展示优先级（黑胶 > 畅听包）逐个
 * 检查有效期，只返回仍在生效中的那个包的动态图标。
 */
function pickActiveDynamicBadge(data: Record<string, unknown>): string {
  const now = Date.now();
  const sections: unknown[] = [
    data.associator,
    data.musicPackage,
    data.redVip ?? data.vipData,
  ];
  for (const section of sections) {
    if (!section || typeof section !== "object") continue;
    const o = section as Record<string, unknown>;
    // 生效判定：包内没有任何过期字段视为生效；否则取最大过期时间与现在比对
    const expires: number[] = [];
    for (const [k, v] of Object.entries(o)) {
      if (/expire|endtime|end_time|deadline/i.test(k)) {
        const n = parseEpoch(v);
        if (n > 0) expires.push(n);
      }
    }
    const active = expires.length === 0 || Math.max(...expires) > now;
    if (!active) continue;
    for (const [k, v] of Object.entries(o)) {
      if (
        typeof v === "string" &&
        /^https?:\/\//i.test(v) &&
        /dynamicicon/i.test(k)
      ) {
        return v;
      }
    }
  }
  return "";
}

export async function getVipInfo(uid: number): Promise<VipInfo> {
  let d: Record<string, unknown> = {};
  // /vip/info (v1) carries the official member badge icons — including the
  // animated dynamicIconUrl (associator.dynamicIconUrl, an animated webp).
  // /vip/info/v2 only returns codes/levels/expire times (no icon urls), so it
  // must NOT be used alone. Merge both, letting v1's richer objects win.
  for (const ep of ["/vip/info/v2", "/vip/info"] as const) {
    try {
      const res = await request<{ data?: Record<string, unknown> }>(
        ep,
        { uid },
        false,
      );
      if (res?.data && typeof res.data === "object") {
        d = { ...d, ...res.data };
      }
    } catch {
      /* ignore */
    }
  }
  const redLevel = Number(d.redVipLevel ?? d.level ?? 0);
  const vipType = Number(
    d.vipType ?? d.redVipType ?? d.vipStatus ?? (redLevel > 0 ? 10 : 0),
  );
  const expireTime = deepFindExpireMs(d);
  // ── 官方徽标解析链（对齐官方客户端口径）────────────────────────
  // ①佩戴中的个性化铭牌 → ②包动态图标(校验有效期) → ③官方品牌位
  // (vipRights 树，SVIP 的权威证据在 redplus.vipCode===300 节点)
  // → ④资料深扫兜底。此前把头像挂件(avatarDetail)混进徽标来源、且读
  // 不到 redplus 节点，导致 SVIP 显示成 "VIP·柒" 等级胶囊或非官方图。
  let badgeUrl = deepFindCustomPlate(d);
  let vipRights: unknown = findVipRights(d);
  let detailRes: unknown = null;
  const fetchDetailOnce = async () => {
    if (detailRes) return detailRes;
    try {
      detailRes = await request<unknown>(
        "/user/detail/new",
        { uid, all: "true" },
        false,
      );
    } catch {
      /* ignore */
    }
    return detailRes;
  };
  const firstDetail = await fetchDetailOnce();
  if (!badgeUrl && firstDetail) badgeUrl = deepFindCustomPlate(firstDetail);
  if (!vipRights) vipRights = findVipRights(firstDetail);
  if (!vipRights) {
    // user/detail/new 拿不到资料时的次级来源（内含 profile.vipRights）
    try {
      const res = await request<unknown>("/user/detail", { uid }, false);
      badgeUrl ||= deepFindCustomPlate(res);
      vipRights = findVipRights(res);
    } catch {
      /* ignore */
    }
  }
  const brand = pickOfficialBrandIcon(vipRights);
  if (!badgeUrl) badgeUrl = pickActiveDynamicBadge(d);
  if (!brand?.url && !badgeUrl) {
    const res = await fetchDetailOnce();
    if (res) badgeUrl = deepFindBadgeUrl(res);
  }
  if (!badgeUrl) {
    // 诊断：所有来源都未命中时打印可用字段名，便于用开发者工具
    // 确认该账号的铭牌/装扮实际下发位置（只输出键名，不含值）。
    console.debug(
      "[reverie:vip] 未命中任何会员图标来源 | /vip/info 键:",
      Object.keys(d).join(",") || "(空)",
      "| uid:",
      uid,
    );
  }
  // SVIP 判定双通道：
  // a) 官方品牌位 redplus.vipCode===300 && rights（vipRights 树）——
  //    官方口径里黑胶超级会员的权威证据，最优先；
  // b) /vip/info 双包（黑胶+畅听）同时生效的组合态兜底。
  // 到期判定与 pickActiveDynamicBadge 同一口径：包内任意过期类字段的
  // 最大值即该包到期时间（秒/毫秒/日期串经 parseEpoch 归一）。此前只认
  // expireTime 且按毫秒直读，字段名变体或秒级时间戳会把在期的包误判为
  // 已过期，导致 SVIP 被降档显示成 VIP。
  const now = Date.now();
  const pkgActive = (o: unknown): boolean => {
    if (!o || typeof o !== "object") return false;
    const expires: number[] = [];
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (/expire|endtime|end_time|deadline|validto|valid_to/i.test(k)) {
        const n = parseEpoch(v);
        if (n > 0) expires.push(n);
      }
    }
    return expires.length === 0 || Math.max(...expires) > now;
  };
  const svip =
    Boolean(brand?.svip) ||
    (pkgActive(d.associator) && pkgActive(d.musicPackage));
  return {
    vipType,
    vipLevel: redLevel,
    expireTime,
    badgeUrl: badgeUrl || brand?.url || undefined,
    svip,
  };
}

export async function getSongsByIds(ids: number[]): Promise<Song[]> {
  if (!ids.length) return [];
  // Song metadata is stable; cache aggressively so re-entering a large liked
  // list or re-opening a playlist does not refetch every chunk.
  const res = await cachedRequest<SongDetailResponse>(
    "/song/detail",
    { ids: ids.join(",") },
    30 * 60 * 1000,
  );
  // /song/detail 的特权信息在平级的 privileges 数组里（按 id 对应），
  // 合并回歌曲以获得超清母带支持标记。
  const privs = new Map<number, Record<string, unknown>>();
  for (const p of (res as { privileges?: unknown[] }).privileges ?? []) {
    const o = p as Record<string, unknown>;
    const pid = Number(o?.id ?? 0);
    if (pid > 0) privs.set(pid, o);
  }
  return (res.songs ?? [])
    .map((r) => {
      const song = normalizeSong(r);
      if (!song) return null;
      return songWithMaxLevel(song, privs.get(song.id));
    })
    .filter((s): s is Song => s !== null);
}
