import { create } from "zustand";
import {
  clearCookie,
  clearResponseCache,
  fmTrash,
  getCookie,
  getLegacySongUrl,
  getLikedIds,
  getLyric,
  getPlaylistDetail,
  getHotPlaylists,
  getRecommendSongs,
  getSongsByIds,
  getSongUrl,
  getTopSongs,
  getUserPlaylists,
  getVipInfo,
  isCookieFreshlySet,
  likeSong,
  loginStatus,
  reportSongPlayed,
  searchSongs,
  setCookie,
} from "../api/client.ts";
import { getAlbumPrivileges } from "../api/library.ts";
import type {
  LyricLine,
  PlaybackQuality,
  PlaylistInfo,
  PlayMode,
  QualityTier,
  Song,
  UserProfile,
  View,
} from "../api/types.ts";
import type { VipInfo } from "../api/client.ts";
import { getPersonalFm } from "../api/extended.ts";
import { logoutFromNetease } from "../api/auth.ts";
import { parseLyrics, pickRandomLyricLine } from "../utils/lyrics.ts";
import {
  benchmarkCoverQuality,
  hasWebGL,
  QUALITY_GRID,
  QUALITY_LABEL,
} from "../utils/gpuBenchmark.ts";
import type { CoverQuality } from "../utils/gpuBenchmark.ts";
import { recordDiagnostic } from "../utils/diagnostics.ts";

export type UpdatePhase =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"
  | "installing"
  | "none"
  | "error";

export interface ToastMsg {
  id: number;
  text: string;
  type: "info" | "error" | "success";
  exiting?: boolean;
}

export type ThemePreference = "system" | "light" | "dark";
export type GlassOpacity = "subtle" | "balanced" | "solid";
export type GlassBlur = "none" | "soft" | "strong";
export type GlassContrast = "standard" | "high";
export type AnimationSpeed = "relaxed" | "normal" | "swift" | "instant";

/** Where the current queue came from; "fm" keeps roaming auto-advancing. */
export type QueueSource = "list" | "fm";

export const PLAYBACK_QUALITY_LABELS: Record<PlaybackQuality, string> = {
  standard: "标准",
  higher: "较高",
  exhigh: "极高",
  lossless: "无损",
  hires: "Hi-Res无损",
  dolby: "杜比全景声",
  jyeffect: "高清环绕声",
  sky: "沉浸环绕声",
  jymaster: "超清母带",
  vivid: "全景声 Vivid",
};

/**
 * 音质 → 所需会员身份（官方会员权益口径）：
 * 免费：标准 / 较高 / 极高（菜单中不加标识）
 * VIP（黑胶会员）：无损 / Hi-Res / 杜比全景声 / 高清环绕声
 * SVIP（黑胶超级会员）：沉浸环绕声 / 超清母带 / 全景声 Vivid
 */
export const PLAYBACK_QUALITY_TIER: Record<PlaybackQuality, QualityTier> = {
  standard: "free",
  higher: "free",
  exhigh: "free",
  lossless: "vip",
  hires: "vip",
  dolby: "vip",
  jyeffect: "vip",
  sky: "svip",
  jymaster: "svip",
  vivid: "svip",
};

/** 全部官方音质等级（按官方客户端码率序，播放栏菜单完整展示）。 */
export const ALL_PLAYBACK_QUALITIES: PlaybackQuality[] = [
  "standard",
  "higher",
  "exhigh",
  "lossless",
  "hires",
  "dolby",
  "jyeffect",
  "jymaster",
  "sky",
  "vivid",
];

const PLAYBACK_QUALITY_LEVELS: PlaybackQuality[] = [
  "standard",
  "higher",
  "exhigh",
  "lossless",
  "hires",
  "jyeffect",
  "jymaster",
];

function qualitiesFromPrivilege(privilege: {
  maxBitrate: number;
  standard: boolean;
  lossless: boolean;
  highRes: boolean;
  spatialAudio: boolean;
  surroundEffect: boolean;
  immersive: boolean;
  jymaster: boolean;
  dolby: boolean;
  vivid: boolean;
}): PlaybackQuality[] {
  const qualities: PlaybackQuality[] = [];
  if (privilege.standard || privilege.maxBitrate > 0)
    qualities.push("standard");
  if (privilege.maxBitrate >= 192000) qualities.push("higher");
  if (privilege.maxBitrate >= 320000) qualities.push("exhigh");
  if (privilege.lossless) qualities.push("lossless");
  if (privilege.highRes) qualities.push("hires");
  if (privilege.dolby) qualities.push("dolby");
  if (privilege.surroundEffect || privilege.spatialAudio)
    qualities.push("jyeffect");
  if (privilege.jymaster) qualities.push("jymaster");
  if (privilege.immersive) qualities.push("sky");
  if (privilege.vivid) qualities.push("vivid");
  return qualities.length ? qualities : ["standard"];
}

const COVER_QUALITY_KEY = "reverie_cover_quality";
const COVER_BENCH_KEY = "reverie_cover_benchmarked";
const PROFILE_CACHE_KEY = "reverie_profile_cache";
const HOME_PLAYLISTS_CACHE_KEY = "reverie_home_playlists";
const HOME_TOP_CACHE_KEY = "reverie_home_top_songs";
const HOME_QUOTE_CACHE_KEY = "reverie_home_quote";
const HOME_PLAYLISTS_CACHE_AT_KEY = "reverie_home_playlists_at";
const HOME_TOP_CACHE_AT_KEY = "reverie_home_top_songs_at";
const HOME_QUOTE_CACHE_AT_KEY = "reverie_home_quote_at";
const VIP_CACHE_PREFIX = "reverie_vip_";
const HOME_DATA_CACHE_TTL = 30 * 60 * 1000;
const HOME_RECOMMEND_CACHE_TTL = 10 * 60 * 1000;
const HOME_QUOTE_CACHE_TTL = 12 * 60 * 60 * 1000;

function readCoverQuality(): CoverQuality {
  const v = readStr(COVER_QUALITY_KEY, "");
  return v in QUALITY_GRID ? (v as CoverQuality) : "medium";
}

function readGlassOpacity(): GlassOpacity {
  const value = readStr("reverie_glass_opacity", "balanced");
  return value === "subtle" || value === "solid" ? value : "balanced";
}

function readGlassBlur(): GlassBlur {
  const value = readStr("reverie_glass_blur", "strong");
  return value === "none" || value === "soft" ? value : "strong";
}

function readGlassContrast(): GlassContrast {
  return readStr("reverie_glass_contrast", "standard") === "high"
    ? "high"
    : "standard";
}

function readAnimationSpeed(): AnimationSpeed {
  const value = readStr("reverie_animation_speed", "normal");
  return value === "relaxed" || value === "swift" || value === "instant"
    ? value
    : "normal";
}

/** Motion applied to the 3D particle album cover on the now-playing page. */
export type ParticleEffect =
  "none" | "spin" | "wave" | "audio" | "orbit" | "ripple" | "shimmer";

export type LyricTheme =
  "auto" | "default" | "neon" | "fire" | "aurora" | "mint" | "rose" | "pure";

/* ------------------------- persistence helpers ------------------------- */
function readNum(key: string, def: number): number {
  try {
    const raw = localStorage.getItem(key);
    // Number(null) / Number("") are 0 and pass Number.isFinite, so the default
    // has to be picked before the conversion, not after it.
    if (raw === null || raw.trim() === "") return def;
    const v = Number(raw);
    return Number.isFinite(v) ? v : def;
  } catch {
    return def;
  }
}
function readBool(key: string, def: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? def : v === "1";
  } catch {
    return def;
  }
}
function readStr(key: string, def: string): string {
  try {
    return localStorage.getItem(key) ?? def;
  } catch {
    return def;
  }
}
function write(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* ignore */
  }
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  write(key, JSON.stringify(value));
}

function readCachedProfile(): UserProfile | null {
  if (!getCookie()) return null;
  const profile = readJson<UserProfile | null>(PROFILE_CACHE_KEY, null);
  return profile && profile.userId > 0 ? profile : null;
}

function recommendCacheKey(userId: number) {
  return `reverie_recommend_${userId}`;
}

function recommendCacheAtKey(userId: number) {
  return `${recommendCacheKey(userId)}_at`;
}

function likedIdsCacheKey(userId: number) {
  return `reverie_liked_ids_${userId}`;
}

function vipCacheKey(userId: number) {
  return `${VIP_CACHE_PREFIX}${userId}`;
}

function isCacheFresh(key: string, ttl: number): boolean {
  const cachedAt = readNum(key, 0);
  return cachedAt > 0 && Date.now() - cachedAt < ttl;
}

/** 缓存时间戳是否落在本地今天的日历日内（跨天即视为过期）。 */
function isSameLocalDay(key: string): boolean {
  const cachedAt = readNum(key, 0);
  if (!cachedAt) return false;
  const cached = new Date(cachedAt);
  const now = new Date();
  return (
    cached.getFullYear() === now.getFullYear() &&
    cached.getMonth() === now.getMonth() &&
    cached.getDate() === now.getDate()
  );
}

function touchCache(key: string) {
  write(key, String(Date.now()));
}

async function loginStatusWithRetry(): Promise<UserProfile | null> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 14; attempt++) {
    try {
      return await loginStatus();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(120 + attempt * 80, 600)),
      );
    }
  }
  throw lastError;
}

/** Fisher-Yates shuffle; `sort(() => Math.random() - 0.5)` is heavily biased. */
function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Roaming pool: prefer free tracks, VIP ones cannot be streamed. */
function readParticleEffect(): ParticleEffect {
  const v = readStr("reverie_particle", "spin");
  return [
    "none",
    "spin",
    "wave",
    "audio",
    "orbit",
    "ripple",
    "shimmer",
  ].includes(v)
    ? (v as ParticleEffect)
    : "spin";
}

function readLyricTheme(): LyricTheme {
  const value = readStr("reverie_lyrictheme", "auto");
  return [
    "auto",
    "default",
    "neon",
    "fire",
    "aurora",
    "mint",
    "rose",
    "pure",
  ].includes(value)
    ? (value as LyricTheme)
    : "auto";
}

function readPlayMode(): PlayMode {
  const v = readStr("reverie_playmode", "sequence");
  // "loop" existed in older builds but was never reachable from the UI.
  return v === "one" || v === "shuffle" ? v : "sequence";
}

function readPlaybackQuality(): PlaybackQuality {
  const value = readStr("reverie_playback_quality", "exhigh");
  return PLAYBACK_QUALITY_LEVELS.includes(value as PlaybackQuality)
    ? (value as PlaybackQuality)
    : "exhigh";
}

const LIKED_AT_KEY = "reverie_liked_at";

