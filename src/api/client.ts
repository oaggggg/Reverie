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
try {
  cookie = localStorage.getItem(COOKIE_KEY) || "";
} catch {
  cookie = "";
}

export function getCookie(): string {
  return cookie;
}

export function setCookie(c: string): void {
  cookie = c;
  try {
    localStorage.setItem(COOKIE_KEY, c);
  } catch {
    /* ignore */
  }
}

export function clearCookie(): void {
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

function cacheKey(path: string, params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  }
  return `${path}?${q.toString()}`;
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
  if (hit && Date.now() - hit.at < ttlMs) return hit.data as T;
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

export async function request<T = unknown>(
  path: string,
  params: Record<string, string | number | boolean | null | undefined> = {},
  cacheBust = true,
  options: RequestOptions = {},
): Promise<T> {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  }
  if (cookie) q.set("cookie", cookie);
  if (cacheBust) q.set("timestamp", String(Date.now()));

  const query = q.toString();
  const url = `${API_BASE}${path}${query ? `?${query}` : ""}`;
  const method = options.method ?? "GET";
  const fetchOptions: RequestInit = {
    method,
    headers: options.headers,
    body: options.body,
    signal: AbortSignal.timeout(15000),
  };
  if (method === "GET") delete fetchOptions.body;
  let res: Response | null = null;
  let lastError: unknown;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      res = await fetch(url, fetchOptions);
      break;
    } catch (error) {
      lastError = error;
      if (attempt === 7) throw error;
      // The desktop sidecar is spawned just before the WebView loads. On a
      // cold start it can need a moment before the local port begins listening.
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(120 + attempt * 90, 600)),
      );
    }
  }
  if (!res) throw lastError;
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  return (await res.json()) as T;
}

/* ------------------------------------------------------------------ */
/*  Search & enrich                                                    */
/* ------------------------------------------------------------------ */

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
  };
}

/** Enrich a list of raw songs via `/song/detail` (fills picUrl/ar/al uniformly). */
async function enrichSongs(ids: number[]): Promise<Map<number, Song>> {
  const map = new Map<number, Song>();
  if (!ids.length) return map;
  const res = await request<SongDetailResponse>("/song/detail", {
    ids: ids.join(","),
  });
  for (const raw of res.songs ?? []) {
    const song = normalizeSong(raw);
    if (song) map.set(song.id, song);
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

  // Search responses usually include album art. Only fetch details for the
  // missing covers instead of delaying every result behind a second request.
  const missingCoverIds = normalized
    .filter((song) => !song.picUrl)
    .slice(0, 20)
    .map((song) => song.id);
  const enriched = await enrichSongs(missingCoverIds).catch(
    () => new Map<number, Song>(),
  );
  const songs = normalized.map((song) => enriched.get(song.id) ?? song);

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

export async function downloadSongFile(song: Song): Promise<void> {
  let result = await getSongDownloadUrl(song.id).catch(() => ({
    url: null,
    br: 0,
  }));
  if (!result.url) result = await getLegacySongUrl(song.id);
  if (!result.url) throw new Error("该歌曲暂时没有可下载地址");
  const configuredPath = localStorage.getItem("reverie_download_path") || "D:\\Reverie\\Downloads";
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    const { invoke } = await import("@tauri-apps/api/core");
    const response = await fetch(result.url);
    if (!response.ok) throw new Error("歌曲下载失败");
    const bytes = Array.from(new Uint8Array(await response.arrayBuffer()));
    const fileName = (song.name + " - " + song.artists + ".mp3").replace(/[\\/:*?"<>|]/g, "_");
    const path = configuredPath.replace(/[\\/]+$/, "") + "/" + fileName;
    await invoke("save_download_file", { path, data: bytes });
    return;
  }
  if (typeof document === "undefined") return;
  const anchor = document.createElement("a");
  anchor.href = result.url;
  anchor.download = `${song.name} - ${song.artists}.mp3`.replace(
    /[\\/:*?"<>|]/g,
    "_",
  );
  anchor.target = "_blank";
  anchor.rel = "noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export async function getLegacySongUrl(
  id: number,
): Promise<{
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
  const res = await cachedRequest<{ code?: number; playlist?: unknown[] }>(
    "/user/playlist",
    { uid, limit: 50 },
    2 * 60 * 1000,
  );
  return (res.playlist ?? [])
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
  if (!profile && !account) return null;
  const accountVip = Number(account?.vipType ?? 0);
  const profileVip = Number(profile?.vipType ?? 0);
  return {
    userId: Number(profile?.userId ?? account?.id ?? 0),
    nickname: String(profile?.nickname ?? "网易云用户"),
    avatarUrl: String(profile?.avatarUrl ?? ""),
    signature: profile?.signature ? String(profile.signature) : undefined,
    vipType: Math.max(accountVip, profileVip),
    badgeUrl: deepFindBadgeUrl(res.data ?? res) || undefined,
  };
}

/* ------------------------------------------------------------------ */
/*  Like / red heart                                                   */
/* ------------------------------------------------------------------ */

export async function likeSong(id: number, like: boolean): Promise<void> {
  await request("/like", { id, like: like ? "true" : "false" }, false);
}

export async function getLikedIds(uid: number): Promise<number[]> {
  const res = await request<{ ids?: number[] }>("/likelist", { uid }, false);
  return res.ids ?? [];
}

export interface VipInfo {
  vipType: number;
  vipLevel: number;
  /** milliseconds epoch; 0 = not a member */
  expireTime: number;
  /** official/custom member badge image url from the API */
  badgeUrl?: string;
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
  let badgeUrl = deepFindBadgeUrl(d);
  // the custom member badge lives in the user profile
  if (!badgeUrl) {
    try {
      const res = await request<unknown>(
        "/user/detail/new",
        { uid, all: "true" },
        false,
      );
      badgeUrl = deepFindBadgeUrl(res);
    } catch {
      /* ignore */
    }
  }
  if (!badgeUrl) {
    try {
      const res = await request<unknown>("/user/detail", { uid }, false);
      badgeUrl = deepFindBadgeUrl(res);
    } catch {
      /* ignore */
    }
  }
  return {
    vipType,
    vipLevel: redLevel,
    expireTime,
    badgeUrl: badgeUrl || undefined,
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
  return (res.songs ?? [])
    .map((r) => normalizeSong(r))
    .filter((s): s is Song => s !== null);
}