/** Local "liked at" timestamps, used to sort the liked list newest-first. */
function readLikedAt(): Record<number, number> {
  try {
    const raw = localStorage.getItem(LIKED_AT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<number, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const id = Number(k);
      if (Number.isFinite(id) && typeof v === "number") out[id] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function readThemePref(): ThemePreference {
  const v = readStr("reverie_theme", "system") as ThemePreference;
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

interface RecentSongData {
  id: number;
  name: string;
  artists: string;
  artistNames: string[];
  album: string;
  albumId: number;
  picUrl: string;
  duration: number;
  fee: number;
  mvId?: number;
}

function readRecentSongs(): Song[] {
  try {
    const raw = localStorage.getItem("reverie_recent");
    if (!raw) return [];
    const arr = JSON.parse(raw) as RecentSongData[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/* ---------------------- session persistence (local only) ---------------------- */

const SESSION_KEY = "reverie_session";
const LEGACY_KEYS = ["ncm_theme"];
const MAX_RESTORED_QUEUE_ENTRIES = 200;

interface SessionData {
  queue: Song[];
  index: number;
  currentSong: Song | null;
}

/** Restore the last playback session (queue / index / current song), no autoplay. */
function readSession(): SessionData {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return { queue: [], index: -1, currentSong: null };
    const d = JSON.parse(raw) as SessionData;
    if (
      !Array.isArray(d.queue) ||
      typeof d.index !== "number" ||
      !d.currentSong
    ) {
      return { queue: [], index: -1, currentSong: null };
    }
    if (d.queue.length <= MAX_RESTORED_QUEUE_ENTRIES) {
      return { queue: d.queue, index: d.index, currentSong: d.currentSong };
    }

    // Older versions could persist an ever-growing FM queue. Compact that
    // snapshot before it enters the store so a stale session cannot recreate a
    // large object graph on startup.
    const maxStart = d.queue.length - MAX_RESTORED_QUEUE_ENTRIES;
    const start = Math.min(Math.max(0, d.index - 1), maxStart);
    return {
      queue: d.queue.slice(start, start + MAX_RESTORED_QUEUE_ENTRIES),
      index: Math.max(0, d.index - start),
      currentSong: d.currentSong,
    };
  } catch {
    return { queue: [], index: -1, currentSong: null };
  }
}

function writeSession(s: SessionData) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** Remove obsolete storage keys from older app versions. */
function clearLegacyKeys() {
  try {
    for (const k of LEGACY_KEYS) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

/**
 * 首页歌词文案的形状与内容校验：localStorage 里的缓存可能来自旧版本
 * 或已损坏，直接展示会出现空串、超长行、控制字符等显示异常。
 */
function isValidHomeQuote(
  value: unknown,
): value is { text: string; source: string } {
  if (!value || typeof value !== "object") return false;
  const { text, source } = value as { text?: unknown; source?: unknown };
  if (typeof text !== "string" || typeof source !== "string") return false;
  const t = text.trim();
  const s = source.trim();
  if (t.length < 6 || t.length > 80 || !s || s.length > 60) return false;
  // 控制字符视为损坏数据
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(t + s)) return false;
  // 逐字歌词 JSON 时间轴碎片（如 {"t":1000,"c":}）不是正常文案
  if (/[{}]|"\w+"\s*[:：]/.test(t)) return false;
  return true;
}

const restoredSession = readSession();
const cachedProfile = readCachedProfile();
const cachedHotPlaylists = readJson<PlaylistInfo[]>(
  HOME_PLAYLISTS_CACHE_KEY,
  [],
);
const cachedTopSongs = readJson<Song[]>(HOME_TOP_CACHE_KEY, []);
const cachedHomeQuoteRaw = readJson<{ text: string; source: string } | null>(
  HOME_QUOTE_CACHE_KEY,
  null,
);
// 旧版本或损坏的缓存可能包含任意内容，展示前必须校验。
const cachedHomeQuote = isValidHomeQuote(cachedHomeQuoteRaw)
  ? cachedHomeQuoteRaw
  : null;
const cachedRecommendSongs = cachedProfile
  ? readJson<Song[]>(recommendCacheKey(cachedProfile.userId), [])
  : [];
const cachedLikedIds = cachedProfile
  ? readJson<number[]>(likedIdsCacheKey(cachedProfile.userId), [])
  : [];
const cachedVipInfo = cachedProfile
  ? readJson<VipInfo | null>(vipCacheKey(cachedProfile.userId), null)
  : null;
clearLegacyKeys();

let toastSeq = 0;
let homeLoadPromise: Promise<void> | null = null;
let homeQuoteLoadPromise: Promise<void> | null = null;
let vipInfoLoadedAt = 0;

/* ── 听歌打卡（与官方播放数据对齐） ─────────────────────────────
 * 官方客户端把「最近播放 / 听歌排行 / 每日推荐演化」建立在 playend
 * 上报之上；本播放器此前从不上报，两端数据永久分叉。这里在切歌与
 * 自然播完两个结算点，把上一曲累计进度回传给官方接口：
 * - 单次有效播放门槛 30s（官方规则），不足不记；
 * - 试听歌曲（previewEnd 截断）不算完整收听，不上报；
 * - 同一首歌 90s 内去重——ended 兜底定时器与手动切歌可能连续触发。
 */
let lastScrobbleId = 0;
let lastScrobbleAt = 0;
let likedSyncedAt = 0;
function settleScrobble(): void {
  const { currentSong, progress, duration, previewEnd, loggedIn } =
    usePlayerStore.getState();
  if (!loggedIn || !currentSong) return;
  if (previewEnd !== null) return; // 试听片段不计入官方记录
  const playedMs = Math.min(progress, duration || progress);
  if (playedMs < 30_000) return;
  const now = Date.now();
  if (currentSong.id === lastScrobbleId && now - lastScrobbleAt < 90_000) {
    return;
  }
  lastScrobbleId = currentSong.id;
  lastScrobbleAt = now;
  reportSongPlayed(currentSong.id, playedMs).catch(() => {});
}
let fmBatchPromise: Promise<Song[]> | null = null;
let fmRetryStreak = 0;
let searchToken = 0;
let playlistRequestToken = 0;
// Incremented whenever the authenticated account/session changes. Async
// responses from an older session must never overwrite the current account.
let accountDataGeneration = 0;
let homeRequestToken = 0;
const searchCache = new Map<string, { at: number; songs: Song[] }>();
const SEARCH_CACHE_TTL = 5 * 60 * 1000;
const MAX_SEARCH_CACHE_ENTRIES = 24;
/** FM is an endless stream; retain only a small playback window in memory. */
const MAX_FM_QUEUE_ENTRIES = 60;

function trimFmQueue(
  queue: Song[],
  index: number,
): { queue: Song[]; index: number } {
  if (queue.length <= MAX_FM_QUEUE_ENTRIES) return { queue, index };

  // Keep the current item plus a bounded amount of history/upcoming tracks.
  // Old FM entries are not needed for navigation and otherwise accumulate for
  // the lifetime of the app.
  const maxStart = queue.length - MAX_FM_QUEUE_ENTRIES;
  const start = Math.min(Math.max(0, index - 1), maxStart);
  return {
    queue: queue.slice(start, start + MAX_FM_QUEUE_ENTRIES),
    index: Math.max(0, index - start),
  };
}

function requestPersonalFmBatch(): Promise<Song[]> {
  if (!fmBatchPromise) {
    fmBatchPromise = getPersonalFm().finally(() => {
      fmBatchPromise = null;
    });
  }
  return fmBatchPromise;
}

/** Monotonic token so a slow url lookup cannot override a newer play request. */
let playToken = 0;

/** Consecutive unplayable tracks; bounds the auto-skip so it cannot loop. */
let failStreak = 0;

interface PlayerState {
  // --- auth ---
  authReady: boolean;
  loggedIn: boolean;
  profile: UserProfile | null;
  likedIds: number[];
  likedSongs: Song[];
  likedAt: Record<number, number>;
  vipInfo: VipInfo | null;
  recentSongs: Song[];
  homeQuote: { text: string; source: string } | null;
  /** 候选池全部失败时置位：首页据此隐藏加载占位，避免永久“正在挑选…”。 */
  homeQuoteUnavailable: boolean;

  // --- audio ---
  audioEl: HTMLAudioElement | null;
  activeAudio: 0 | 1;
  currentSong: Song | null;
  currentUrl: string | null;
  /** End position for the current non-member VIP preview, in milliseconds. */
  previewEnd: number | null;
  preloadedSongId: number | null;
  preloadedUrl: string | null;
  qualitySwitchUrl: string | null;
  qualitySwitchQuality: PlaybackQuality | null;
  qualitySwitchPrevious: PlaybackQuality | null;
  qualitySwitching: boolean;
  pendingSeek: number | null;
  loadingUrl: boolean;
  /**
   * Non-zero while playSong is optimistically committed but the new URL has
   * not resolved yet. The audio "ended" path must ignore events fired by the
   * outgoing track during this window, otherwise the freshly selected song is
   * skipped entirely.
   */
  pendingPlayToken: number;
  playing: boolean;
  progress: number;
  duration: number;
  volume: number;
  muted: boolean;
  playbackQuality: PlaybackQuality;
  availablePlaybackQualities: PlaybackQuality[];
  playMode: PlayMode;

  // --- queue ---
  queue: Song[];
  index: number;
  queueSource: QueueSource;

  // --- lyrics ---
  lyricLines: LyricLine[];
  /** Song the current lyricLines belong to; null when nothing is loaded. */
  lyricSongId: number | null;
  showTranslation: boolean;

  // --- update ---
  updatePhase: UpdatePhase;
  updateVersion: string | null;
  updateNotes: string;
  updateProgress: number;
  updateTransferred: number;
  updateTotal: number;
  updateSpeed: number;
  updateErrorStage: "check" | "download" | "install" | "";
  updateError: string;
  showUpdate: boolean;

  // --- appearance ---
  theme: ThemePreference;
  glassOpacity: GlassOpacity;
  glassBlur: GlassBlur;
  glassContrast: GlassContrast;
  animationSpeed: AnimationSpeed;
  reducedMotion: boolean;
  /** 歌曲切换 / 音质切换的音量淡入淡出开关。 */
  audioFadeEnabled: boolean;
  /** 淡入淡出时长（秒），1~12。 */
  audioFadeSeconds: number;
  /** 歌单 / 歌曲列表是否展示专辑封面。 */
  showListCover: boolean;
  /** 启动 Reverie 后直接进入私人漫游。 */
  launchFmOnStart: boolean;
  /** 跨端续播开关（开启后本机作为续播设备上报）。 */
  crossDeviceResume: boolean;
  lyricTheme: LyricTheme;
  lyricFontSize: number;
  particleEffect: ParticleEffect;
  /** Cover render level; "image" disables the particle system entirely. */
  coverQuality: CoverQuality;
  /** Why the current level was chosen, shown in settings. */
  coverQualityReason: string;
  coverBenchmarking: boolean;

  // --- ui / data ---
  activeView: View;
  prevView: View;
  currentPage: "browse" | "nowplaying";
  searchOpen: boolean;
  searchKeyword: string;
  searchResults: Song[];
  searching: boolean;
  viewScrollPositions: Partial<Record<View, number>>;
  topSongs: Song[];
  topSongsLoading: boolean;
  hotPlaylists: PlaylistInfo[];
  hotPlaylistsLoading: boolean;
  userPlaylists: PlaylistInfo[];
  userPlaylistsLoading: boolean;
  playlistSongs: Song[];
  playlistLoading: boolean;
  playlistId: number;
  playlistName: string;
  playlistCover: string;
  playlistDescription: string;
  playlistCreatorId: number;
  playlistSubscribed: boolean;
  recommendSongs: Song[];
  recommendSongsLoading: boolean;
  likedSongsLoading: boolean;
  fmSongs: Song[];
  showLogin: boolean;
  showSettings: boolean;
  showNotifications: boolean;
  showCommentHistory: boolean;
  showLikes: boolean;
  showRecent: boolean;
  showArtistModal: boolean;
  showAlbumModal: boolean;
  /** 歌手/专辑详情弹窗的打开序号：决定两者叠加时的 DOM 顺序。 */
  artistModalSeq: number;
  albumModalSeq: number;
  showPlayerComments: boolean;
  /** 资源评论弹窗（如专辑弹窗内继续打开的评论区），叠加在详情弹窗之上。 */
  showCommentsModal: boolean;
  toasts: ToastMsg[];

  // --- actions ---
  setAudioEl: (el: HTMLAudioElement) => void;
  toast: (text: string, type?: ToastMsg["type"]) => void;
  dismissToast: (id: number) => void;
  togglePlay: () => void;
  /** 未登录返回 false 并弹出登录引导；已登录返回 true。 */
  requireLoginForPlayback: () => boolean;
  next: () => void;
  prev: () => void;
  seek: (ms: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  setPlayMode: (m: PlayMode) => void;
  setPlaybackQuality: (quality: PlaybackQuality) => Promise<void>;
  loadPlaybackQualities: (song: Song) => Promise<void>;
  requestPreloadNext: () => Promise<void>;
  commitQualitySwitch: (
    url: string,
    quality: PlaybackQuality,
    position: number,
  ) => void;
  cancelQualitySwitch: () => void;
  commitPreloaded: (
    song: Song,
    queue: Song[],
    source: QueueSource,
    url: string,
  ) => void;
  cyclePlayMode: () => void;
  setShowTranslation: (v: boolean) => void;
  loadLyrics: (song: Song) => Promise<void>;
  ensureLyrics: () => void;
  checkUpdate: (manual?: boolean) => void;
  startUpdate: () => void;
  installUpdate: () => void;
  dismissUpdate: () => void;
  applyUpdateEvent: (type: string, data?: unknown) => void;
  setTheme: (t: ThemePreference) => void;
  setGlassOpacity: (v: GlassOpacity) => void;
  setGlassBlur: (v: GlassBlur) => void;
  setGlassContrast: (v: GlassContrast) => void;
  setAnimationSpeed: (v: AnimationSpeed) => void;
  setReducedMotion: (v: boolean) => void;
  setAudioFadeEnabled: (v: boolean) => void;
  setAudioFadeSeconds: (v: number) => void;
  setShowListCover: (v: boolean) => void;
  setLaunchFmOnStart: (v: boolean) => void;
  setCrossDeviceResume: (v: boolean) => void;
  setLyricTheme: (t: LyricTheme) => void;
  setLyricFontSize: (s: number) => void;
  setParticleEffect: (e: ParticleEffect) => void;
  applyDiyPreset: (preset: "pure") => void;
  setCoverQuality: (q: CoverQuality, reason?: string) => void;
  /** Step one level down after sustained dropped frames. */
  degradeCoverQuality: () => void;
  /** Run the GPU benchmark; on first launch this picks the level. */
  detectCoverQuality: (manual?: boolean) => Promise<void>;
  setShowLogin: (v: boolean) => void;
  setShowSettings: (v: boolean) => void;
  setShowNotifications: (v: boolean) => void;
  setShowCommentHistory: (v: boolean) => void;
  setShowLikes: (v: boolean) => void;
  setShowRecent: (v: boolean) => void;
  setShowArtistModal: (v: boolean) => void;
  setShowAlbumModal: (v: boolean) => void;
  setShowPlayerComments: (v: boolean) => void;
  setShowCommentsModal: (v: boolean) => void;
  setActiveView: (v: View) => void;
  setPage: (p: "browse" | "nowplaying") => void;
  setSearchOpen: (v: boolean) => void;
  saveViewScroll: (view: View, top: number) => void;
  loadHome: (refreshPlaylists?: boolean) => Promise<void>;
  doSearch: (kw: string) => Promise<void>;
  loadTopSongs: () => Promise<void>;
  loadPersonalFm: () => Promise<void>;
  loadUserPlaylists: (navigate?: boolean) => Promise<void>;
  openPlaylist: (id: number, name: string) => Promise<void>;
  closePlaylist: () => void;
  playSong: (
    song: Song,
    queue?: Song[],
    source?: QueueSource,
    options?: {
      quality?: PlaybackQuality;
      startAt?: number;
      autoplay?: boolean;
    },
  ) => Promise<void>;
  failCurrent: (message: string) => void;
  notePlaybackOk: () => void;
  playQueueAt: (i: number) => Promise<void>;
  playNext: (song: Song) => void;
  fmNext: () => Promise<void>;
  fmDislike: () => Promise<void>;
  toggleLike: () => Promise<void>;
  loadLiked: () => Promise<void>;
  loadLikedSongs: () => Promise<void>;
  loadVipInfo: () => Promise<void>;
  trackRecent: (song: Song) => void;
  clearRecent: () => void;
  loadHomeQuote: () => Promise<void>;
  applyLogin: (cookie: string) => Promise<boolean>;
  logout: () => void;
  refreshLogin: () => Promise<void>;
}

type PlaybackUrlResult = {
  url: string | null;
  reason: string;
  previewEnd?: number;
};

export const PREVIEW_DURATION_MS = 60_000;

function hasVipAccess(state: {
  loggedIn: boolean;
  profile: UserProfile | null;
  vipInfo: VipInfo | null;
}): boolean {
  if (!state.loggedIn) return false;
  // 身份档位以官方 /vip/info 的包体生效状态为准：login/status 的
  // vipType 在会员过期后仍 >0，不能单独作为会员依据；vipType>0 且
  // 未过期（或无过期时间）才算有效会员，过期即降级为非会员口径。
  const v = state.vipInfo;
  if (v) {
    return (
      v.vipType > 0 &&
      (v.expireTime <= 0 || v.expireTime > Date.now())
    );
  }
  // 无 /vip/info 数据时的兜底（登录后尚未拉取到会员信息）。
  return Number(state.profile?.vipType ?? 0) > 0;
}

function previewDurationForSong(song: Song): number | null {
  return song.fee === 1 && !hasVipAccess(usePlayerStore.getState())
    ? PREVIEW_DURATION_MS
    : null;
}

/** 用户当前的会员身份档位：以官方 /vip/info 包体生效状态为准。 */
export function userQualityTier(state: {
  loggedIn: boolean;
  profile: UserProfile | null;
  vipInfo: VipInfo | null;
}): QualityTier {
  if (!state.loggedIn) return "free";
  const v = state.vipInfo;
  if (
    v?.svip &&
    (v.expireTime <= 0 || v.expireTime > Date.now())
  ) {
    return "svip";
  }
  if (hasVipAccess(state)) return "vip";
  return "free";
}

/** 音质是否对该身份开放（免费音质人人可用；高等级身份向下兼容）。 */
export function qualityAllowedFor(
  quality: PlaybackQuality,
  tier: QualityTier,
): boolean {
  const need = PLAYBACK_QUALITY_TIER[quality];
  if (need === "free") return true;
  if (tier === "svip") return true;
  return tier === "vip" && need === "vip";
}

/**
 * 统一播放地址协议：部分歌曲解析出的 CDN 地址是 http，在安全上下文里
 * 会被拦截或静默失败，媒体管线报错后 play() 拒绝并提示「音频启动失败」。
 * 网易云 CDN 均支持 https，这里统一升级（本地地址除外）。
 */
function normalizePlaybackUrl(url: string): string {
  if (/^http:\/\/(127\.|localhost)/i.test(url)) return url;
  return url.replace(/^http:\/\//i, "https://");
}

function reasonFromApi(code: number, message: string): string {
  const text = message.toLowerCase();
  if (
    /vip|会员|付费|privilege|permission|权限|购买|订阅/.test(text) ||
    code === -110 ||
    code === 401 ||
    code === 403
  )
    return "该歌曲需要网易云音乐会员或更高账号权限";
  if (/copyright|版权|地区|region|territory|下架|不可用/.test(text))
    return "该歌曲受版权或地区限制，当前无法播放";
  if (/login|登录|cookie|未登录|账号/.test(text))
    return "该歌曲需要登录网易云音乐账号后播放";
  return message.trim();
}

/**
 * VIP 歌曲标识口径：fee 1 = 整首 VIP（非会员试听）；fee 8 = 非会员
 * 仅可免费听低音质、高音质需会员——官方列表对这两类都打 VIP 标。
 */
export function isVipSong(song: Song | null | undefined): boolean {
  if (!song) return false;
  return song.fee === 1 || song.fee === 8;
}

/** 列表音质标识：只标无损及以上，免费档（标准/较高/极高）不打标。 */
const SONG_LEVEL_BADGES: Record<string, { label: string; cls: string }> = {
  jymaster: { label: "超清母带", cls: "master" },
  sky: { label: "沉浸环绕声", cls: "sky" },
  vivid: { label: "全景声", cls: "vivid" },
  jyeffect: { label: "高清环绕声", cls: "surround" },
  dolby: { label: "杜比全景声", cls: "dolby" },
  hires: { label: "Hi-Res", cls: "hires" },
  lossless: { label: "无损", cls: "lossless" },
};

/** 当前歌曲支持的最好音质标识（无则返回 null，即不打音质标）。 */
export function songQualityBadge(
  song: Song | null | undefined,
): { label: string; cls: string } | null {
  if (!song?.maxLevel) return null;
  return SONG_LEVEL_BADGES[song.maxLevel] ?? null;
}

export function playbackFailureMessage(
  song: Song | null,
  detail?: { code?: number; message?: string },
): string {
  const apiReason = reasonFromApi(
    Number(detail?.code ?? 0),
    String(detail?.message ?? ""),
  );
  if (apiReason) return apiReason;
  if (song?.fee === 1 && !hasVipAccess(usePlayerStore.getState()))
    return "该歌曲为 VIP 歌曲，请登录并开通网易云音乐会员后播放";
  if (song?.fee === 1) return "该歌曲需要网易云音乐会员或更高账号权限";
  return "该歌曲暂无可用播放资源，可能受版权、地区或账号权限限制";
}

async function resolveUrl(
  song: Song,
  preferredQuality: PlaybackQuality,
): Promise<PlaybackUrlResult> {
  // Non-member VIP songs use the standard endpoint, which returns a preview
  // segment when one is available instead of a full playback URL.
  const state = usePlayerStore.getState();
  const previewOnly = song.fee === 1 && !hasVipAccess(state);
  const requestedLevels: PlaybackQuality[] =
    preferredQuality === "standard"
      ? ["standard"]
      : preferredQuality === "higher"
        ? ["higher", "standard"]
        : preferredQuality === "exhigh"
          ? ["exhigh", "higher", "standard"]
          : [preferredQuality, "lossless", "exhigh", "higher", "standard"];
  const levels = previewOnly ? (["standard"] as const) : requestedLevels;
  let lastReason = "";
  for (const level of levels) {
    try {
      const result = await getSongUrl(song.id, level);
      if (result.url) {
        return {
          url: normalizePlaybackUrl(result.url),
          reason: "",
          // 试听总时长固定 60s：不跟随接口 freeTrialInfo 的窗口
          // （个别曲目会返回 30s 或中段摘录），统一从开头起播。
          previewEnd: previewOnly ? PREVIEW_DURATION_MS : undefined,
        };
      }
      const reason = reasonFromApi(result.code ?? 0, result.message ?? "");
      if (reason) lastReason = reason;
    } catch {
      lastReason = "播放地址服务暂时不可用，请检查网络连接后重试";
    }
  }
  try {
    const result = await getLegacySongUrl(song.id);
    if (result.url) {
      return {
        url: normalizePlaybackUrl(result.url),
        reason: "",
        previewEnd: previewOnly ? PREVIEW_DURATION_MS : undefined,
      };
    }
    const reason = reasonFromApi(result.code ?? 0, result.message ?? "");
    if (reason) lastReason = reason;
  } catch {
    lastReason = "播放地址服务暂时不可用，请检查网络连接后重试";
  }
  return {
    url: null,
    reason: lastReason || playbackFailureMessage(song),
  };
}

export const usePlayerStore = create<PlayerState>()((set, get) => ({
  // --- auth ---
  authReady: !getCookie() || cachedProfile !== null,
  loggedIn: cachedProfile !== null,
  profile: cachedProfile,
  likedIds: cachedLikedIds,
  likedSongs: [],
  likedAt: readLikedAt(),
  vipInfo: cachedVipInfo,
  recentSongs: readRecentSongs(),
  homeQuote: cachedHomeQuote,
  homeQuoteUnavailable: false,

  // --- audio ---
  audioEl: null,
  currentSong: restoredSession.currentSong,
  currentUrl: null,
  previewEnd: null,
  activeAudio: 0,
  preloadedSongId: null,
  preloadedUrl: null,
  qualitySwitchUrl: null,
  qualitySwitchQuality: null,
  qualitySwitchPrevious: null,
  qualitySwitching: false,
  pendingSeek: null,
  loadingUrl: false,
  pendingPlayToken: 0,
  playing: false,
  progress: 0,
  duration: restoredSession.currentSong?.duration ?? 0,
  volume: readNum("reverie_volume", 0.9),
  muted: false,
  playbackQuality: readPlaybackQuality(),
  availablePlaybackQualities: ["standard"],
  playMode: readPlayMode(),

  // --- queue ---
  queue: restoredSession.queue,
  index: restoredSession.index,
  queueSource: "list",

  // --- lyrics ---
  lyricLines: [],
  lyricSongId: null,
  showTranslation: readBool("reverie_translation", true),

  // --- update ---
  updatePhase: "idle",
  updateVersion: null,
  updateNotes: "",
  updateProgress: 0,
  updateTransferred: 0,
  updateTotal: 0,
  updateSpeed: 0,
  updateErrorStage: "",
  updateError: "",
  showUpdate: false,

  // --- appearance ---
  theme: readThemePref(),
  glassOpacity: readGlassOpacity(),
  glassBlur: readGlassBlur(),
  glassContrast: readGlassContrast(),
  animationSpeed: readAnimationSpeed(),
  reducedMotion: readBool("reverie_reduced_motion", false),
  audioFadeEnabled: readBool("reverie_audio_fade", true),
  audioFadeSeconds: Math.min(
    12,
    Math.max(1, Math.round(readNum("reverie_audio_fade_s", 2))),
  ),
  showListCover: readBool("reverie_list_cover", true),
  launchFmOnStart: readBool("reverie_launch_fm", false),
  crossDeviceResume: readBool("reverie_cross_resume", false),
  lyricTheme: readLyricTheme(),
  lyricFontSize: readNum("reverie_lyricfont", 22),
  particleEffect: readParticleEffect(),
  coverQuality: readCoverQuality(),
  coverQualityReason: readStr("reverie_cover_reason", ""),
  coverBenchmarking: false,

  // --- ui / data ---
  activeView: "home",
  prevView: "home",
  currentPage: "browse",
  searchOpen: false,
  searchKeyword: "",
  searchResults: [],
  searching: false,
  viewScrollPositions: {},
  topSongs: cachedTopSongs,
  topSongsLoading: false,
  hotPlaylists: cachedHotPlaylists,
  hotPlaylistsLoading: false,
  userPlaylists: [],
  userPlaylistsLoading: false,
  playlistSongs: [],
  playlistLoading: false,
  playlistId: 0,
  playlistName: "",
  playlistCover: "",
  playlistDescription: "",
  playlistCreatorId: 0,
  playlistSubscribed: false,
  recommendSongs: cachedRecommendSongs,
  recommendSongsLoading: false,
  likedSongsLoading: false,
  fmSongs: [],
  showLogin: false,
  showSettings: false,
  showNotifications: false,
  showCommentHistory: false,
  showLikes: false,
  showRecent: false,
  showArtistModal: false,
  showAlbumModal: false,
  artistModalSeq: 0,
  albumModalSeq: 0,
  showPlayerComments: false,
  showCommentsModal: false,
  toasts: [],

  // --- toast ---
  toast: (text, type = "info") => {
    if (type === "error") recordDiagnostic("error", text);
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts, { id, text, type }] }));
    const expire = () => {
      const current = get().toasts;
      if (current.some((item) => item.exiting)) {
        setTimeout(expire, 260);
        return;
      }
      const earliest = current.find((item) => !item.exiting);
      if (earliest) get().dismissToast(earliest.id);
    };
    setTimeout(expire, 3200);
  },
  dismissToast: (id) => {
    set((s) => ({
      toasts: s.toasts.map((t) => (t.id === id ? { ...t, exiting: true } : t)),
    }));
    setTimeout(
      () => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      260,
    );
  },

  setAudioEl: (el) => {
    if (!el) return;
    if (get().audioEl === el) return;
    // The element defaults to 1.0; without this the restored volume only takes
    // effect once the user touches the slider.
    const { muted, volume } = get();
    el.volume = muted ? 0 : volume;
    set({ audioEl: el });
  },
  // --- playback ---
  togglePlay: () => {
    if (!get().requireLoginForPlayback()) return;
    const {
      playing,
      currentUrl,
      currentSong,
      queue,
      queueSource,
      audioEl,
      muted,
      volume,
    } = get();
    if (!currentSong) return;
    if (!currentUrl) {
      get().playSong(currentSong, queue, queueSource);
      return;
    }
    const audioIsPlaying = Boolean(audioEl && !audioEl.paused);
    if (playing && audioIsPlaying) {
      audioEl?.pause();
      set({ playing: false });
      return;
    }

    if (!audioEl) {
      set({ playing: true });
      return;
    }

    audioEl.volume = muted ? 0 : volume;
    const request = audioEl.play();
    set({ playing: true });
    void request.catch(() => {
      if (get().currentUrl !== currentUrl) return;
      // 常见于 CDN 节点瞬断或加载竞态：重置媒体管线后自动重试一次，
      // 不再让用户手动多点一次播放。
      audioEl.pause();
      audioEl.load();
      audioEl.play().then(
        () => {
          if (get().currentUrl === currentUrl) set({ playing: true });
        },
        () => {
          if (get().currentUrl !== currentUrl || !get().playing) return;
          set({ playing: false });
          get().toast("音频启动失败，请点击播放重试", "error");
        },
      );
    });
  },
  next: () => {
    const { queue, index, playMode, queueSource } = get();
    if (!queue.length) return;
    if (queueSource === "fm") {
      void get().fmNext();
      return;
    }
    let ni = index;
    if (playMode === "shuffle") {
      ni = Math.floor(Math.random() * queue.length);
      if (queue.length > 1 && ni === index) ni = (ni + 1) % queue.length;
    } else {
      ni = index + 1;
      if (ni >= queue.length) ni = 0;
    }
    get().playQueueAt(ni);
  },
  prev: () => {
    const { queue, index, progress } = get();
    if (!queue.length) return;
    if (progress > 3000) {
      get().seek(0);
      return;
    }
    let pi = index - 1;
    if (pi < 0) pi = queue.length - 1;
    get().playQueueAt(pi);
  },
  seek: (ms) => {
    const el = get().audioEl;
    // Without a seekable element the progress bar would jump and snap back on
    // the next timeupdate.
    if (!el || !Number.isFinite(el.duration)) return;
    set({ progress: ms });
    el.currentTime = ms / 1000;
  },
  setVolume: (v) => {
    const vol = Math.min(1, Math.max(0, v));
    const el = get().audioEl;
    set({ volume: vol, muted: vol === 0 });
    if (el) el.volume = vol;
    write("reverie_volume", String(vol));
  },
  toggleMute: () => {
    const { muted, volume, audioEl } = get();
    const next = !muted;
    // Unmuting while the slider sits at 0 would stay silent; restore a level.
    const vol = !next && volume === 0 ? 0.5 : volume;
    set({ muted: next, volume: vol });
    if (vol !== volume) write("reverie_volume", String(vol));
    if (audioEl) audioEl.volume = next ? 0 : vol;
  },
  setPlayMode: (m) => {
    set({ playMode: m });
    write("reverie_playmode", m);
  },
  setPlaybackQuality: async (quality) => {
    const current = get();
    // 身份门槛（官方权益）：免费音质人人可用；VIP/SVIP 音质要求对应身份。
    if (!qualityAllowedFor(quality, userQualityTier(current))) {
      const need = PLAYBACK_QUALITY_TIER[quality];
      get().toast(
        need === "svip"
          ? "该音质为黑胶超级会员特权，暂无法使用"
          : "该音质需要网易云音乐会员，暂无法使用",
        "info",
      );
      return;
    }
    if (!current.availablePlaybackQualities.includes(quality)) {
      get().toast("该歌曲不支持此音质", "info");
      return;
    }
    if (current.playbackQuality === quality && !current.qualitySwitching)
      return;
    const previousQuality = current.playbackQuality;
    set({
      playbackQuality: quality,
      preloadedSongId: null,
      preloadedUrl: null,
      qualitySwitchUrl: null,
      qualitySwitchQuality: null,
      qualitySwitchPrevious: current.playbackQuality,
      qualitySwitching: Boolean(current.currentSong),
    });
    write("reverie_playback_quality", quality);
    const { currentSong } = get();
    if (!currentSong) return;
    const resolution = await resolveUrl(currentSong, quality);
    const latest = get();
    if (
      latest.currentSong?.id !== currentSong.id ||
      latest.playbackQuality !== quality
    )
      return;
    if (!resolution.url) {
      set({
        playbackQuality: previousQuality,
        qualitySwitchUrl: null,
        qualitySwitchQuality: null,
        qualitySwitchPrevious: null,
        qualitySwitching: false,
      });
      write("reverie_playback_quality", previousQuality);
      get().toast(
        resolution.reason || "该歌曲暂不支持此音质，已保留原音质",
        "info",
      );
      return;
    }
    set({
      qualitySwitchUrl: resolution.url,
      qualitySwitchQuality: quality,
      qualitySwitching: true,
    });
  },
  loadPlaybackQualities: async (song) => {
    try {
      const privileges = await getAlbumPrivileges(song.albumId);
      const privilege = privileges.find((item) => item.songId === song.id);
      const available: PlaybackQuality[] = privilege
        ? qualitiesFromPrivilege(privilege)
        : ["standard"];
      if (get().currentSong?.id !== song.id) return;
      set({ availablePlaybackQualities: available });
      // 自动回退只允许落在当前身份可用的音质上，避免静音质地
      // 把用户顶到无权限的等级。
      const tier = userQualityTier(get());
      const usable = available.filter((q) => qualityAllowedFor(q, tier));
      const currentQuality = get().playbackQuality;
      if (!usable.includes(currentQuality)) {
        const fallback =
          [...usable].reverse()[0] ??
          ([...available].filter((q) => qualityAllowedFor(q, "free"))[0] ??
            "standard");
        set({ playbackQuality: fallback });
        write("reverie_playback_quality", fallback);
      }
    } catch {
      if (get().currentSong?.id === song.id)
        set({ availablePlaybackQualities: ["standard"] });
    }
  },
  /**
   * 临近曲目结束时才预取下一首地址：高音质（无损/Hi-Res/母带）文件
   * 大，起播即并发预取会与当前曲抢带宽，造成卡顿与起播慢。由播放
   * 进度采样在剩余时间进入窗口后调用；动作内部多重早退保证幂等廉价。
   */
  requestPreloadNext: async () => {
    const s = get();
    if (!s.currentSong || s.pendingPlayToken !== 0 || s.loadingUrl) return;
    if (s.preloadedSongId !== null || s.preloadedUrl) return;
    if (s.queueSource === "fm") return; // FM 由漫游批次自行补充队列
    const q = s.queue;
    if (!q.length) return;
    let ni = -1;
    if (s.playMode === "shuffle" && q.length > 1) {
      ni = Math.floor(Math.random() * q.length);
      if (ni === s.index) ni = (s.index + 1) % q.length;
    } else if (s.index + 1 < q.length) {
      ni = s.index + 1;
    }
    const ns = ni >= 0 ? q[ni] : null;
    if (!ns || ns.id === s.currentSong.id) return;
    try {
      const r = await resolveUrl(ns, s.playbackQuality);
      const l = get();
      if (
        l.currentSong?.id !== s.currentSong.id ||
        l.preloadedSongId !== null ||
        l.pendingPlayToken !== 0
      )
        return;
      if (r.url) set({ preloadedSongId: ns.id, preloadedUrl: r.url });
    } catch {
      /* ignore */
    }
  },
  commitQualitySwitch: (url, quality, position) => {    const state = get();
    if (
      !state.currentSong ||
      state.qualitySwitchUrl !== url ||
      state.qualitySwitchQuality !== quality
    )
      return;
    set({
      currentUrl: url,
      playbackQuality: quality,
      qualitySwitchUrl: null,
      qualitySwitchQuality: null,
      qualitySwitchPrevious: null,
      qualitySwitching: false,
      pendingSeek: null,
      progress: position,
      activeAudio: state.activeAudio === 0 ? 1 : 0,
    });
    write("reverie_playback_quality", quality);
  },
  cancelQualitySwitch: () => {
    const state = get();
    const quality = state.qualitySwitchPrevious ?? state.playbackQuality;
    set({
      playbackQuality: quality,
      qualitySwitchUrl: null,
      qualitySwitchQuality: null,
      qualitySwitchPrevious: null,
      qualitySwitching: false,
    });
    write("reverie_playback_quality", quality);
  },
  commitPreloaded: (song, queue, source, url) => {
    const state = get();
    // 无缝续播切歌同样先结算上一曲打卡。
    settleScrobble();
    const index = queue.findIndex((item) => item.id === song.id);
    if (
      index < 0 ||
      state.preloadedSongId !== song.id ||
      state.preloadedUrl !== url
    )
      return;
    set({
      queue,
      index,
      queueSource: source,
      currentSong: song,
      currentUrl: url,
      previewEnd: previewDurationForSong(song),
      preloadedSongId: null,
      preloadedUrl: null,
      loadingUrl: false,
      playing: true,
      progress: 0,
      duration: song.duration || 0,
      activeAudio: state.activeAudio === 0 ? 1 : 0,
    });
    writeSession({ queue, index, currentSong: song });
    void get().loadPlaybackQualities(song);
    get().loadLyrics(song);
    get().trackRecent(song);
    // 下一首地址改为临近结束才预取（requestPreloadNext，由播放进度
    // 采样触发）：高音质文件大，起播即并发预取会与当前曲抢带宽。
  },
  cyclePlayMode: () => {
    const order: PlayMode[] = ["sequence", "one", "shuffle"];
    const cur = get().playMode;
    const next = order[(order.indexOf(cur) + 1) % order.length];
    set({ playMode: next });
    write("reverie_playmode", next);
  },
  setShowTranslation: (v) => {
    set({ showTranslation: v });
    write("reverie_translation", v ? "1" : "0");
  },
  /**
   * Fetch the lyrics for a song. Tagged with lyricSongId so a slow response
   * cannot land on top of a song the user has already switched away from.
   */
  loadLyrics: async (song) => {
    set({
      lyricSongId: song.id,
      lyricLines: [{ time: 0, text: "加载歌词中…" }],
    });
    try {
      const { lrc, tlyric } = await getLyric(song.id);
      if (get().lyricSongId !== song.id) return;
      set({ lyricLines: parseLyrics(lrc, tlyric) });
    } catch {
      if (get().lyricSongId !== song.id) return;
      set({ lyricLines: [{ time: 0, text: "暂无歌词" }] });
    }
  },
  /**
   * The lyric view opened for a song whose lyrics were never fetched. Playing a
   * song loads them, but a session restored on startup never went through
   * playSong, so its lyrics would stay empty until the user pressed play.
   */
  ensureLyrics: () => {
    const { currentSong, lyricSongId } = get();
    if (!currentSong || lyricSongId === currentSong.id) return;
    get().loadLyrics(currentSong);
  },
  checkUpdate: (manual = false) => {
    if (!window.ncm?.checkUpdate) {
      if (manual) get().toast("当前环境不支持自动更新", "error");
      return;
    }
    if (get().updatePhase === "checking") return;
    set({ updatePhase: "checking", updateErrorStage: "", updateError: "" });
    window.ncm
      .checkUpdate(manual)
      .then((r) => {
        if (r.ok) return;
        set({ updatePhase: "idle", updateErrorStage: "", updateError: "" });
        if (!manual) return;
        if (r.reason === "busy") get().toast("正在检查更新，请稍候", "info");
        else if (r.reason === "downloaded")
          get().toast("更新已下载，请重启安装", "info");
        else if (r.reason === "throttled")
          get().toast("刚刚检查过更新，请稍候再试", "info");
        else get().toast("当前环境不支持自动更新", "error");
      })
      .catch(() =>
        set({ updatePhase: "idle", updateErrorStage: "", updateError: "" }),
      );
  },
  startUpdate: () => {
    if (!window.ncm?.downloadUpdate) return;
    set({
      updatePhase: "downloading",
      updateProgress: 0,
      updateTransferred: 0,
      updateTotal: 0,
      updateSpeed: 0,
      updateErrorStage: "",
      updateError: "",
      showUpdate: true,
    });
    window.ncm
      .downloadUpdate()
      .then((r) => {
        if (!r.ok) {
          set({ updatePhase: "error", showUpdate: true });
          get().toast("下载更新失败，请稍后重试", "error");
        }
      })
      .catch(() => {
        set({ updatePhase: "error", showUpdate: true });
        get().toast("下载更新失败，请稍后重试", "error");
      });
  },
  installUpdate: () => {
    if (
      !window.ncm?.installUpdate ||
      (get().updatePhase !== "downloaded" &&
        !(
          get().updatePhase === "error" && get().updateErrorStage === "install"
        ))
    )
      return;
    set({
      updatePhase: "installing",
      updateErrorStage: "",
      updateError: "",
      showUpdate: true,
    });
    void window.ncm.installUpdate();
  },
  dismissUpdate: () => {
    // Remember the dismissal per version: next launch shows only a hint.
    if (get().updatePhase === "available" && get().updateVersion) {
      try {
        localStorage.setItem("reverie_update_dismissed", get().updateVersion!);
      } catch {
        /* ignore */
      }
    }
    if (get().updatePhase === "installing") return;
    set({ showUpdate: false });
  },
  applyUpdateEvent: (type, data) => {
    switch (type) {
      case "checking":
        set({ updatePhase: "checking", updateErrorStage: "", updateError: "" });
        break;
      case "available": {
        const d = (data ?? {}) as {
          version?: string;
          notes?: string;
          manual?: boolean;
        };
        const version = d.version ?? "";
        set({
          updateVersion: version,
          updateNotes: d.notes ?? "",
          updateProgress: 0,
          updateErrorStage: "",
          updateError: "",
        });
        if (d.manual) {
          set({ updatePhase: "available", showUpdate: true });
          return;
        }
        // Auto check: show the dialog, unless the user already dismissed this
        // version — then fall back to a lightweight hint instead.
        let dismissed = "";
        try {
          dismissed = localStorage.getItem("reverie_update_dismissed") ?? "";
        } catch {
          /* ignore */
        }
        if (dismissed === version) {
          set({ updatePhase: "none", showUpdate: false });
          get().toast(
            `发现新版本 v${version}，可在 设置 → 检查更新 中更新`,
            "info",
          );
        } else {
          set({ updatePhase: "available", showUpdate: true });
        }
        return;
      }
      case "progress": {
        const d = (data ?? {}) as {
          percent?: number;
          transferred?: number;
          total?: number;
          speed?: number;
        };
        set({
          updatePhase: "downloading",
          updateProgress: Math.max(0, Math.min(100, Number(d.percent ?? 0))),
          updateTransferred: Number(d.transferred ?? 0),
          updateTotal: Number(d.total ?? 0),
          updateSpeed: Number(d.speed ?? 0),
          updateErrorStage: "",
          updateError: "",
        });
        return;
      }
      case "downloaded": {
        const d = (data ?? {}) as { version?: string };
        set({
          updatePhase: "downloaded",
          updateVersion: d.version ?? get().updateVersion,
          updateProgress: 100,
          updateErrorStage: "",
          updateError: "",
          showUpdate: true,
        });
        return;
      }
      case "installing": {
        const d = (data ?? {}) as { version?: string };
        set({
          updatePhase: "installing",
          updateVersion: d.version ?? get().updateVersion,
          updateErrorStage: "",
          updateError: "",
          showUpdate: true,
        });
        return;
      }
      case "not-available": {
        const d = (data ?? {}) as { manual?: boolean };
        set({ updatePhase: "none", updateErrorStage: "", updateError: "" });
        if (d.manual) get().toast("当前已是最新版本", "success");
        return;
      }
      case "error": {
        const d = (data ?? {}) as {
          manual?: boolean;
          stage?: "check" | "download" | "install";
          message?: string;
          version?: string;
        };
        const message = d.message || "更新操作失败，请稍后重试";
        set({
          updatePhase: "error",
          updateVersion: d.version ?? get().updateVersion,
          updateErrorStage: d.stage ?? "check",
          updateError: message,
          showUpdate: d.stage !== "check",
        });
        if (d.manual || d.stage === "check")
          get().toast("检查更新失败，请稍后重试", "error");
        else if (d.stage === "install")
          get().toast("安装更新失败，请重试", "error");
        else get().toast("下载更新失败，请稍后重试", "error");
        return;
      }
      default:
        set({ updatePhase: "idle" });
    }
  },
  setTheme: (t) => {
    set({ theme: t });
    write("reverie_theme", t);
  },
  setGlassOpacity: (v) => {
    set({ glassOpacity: v });
    write("reverie_glass_opacity", v);
  },
  setGlassBlur: (v) => {
    set({ glassBlur: v });
    write("reverie_glass_blur", v);
  },
  setGlassContrast: (v) => {
    set({ glassContrast: v });
    write("reverie_glass_contrast", v);
  },
  setAnimationSpeed: (v) => {
    set({ animationSpeed: v });
    write("reverie_animation_speed", v);
  },
  setReducedMotion: (v) => {
    set({ reducedMotion: v });
    write("reverie_reduced_motion", v ? "1" : "0");
  },
  setAudioFadeEnabled: (v) => {
    set({ audioFadeEnabled: v });
    write("reverie_audio_fade", v ? "1" : "0");
  },
  setAudioFadeSeconds: (v) => {
    const n = Math.min(12, Math.max(1, Math.round(v)));
    set({ audioFadeSeconds: n });
    write("reverie_audio_fade_s", String(n));
  },
  setShowListCover: (v) => {
    set({ showListCover: v });
    write("reverie_list_cover", v ? "1" : "0");
  },
  setLaunchFmOnStart: (v) => {
    set({ launchFmOnStart: v });
    write("reverie_launch_fm", v ? "1" : "0");
  },
  setCrossDeviceResume: (v) => {
    set({ crossDeviceResume: v });
    write("reverie_cross_resume", v ? "1" : "0");
  },
  setLyricTheme: (t: LyricTheme) => {
    set({ lyricTheme: t });
    write("reverie_lyrictheme", t);
  },
  setLyricFontSize: (s) => {
    set({ lyricFontSize: s });
    write("reverie_lyricfont", String(s));
  },
  setParticleEffect: (e) => {
    set({ particleEffect: e });
    write("reverie_particle", e);
  },
  applyDiyPreset: (preset) => {
    if (preset !== "pure") return;
    set({
      lyricTheme: "pure",
      particleEffect: "none",
      coverQuality: "image",
      coverQualityReason: "纯净预设",
    });
    write("reverie_lyrictheme", "pure");
    write("reverie_particle", "none");
    write(COVER_QUALITY_KEY, "image");
    write("reverie_cover_reason", "纯净预设");
  },
  setCoverQuality: (q, reason = "") => {
    set({ coverQuality: q, coverQualityReason: reason });
    write(COVER_QUALITY_KEY, q);
    write("reverie_cover_reason", reason);
  },
  degradeCoverQuality: () => {
    const order: CoverQuality[] = ["ultra", "high", "medium", "low", "image"];
    const i = order.indexOf(get().coverQuality);
    if (i < 0 || i >= order.length - 1) return;
    const next = order[i + 1];
    get().setCoverQuality(
      next,
      `实际渲染帧率过低，已自动降到「${QUALITY_LABEL[next]}」`,
    );
    get().toast(`封面渲染卡顿，已自动降为「${QUALITY_LABEL[next]}」`, "info");
  },
  detectCoverQuality: async (manual = false) => {
    if (get().coverBenchmarking) return;
    // Only ever runs itself once; the settings panel can force a re-run.
    if (!manual && readBool(COVER_BENCH_KEY, false)) return;
    if (!hasWebGL()) {
      get().setCoverQuality("image", "此设备不支持 WebGL，已使用静态封面");
      write(COVER_BENCH_KEY, "1");
      return;
    }
    set({ coverBenchmarking: true });
    try {
      const result = await benchmarkCoverQuality();
      get().setCoverQuality(result.quality, result.reason);
      write(COVER_BENCH_KEY, "1");
      if (manual) get().toast(result.reason, "success");
    } catch {
      get().setCoverQuality("image", "性能检测失败，已使用静态封面");
      write(COVER_BENCH_KEY, "1");
    } finally {
      set({ coverBenchmarking: false });
    }
  },
  setShowLogin: (v) => set({ showLogin: v }),
  setShowNotifications: (v) => set({ showNotifications: v }),
  setShowCommentHistory: (v) => set({ showCommentHistory: v }),
  setShowLikes: (v) => set({ showLikes: v }),
  setShowRecent: (v) => set({ showRecent: v }),
  setShowArtistModal: (v) =>
    set((s) =>
      v
        ? { showArtistModal: true, artistModalSeq: s.artistModalSeq + 1 }
        : { showArtistModal: false },
    ),
  setShowAlbumModal: (v) =>
    set((s) =>
      v
        ? { showAlbumModal: true, albumModalSeq: s.albumModalSeq + 1 }
        : { showAlbumModal: false },
    ),
  // 未登录时一切播放入口统一拦截：弹出扫码登录引导。
  requireLoginForPlayback: () => {
    if (usePlayerStore.getState().loggedIn) return true;
    usePlayerStore.getState().setShowLogin(true);
    return false;
  },
  setShowSettings: (v) =>
    set({ showSettings: v, ...(v ? { showPlayerComments: false } : {}) }),
  setShowPlayerComments: (v) =>
    set({ showPlayerComments: v, ...(v ? { showSettings: false } : {}) }),
  setShowCommentsModal: (v) => set({ showCommentsModal: v }),
  setActiveView: (v) => set({ activeView: v }),
  setPage: (p) => set({ currentPage: p }),
  setSearchOpen: (v) => {
    if (!v) searchToken++;
    set({ searchOpen: v, ...(v ? {} : { searching: false }) });
  },
  saveViewScroll: (view, top) =>
    set((state) => ({
      viewScrollPositions: {
        ...state.viewScrollPositions,
        [view]: Math.max(0, top),
      },
    })),

  // --- home dashboard ---
  loadHome: async (refreshPlaylists = false) => {
    const generation = accountDataGeneration;
    const requestToken = ++homeRequestToken;
    set({ activeView: "home" });
    // 未登录：不拉取、不保留任何首页数据。
    if (!get().loggedIn) {
      set({
        hotPlaylists: [],
        topSongs: [],
        recommendSongs: [],
        hotPlaylistsLoading: false,
        topSongsLoading: false,
        recommendSongsLoading: false,
      });
      return;
    }
    if (homeLoadPromise) {
      await homeLoadPromise;
      return get().loadHome(refreshPlaylists);
    }

    const tasks: Promise<unknown>[] = [];
    // 已有数据时一律静默刷新（不置 loading），只有空列表才显示骨架——
    // 否则每次进入首页都会用白色骨架替换已有内容，闪一下再刷新。
    if (
      refreshPlaylists ||
      !get().hotPlaylists.length ||
      !isCacheFresh(HOME_PLAYLISTS_CACHE_AT_KEY, HOME_DATA_CACHE_TTL)
    ) {
      if (!get().hotPlaylists.length) set({ hotPlaylistsLoading: true });
      tasks.push(
        getHotPlaylists(
          12,
          refreshPlaylists ? Math.floor(Math.random() * 8) * 12 : 0,
        )
          .then((lists) => {
            if (generation !== accountDataGeneration || requestToken !== homeRequestToken) return;
            set({ hotPlaylists: lists });
            writeJson(HOME_PLAYLISTS_CACHE_KEY, lists);
            touchCache(HOME_PLAYLISTS_CACHE_AT_KEY);
          })
          .finally(() => set({ hotPlaylistsLoading: false })),
      );
    }
    if (
      !get().topSongs.length ||
      !isCacheFresh(HOME_TOP_CACHE_AT_KEY, HOME_DATA_CACHE_TTL)
    ) {
      if (!get().topSongs.length) set({ topSongsLoading: true });
      tasks.push(
        getTopSongs(0, 10)
          .then((songs) => {
            if (generation !== accountDataGeneration || requestToken !== homeRequestToken) return;
            set({ topSongs: songs });
            writeJson(HOME_TOP_CACHE_KEY, songs);
            touchCache(HOME_TOP_CACHE_AT_KEY);
          })
          .finally(() => set({ topSongsLoading: false })),
      );
    }
    const profile = get().profile;
    if (
      get().loggedIn &&
      profile &&
      (!get().recommendSongs.length ||
        !isCacheFresh(
          recommendCacheAtKey(profile.userId),
          HOME_RECOMMEND_CACHE_TTL,
        ) ||
        // 「每日推荐」按天更新：缓存不是今天的即视为过期，
        // 跨天后的首次进入直接拉取新一天的个人推荐。
        !isSameLocalDay(recommendCacheAtKey(profile.userId)))
    ) {
      if (!get().recommendSongs.length) set({ recommendSongsLoading: true });
      tasks.push(
        getRecommendSongs()
          .then((songs) => {
            if (generation !== accountDataGeneration || requestToken !== homeRequestToken) return;
            set({ recommendSongs: songs });
            writeJson(recommendCacheKey(profile.userId), songs);
            touchCache(recommendCacheAtKey(profile.userId));
          })
          .finally(() => set({ recommendSongsLoading: false })),
      );
    }
    if (!tasks.length) return;

    const run = Promise.allSettled(tasks).then(() => {});
    homeLoadPromise = run;
    try {
      await run;
    } finally {
      if (homeLoadPromise === run) homeLoadPromise = null;
    }
  },

  // --- discovery ---
  doSearch: async (kw) => {
    const key = kw.trim();
    const token = ++searchToken;
    set({ searchOpen: true, searching: true });
    if (!key) {
      set({ searching: false, searchResults: [] });
      return;
    }
    if (!get().loggedIn) {
      // not logged in: don't load/display any data
      set({ searching: false, searchResults: [] });
      return;
    }
    const cacheKey = key.toLocaleLowerCase("zh-CN");
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.at < SEARCH_CACHE_TTL) {
      set({ searchResults: cached.songs, searching: false });
      return;
    }
    try {
      const results = await searchSongs(key, 40);
      if (token !== searchToken || !get().searchOpen) return;
      searchCache.set(cacheKey, { at: Date.now(), songs: results });
      while (searchCache.size > MAX_SEARCH_CACHE_ENTRIES) {
        const oldest = searchCache.keys().next().value;
        if (oldest === undefined) break;
        searchCache.delete(oldest);
      }
      set({ searchResults: results, searching: false });
      if (!results.length) get().toast("没有找到相关歌曲", "info");
    } catch {
      if (token !== searchToken) return;
      set({ searching: false });
      get().toast("搜索失败，请检查网络", "error");
    }
  },
  loadTopSongs: async () => {
    set({ activeView: "chart", topSongsLoading: true });
    try {
      const songs = await getTopSongs(0, 60);
      set({ topSongs: songs, topSongsLoading: false });
    } catch {
      set({ topSongsLoading: false });
      get().toast("加载排行榜失败", "error");
    }
  },
  loadPersonalFm: async () => {
    if (!get().loggedIn) {
      get().toast("请先登录", "info");
      set({ showLogin: true });
      return;
    }
    try {
      const songs = await requestPersonalFmBatch();
      fmRetryStreak = 0;
      set({ fmSongs: songs });
      if (songs.length) get().playSong(songs[0], songs, "fm");
      else get().toast("暂无内容", "info");
    } catch {
      get().toast("加载私人漫游失败", "error");
    }
  },
  loadUserPlaylists: async (navigate = true) => {
    const uid = get().profile?.userId;
    const generation = accountDataGeneration;
    if (!uid) {
      get().toast("请先登录", "info");
      set({ showLogin: true });
      return;
    }
    set({
      ...(navigate ? { activeView: "userlist" as View } : {}),
      userPlaylistsLoading: true,
    });
    try {
      const lists = await getUserPlaylists(uid);
      if (generation !== accountDataGeneration || get().profile?.userId !== uid) return;
      set({ userPlaylists: lists });
    } catch {
      get().toast("加载我的歌单失败", "error");
    } finally {
      set({ userPlaylistsLoading: false });
    }
  },
  openPlaylist: async (id, name) => {
    const requestToken = ++playlistRequestToken;
    set({
      activeView: "playlist",
      playlistName: name,
      prevView: get().activeView,
      // Keep the previous rows visible while the next playlist loads. Clearing
      // them first causes a visible blank/loading flash during navigation.
      playlistLoading: true,
    });
    try {
      const detail = await getPlaylistDetail(id);
      if (requestToken !== playlistRequestToken) return;
      const { songs } = detail;
      set({
        playlistSongs: songs,
        playlistId: detail.id,
        playlistName: detail.name,
        playlistCover: detail.coverImgUrl,
        playlistDescription: detail.description,
        playlistCreatorId: detail.creatorId,
        playlistSubscribed: detail.subscribed,
      });
      if (!songs.length) get().toast("歌单为空", "info");
    } catch {
      if (requestToken !== playlistRequestToken) return;
      get().toast("载入歌单失败", "error");
    } finally {
      if (requestToken === playlistRequestToken)
        set({ playlistLoading: false });
    }
  },
  closePlaylist: () => {
    set({
      playlistSongs: [],
      playlistId: 0,
      playlistName: "",
      playlistCover: "",
      playlistDescription: "",
      playlistCreatorId: 0,
      playlistSubscribed: false,
      activeView: get().prevView || "home",
    });
  },

  // --- core play ---
  playSong: async (song, queue, source, options) => {
    // 未登录统一拦截：所有播放入口（点歌、下一首/上一首、私人FM、
    // 搜索结果等）最终都会经过这里。
    if (!get().requireLoginForPlayback()) return;
    const st = get();
    // 切歌前先结算上一曲的听歌打卡（≥30s 才计为有效播放）。
    settleScrobble();
    const quality = options?.quality ?? st.playbackQuality;
    const autoplay = options?.autoplay ?? true;
    const activeSource = source ?? (queue ? "list" : st.queueSource);
    let targetQueue = queue;
    let targetIndex = queue
      ? queue.findIndex((s) => s.id === song.id)
      : st.index;
    if (!targetQueue || targetQueue.length === 0) {
      targetQueue = [song];
      targetIndex = 0;
    }
    if (targetIndex < 0) targetIndex = 0;
    if (activeSource === "fm") {
      const trimmed = trimFmQueue(targetQueue, targetIndex);
      targetQueue = trimmed.queue;
      targetIndex = trimmed.index;
    }

    const token = ++playToken;
    // Manual next/previous clicks should promote the already buffered decoder
    // just like automatic end-of-track playback. Re-resolving the URL here
    // discards the prepared buffer and is the main source of rapid-switch lag.
    const promotedUrl = st.preloadedSongId === song.id ? st.preloadedUrl : null;
    const promotedAudio = promotedUrl
      ? st.activeAudio === 0
        ? 1
        : 0
      : st.activeAudio;
    // 试听歌曲固定从歌曲开头起播：忽略续播位置（最近播放的 startAt）。
    const trialEnd = previewDurationForSong(song);

    set({
      queue: targetQueue,
      index: targetIndex,
      queueSource: source ?? (queue ? "list" : st.queueSource),
      currentSong: song,
      currentUrl: promotedUrl,
      previewEnd: promotedUrl ? trialEnd : null,
      preloadedSongId: null,
      preloadedUrl: null,
      qualitySwitchUrl: null,
      qualitySwitchQuality: null,
      qualitySwitchPrevious: null,
      qualitySwitching: false,
      pendingSeek: trialEnd !== null ? null : (options?.startAt ?? null),
      loadingUrl: !promotedUrl,
      pendingPlayToken: promotedUrl ? 0 : token,
      playing: autoplay,
      progress: 0,
      duration: song.duration || 0,
      availablePlaybackQualities: ["standard"],
      activeAudio: promotedAudio,
    });
    void get().loadPlaybackQualities(song);
    if (
      activeSource === "fm" &&
      targetQueue &&
      targetIndex >= targetQueue.length - 2
    ) {
      void requestPersonalFmBatch()
        .then((incoming) => {
          const state = get();
          if (state.queueSource !== "fm") return;
          const known = new Set(state.queue.map((item) => item.id));
          const fresh = incoming.filter((item) => !known.has(item.id));
          if (!fresh.length) return;
          const extended = trimFmQueue([...state.queue, ...fresh], state.index);
          set({
            queue: extended.queue,
            fmSongs: extended.queue,
            index: extended.index,
          });
        })
        .catch(() => {});
    }
    writeSession({ queue: targetQueue, index: targetIndex, currentSong: song });
    get().loadLyrics(song);
    get().trackRecent(song);

    const resolution = promotedUrl
      ? { url: promotedUrl, reason: "" }
      : await resolveUrl(song, quality);
    // A newer play request started while this url was resolving: drop this one
    // instead of playing a song the user already moved on from.
    if (token !== playToken) return;
    if (!resolution.url) {
      set({
        loadingUrl: false,
        currentUrl: null,
        playing: false,
        pendingPlayToken: 0,
      });
      get().failCurrent(resolution.reason);
      return;
    }
    set({
      currentUrl: resolution.url,
      previewEnd: resolution.previewEnd ?? null,
      loadingUrl: false,
      playing: autoplay,
      pendingPlayToken: 0,
    });
    // 下一首地址同样改为临近结束才预取（见 requestPreloadNext）。
  },
  /**
   * The current track cannot be played. Move on to the next one, but stop once
   * the whole queue has failed (capped at 10 tries) so an all-VIP list cannot
   * spin forever. The streak is cleared as soon as audio actually plays.
   */
  failCurrent: (message) => {
    const { queue, currentSong, queueSource } = get();
    if (!currentSong) return;
    failStreak++;
    if (queueSource === "fm" && failStreak < 30) {
      if (failStreak === 1) get().toast("该歌曲暂时无法播放，继续漫游", "info");
      void get().fmNext();
      return;
    }
    if (queue.length > 1 && failStreak < Math.min(queue.length, 10)) {
      if (failStreak === 1) get().toast("无法播放，正在自动跳过…", "info");
      get().next();
      return;
    }
    failStreak = 0;
    get().toast(message, "error");
  },
  notePlaybackOk: () => {
    failStreak = 0;
  },
  playQueueAt: async (i) => {
    const { queue, queueSource } = get();
    const song = queue[i];
    if (!song) return;
    await get().playSong(song, queue, queueSource);
  },
  playNext: (song) => {
    const state = get();
    if (!state.currentSong || !state.queue.length) {
      void get().playSong(song, [song]);
      return;
    }
    const queue = state.queue.filter((item) => item.id !== song.id);
    const currentIndex = queue.findIndex(
      (item) => item.id === state.currentSong?.id,
    );
    queue.splice(Math.min(currentIndex + 1, queue.length), 0, song);
    set({ queue, index: currentIndex });
    writeSession({
      queue,
      index: currentIndex,
      currentSong: state.currentSong,
    });
    get().toast("已加入下一首播放", "success");
  },
  fmNext: async () => {
    const { queue, index, queueSource } = get();
    if (queueSource !== "fm") return;
    const nextIdx = index + 1;
    if (nextIdx < queue.length) {
      await get().playQueueAt(nextIdx);
      return;
    }
    try {
      const incoming = await requestPersonalFmBatch();
      const latest = get();
      if (latest.queueSource !== "fm") return;
      if (latest.index + 1 < latest.queue.length) {
        await get().playQueueAt(latest.index + 1);
        return;
      }
      const known = new Set(latest.queue.map((song) => song.id));
      const songs = incoming.filter((song) => !known.has(song.id));
      if (!songs.length) {
        fmRetryStreak++;
        const delay = Math.min(1000 * fmRetryStreak, 5000);
        window.setTimeout(() => void get().fmNext(), delay);
        return;
      }
      fmRetryStreak = 0;
      const extended = trimFmQueue([...latest.queue, ...songs], latest.index);
      set({
        queue: extended.queue,
        fmSongs: extended.queue,
        index: extended.index,
      });
      await get().playSong(songs[0], extended.queue, "fm");
    } catch {
      fmRetryStreak++;
      if (fmRetryStreak === 1)
        get().toast("漫游网络波动，正在自动重试", "info");
      const delay = Math.min(1500 * fmRetryStreak, 6000);
      window.setTimeout(() => void get().fmNext(), delay);
    }
  },
  fmDislike: async () => {
    const { currentSong } = get();
    if (!currentSong) return;
    try {
      await fmTrash(currentSong.id);
      get().toast("已标记为不喜欢，将减少推荐", "info");
    } catch {
      /* ignore */
    }
    await get().fmNext();
  },

  // --- like / red heart ---
  toggleLike: async () => {
    const { currentSong, likedIds, loggedIn } = get();
    if (!currentSong) return;
    if (!loggedIn) {
      get().toast("请先登录", "info");
      set({ showLogin: true });
      return;
    }
    const liked = likedIds.includes(currentSong.id);
    const next = !liked;
    try {
      await likeSong(currentSong.id, next);
      const id = currentSong.id;
      set((s) => ({
        likedIds: next
          ? [...s.likedIds, id]
          : s.likedIds.filter((x) => x !== id),
        likedAt: next
          ? { ...s.likedAt, [id]: Date.now() }
          : Object.fromEntries(
              Object.entries(s.likedAt).filter(([k]) => Number(k) !== id),
            ),
      }));
      write(LIKED_AT_KEY, JSON.stringify(get().likedAt));
      const uid = get().profile?.userId;
      if (uid) writeJson(likedIdsCacheKey(uid), get().likedIds);
      get().loadLikedSongs();
      get().toast(next ? "已添加到我喜欢" : "已取消喜欢", "success");
    } catch {
      get().toast("操作失败", "error");
    }
  },
  loadLiked: async () => {
    const uid = get().profile?.userId;
    const generation = accountDataGeneration;
    if (!uid) return;
    try {
      const ids = await getLikedIds(uid);
      if (generation !== accountDataGeneration || get().profile?.userId !== uid) return;
      set({ likedIds: ids });
      writeJson(likedIdsCacheKey(uid), ids);
    } catch {
      /* ignore */
    }
  },
  loadLikedSongs: async () => {
    const { likedIds, likedAt, profile } = get();
    const generation = accountDataGeneration;
    const uid = profile?.userId ?? 0;
    // 静默对齐：进入「我喜欢」时若 ID 列表已超 5 分钟未刷新，先按缓存
    // 渲染，同时后台重拉一次——在官方客户端里新增/取消的喜欢最终会
    // 汇入本端，避免两边列表长期漂移。
    if (Date.now() - likedSyncedAt > 5 * 60 * 1000) {
      likedSyncedAt = Date.now();
      const snapshot = likedIds.join(",");
      // 后台对齐后若 ID 集合有变化，重建可见列表（重入时已节流）。
      void get()
        .loadLiked()
        .then(() => {
          const fresh = usePlayerStore.getState().likedIds;
          if (fresh.join(",") !== snapshot) void get().loadLikedSongs();
        });
    }
    if (!likedIds.length) {
      set({ likedSongs: [], likedSongsLoading: false });
      return;
    }
    set({ likedSongsLoading: true });
    try {
      const chunks: number[][] = [];
      for (let i = 0; i < likedIds.length; i += 200) {
        chunks.push(likedIds.slice(i, i + 200));
      }
      const songs: Song[] = (
        await Promise.all(chunks.map((chunk) => getSongsByIds(chunk)))
      ).flat();
      // most recently liked first (local timestamps when available)
      songs.sort(
        (a, b) => (likedAt[b.id] ?? -Infinity) - (likedAt[a.id] ?? -Infinity),
      );
      if (generation !== accountDataGeneration || get().profile?.userId !== uid) return;
      set({ likedSongs: songs });
    } catch {
      /* ignore */
    } finally {
      set({ likedSongsLoading: false });
    }
  },
  loadVipInfo: async () => {
    const uid = get().profile?.userId;
    const generation = accountDataGeneration;
    if (!uid) return;
    // 10 分钟节流：会员标识/装扮可能随时更换，打开菜单即静默刷新
    // （保留旧值渲染），但短时间内不重复请求。
    // 当前缓存里没有任何可用图标时绕过节流——否则旧的无图标缓存会
    // 在整个节流窗口内挡住重试，胶囊上一直显示不出会员标识。
    const cached = get().vipInfo;
    if (cached?.badgeUrl && Date.now() - vipInfoLoadedAt < 10 * 60 * 1000) {
      return;
    }
    vipInfoLoadedAt = Date.now();
    try {
      const info = await getVipInfo(uid);
      if (generation !== accountDataGeneration || get().profile?.userId !== uid) return;
      set({ vipInfo: info });
      writeJson(vipCacheKey(uid), info);
    } catch {
      /* ignore */
    }
  },
  trackRecent: (song) => {
    const next = [
      song,
      ...get().recentSongs.filter((s) => s.id !== song.id),
    ].slice(0, 50);
    set({ recentSongs: next });
    try {
      localStorage.setItem("reverie_recent", JSON.stringify(next));
    } catch {
      /* ignore */
    }
  },
  clearRecent: () => {
    set({ recentSongs: [] });
    try {
      localStorage.removeItem("reverie_recent");
    } catch {
      /* ignore */
    }
    get().toast("已清空最近播放", "info");
  },
  loadHomeQuote: async () => {
    // 未登录不展示歌词文案。
    if (!get().loggedIn) {
      if (get().homeQuote || !get().homeQuoteUnavailable) {
        set({ homeQuote: null, homeQuoteUnavailable: true });
      }
      return;
    }
    if (
      get().homeQuote &&
      isCacheFresh(HOME_QUOTE_CACHE_AT_KEY, HOME_QUOTE_CACHE_TTL)
    ) {
      return;
    }
    if (homeQuoteLoadPromise) {
      await homeQuoteLoadPromise;
      return;
    }

    const run = (async () => {
      const pool = [186016, 347230, 509781655, 3414449762, 168160, 193535];
      const candidates = shuffle(pool);
      for (const id of candidates) {
        try {
          const songs = await getSongsByIds([id]);
          const song = songs[0];
          // skip multi-artist (duet) songs so no singer names leak into the quote
          if (!song || song.artistNames.length !== 1) continue;
          const { lrc } = await getLyric(id);
          const line = pickRandomLyricLine(lrc);
          if (line) {
            const quote = {
              text: line,
              source: `《${song.name}》· ${song.artists}`,
            };
            // 兜底校验：不合格的候选直接换下一首。
            if (!isValidHomeQuote(quote)) continue;
            set({ homeQuote: quote });
            writeJson(HOME_QUOTE_CACHE_KEY, quote);
            touchCache(HOME_QUOTE_CACHE_AT_KEY);
            return;
          }
        } catch {
          /* try next */
        }
      }
      // 整个候选池都失败（网络受限/歌曲下架）：标记不可用，
      // 首页不再无限期停留在“正在挑选…”的加载文案。
      if (!get().homeQuote) set({ homeQuoteUnavailable: true });
    })();
    homeQuoteLoadPromise = run;
    try {
      await run;
    } finally {
      if (homeQuoteLoadPromise === run) homeQuoteLoadPromise = null;
    }
  },

  // --- auth ---
  applyLogin: async (c) => {
    if (!c) return false;
    setCookie(c);
    // Permissions (VIP levels, region blocks) change with the account.
    clearResponseCache();
    set({ authReady: false });
    // 新扫码的会话在服务端偶尔需要短暂同步：此窗口内 /login/status
    // 会按匿名会话应答（无 profile），不能据此断定 cookie 无效。
    // 带退避重试约 12 秒，仍拿不到真实档案才判失败。
    let profile: UserProfile | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        profile = await loginStatusWithRetry();
        if (profile && profile.userId > 0) break;
      } catch {
        /* 网络抖动：继续重试 */
      }
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(500 * 2 ** attempt, 4000)),
      );
    }
    if (profile && profile.userId > 0) {
      accountDataGeneration++;
      // Switching accounts: wipe the previous account's cached data first,
      // otherwise its likes / recommendations stay on screen.
      set({
        loggedIn: true,
        authReady: true,
        profile,
        likedIds: readJson<number[]>(likedIdsCacheKey(profile.userId), []),
        likedSongs: [],
        likedAt: {},
        vipInfo: readJson<VipInfo | null>(vipCacheKey(profile.userId), null),
        userPlaylists: [],
        recommendSongs: readJson<Song[]>(
          recommendCacheKey(profile.userId),
          [],
        ),
      });
      writeJson(PROFILE_CACHE_KEY, profile);
      write(LIKED_AT_KEY, "{}");
      get().toast(`欢迎，${profile.nickname}`, "success");
      void get().loadLiked();
      void get().loadVipInfo();
      void get().loadHome();
      void get().loadUserPlaylists(false);
      return true;
    }
    // 宽限期内保留刚写入的凭证（服务端同步延迟），交给后续校验；
    // 超出宽限期仍无档案才认定为无效扫码并清除。
    if (!isCookieFreshlySet()) {
      clearCookie();
      localStorage.removeItem(PROFILE_CACHE_KEY);
      if (get().profile?.userId) {
        localStorage.removeItem(vipCacheKey(get().profile!.userId));
      }
    }
    set({ loggedIn: false, authReady: true, profile: null });
    return false;
  },
  logout: () => {
    accountDataGeneration++;
    homeRequestToken++;
    void logoutFromNetease().catch(() => undefined);
    clearCookie();
    clearResponseCache();
    searchCache.clear();
    // stop playback and clear the current session
    const el = get().audioEl;
    if (el) {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
    set({
      loggedIn: false,
      authReady: true,
      profile: null,
      likedIds: [],
      likedSongs: [],
      likedAt: {},
      vipInfo: null,
      userPlaylists: [],
      userPlaylistsLoading: false,
      playlistSongs: [],
      playlistLoading: false,
      playlistName: "",
      hotPlaylists: [],
      topSongs: [],
      homeQuote: null,
      homeQuoteUnavailable: false,
      recommendSongs: [],
      recommendSongsLoading: false,
      likedSongsLoading: false,
      fmSongs: [],
      currentSong: null,
      currentUrl: null,
      previewEnd: null,
      playing: false,
      pendingPlayToken: 0,
      progress: 0,
      duration: 0,
      queue: [],
      index: -1,
      queueSource: "list",
      lyricLines: [],
      lyricSongId: null,
      showPlayerComments: false,
      showCommentsModal: false,
    });
    try {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(LIKED_AT_KEY);
      localStorage.removeItem(PROFILE_CACHE_KEY);
    } catch {
      /* ignore */
    }
    get().toast("已退出登录", "info");
  },
  refreshLogin: async () => {
    const c = getCookie();
    if (!c) {
      set({ loggedIn: false, authReady: true, profile: null });
      return;
    }
    if (!get().profile) set({ authReady: false });
    try {
      const profile = await loginStatusWithRetry();
      if (profile && profile.userId > 0) {
        const accountChanged = get().profile?.userId !== profile.userId;
        if (accountChanged) {
          accountDataGeneration++;
          homeRequestToken++;
        }
        set({
          loggedIn: true,
          authReady: true,
          profile,
          ...(accountChanged
            ? {
                likedIds: readJson<number[]>(
                  likedIdsCacheKey(profile.userId),
                  [],
                ),
                likedSongs: [],
                // 点赞时间戳按账号隔离，避免旧账号数据污染新账号排序。
                likedAt: {},
                vipInfo: readJson<VipInfo | null>(
                  vipCacheKey(profile.userId),
                  null,
                ),
                recommendSongs: readJson<Song[]>(
                  recommendCacheKey(profile.userId),
                  [],
                ),
              }
            : {}),
        });
        if (accountChanged) write(LIKED_AT_KEY, "{}");
        writeJson(PROFILE_CACHE_KEY, profile);
        void get().loadLiked();
        void get().loadVipInfo();
        void get().loadUserPlaylists(false);
      } else {
        // 刚扫码写入的会话凭证可能仍在服务端同步窗口内：
        // 宽限期内不下判、不清除，留给后续校验重试。
        if (!isCookieFreshlySet()) {
          clearCookie();
          localStorage.removeItem(PROFILE_CACHE_KEY);
        }
        set({ loggedIn: false, authReady: true, profile: null });
      }
    } catch {
      // Keep a cached profile visible when the local sidecar/network is slow.
      // A later authenticated request will still surface an actionable error.
      set({ authReady: true });
    }
  },
}));
