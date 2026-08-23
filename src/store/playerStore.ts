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
  likeSong,
  loginStatus,
  searchSongs,
  setCookie,
} from "../api/client";
import { getAlbumPrivileges } from "../api/library";
import type {
  LyricLine,
  PlaybackQuality,
  PlaylistInfo,
  PlayMode,
  Song,
  UserProfile,
  View,
} from "../api/types";
import type { VipInfo } from "../api/client";
import { getPersonalFm } from "../api/extended";
import { logoutFromNetease } from "../api/auth";
import { parseLyrics, pickRandomLyricLine } from "../utils/lyrics";
import {
  benchmarkCoverQuality,
  hasWebGL,
  QUALITY_GRID,
  QUALITY_LABEL,
} from "../utils/gpuBenchmark";
import type { CoverQuality } from "../utils/gpuBenchmark";

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
}

export type ThemePreference = "system" | "light" | "dark";

/** Where the current queue came from; "fm" keeps roaming auto-advancing. */
export type QueueSource = "list" | "fm";

export const PLAYBACK_QUALITY_LABELS: Record<PlaybackQuality, string> = {
  standard: "标准",
  higher: "较高",
  exhigh: "极高",
  lossless: "无损",
  hires: "Hi-Res无损",
  jyeffect: "高清环绕声",
  jymaster: "超清母带",
};

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
}): PlaybackQuality[] {
  const qualities: PlaybackQuality[] = [];
  if (privilege.standard || privilege.maxBitrate > 0) qualities.push("standard");
  if (privilege.maxBitrate >= 192000) qualities.push("higher");
  if (privilege.maxBitrate >= 320000) qualities.push("exhigh");
  if (privilege.lossless) qualities.push("lossless");
  if (privilege.highRes) qualities.push("hires");
  if (privilege.spatialAudio) qualities.push("jyeffect");
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

/** Motion applied to the 3D particle album cover on the now-playing page. */
export type ParticleEffect = "none" | "spin" | "wave" | "audio";

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
  return v === "none" || v === "wave" || v === "audio" ? v : "spin";
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

const restoredSession = readSession();
const cachedProfile = readCachedProfile();
const cachedHotPlaylists = readJson<PlaylistInfo[]>(
  HOME_PLAYLISTS_CACHE_KEY,
  [],
);
const cachedTopSongs = readJson<Song[]>(HOME_TOP_CACHE_KEY, []);
const cachedHomeQuote = readJson<{ text: string; source: string } | null>(
  HOME_QUOTE_CACHE_KEY,
  null,
);
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
let fmBatchPromise: Promise<Song[]> | null = null;
let fmRetryStreak = 0;
let searchToken = 0;
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

  // --- audio ---
  audioEl: HTMLAudioElement | null;
  activeAudio: 0 | 1;
  currentSong: Song | null;
  currentUrl: string | null;
  preloadedSongId: number | null;
  preloadedUrl: string | null;
  qualitySwitchUrl: string | null;
  qualitySwitchQuality: PlaybackQuality | null;
  qualitySwitchPrevious: PlaybackQuality | null;
  qualitySwitching: boolean;
  pendingSeek: number | null;
  loadingUrl: boolean;
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
  lyricTheme: string;
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
  showPlayerComments: boolean;
  toasts: ToastMsg[];

  // --- actions ---
  setAudioEl: (el: HTMLAudioElement) => void;
  toast: (text: string, type?: ToastMsg["type"]) => void;
  dismissToast: (id: number) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (ms: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  setPlayMode: (m: PlayMode) => void;
  setPlaybackQuality: (quality: PlaybackQuality) => Promise<void>;
  loadPlaybackQualities: (song: Song) => Promise<void>;
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
  setLyricTheme: (t: string) => void;
  setLyricFontSize: (s: number) => void;
  setParticleEffect: (e: ParticleEffect) => void;
  setCoverQuality: (q: CoverQuality, reason?: string) => void;
  /** Step one level down after sustained dropped frames. */
  degradeCoverQuality: () => void;
  /** Run the GPU benchmark; on first launch this picks the level. */
  detectCoverQuality: (manual?: boolean) => Promise<void>;
  setShowLogin: (v: boolean) => void;
  setShowSettings: (v: boolean) => void;
  setShowPlayerComments: (v: boolean) => void;
  setActiveView: (v: View) => void;
  setPage: (p: "browse" | "nowplaying") => void;
  setSearchOpen: (v: boolean) => void;
  saveViewScroll: (view: View, top: number) => void;
  loadHome: (refreshPlaylists?: boolean) => Promise<void>;
  doSearch: (kw: string) => Promise<void>;
  loadTopSongs: () => Promise<void>;
  loadPersonalFm: () => Promise<void>;
  loadUserPlaylists: () => Promise<void>;
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

async function resolveUrl(
  song: Song,
  preferredQuality: PlaybackQuality,
): Promise<string | null> {
  // VIP songs without login fail on every level; only try standard once to stay fast.
  const loggedIn = usePlayerStore.getState().loggedIn;
  const requestedLevels: PlaybackQuality[] =
    preferredQuality === "standard"
      ? ["standard"]
      : preferredQuality === "higher"
        ? ["higher", "standard"]
        : preferredQuality === "exhigh"
          ? ["exhigh", "higher", "standard"]
          : [preferredQuality, "lossless", "exhigh", "higher", "standard"];
  const levels =
    song.fee === 1 && !loggedIn ? (["standard"] as const) : requestedLevels;
  for (const level of levels) {
    try {
      const { url } = await getSongUrl(song.id, level);
      if (url) return url;
    } catch {
      /* try next level */
    }
  }
  try {
    const { url } = await getLegacySongUrl(song.id);
    if (url) return url;
  } catch {
    /* final fallback exhausted */
  }
  return null;
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

  // --- audio ---
  audioEl: null,
  currentSong: restoredSession.currentSong,
  currentUrl: null,
  activeAudio: 0,
  preloadedSongId: null,
  preloadedUrl: null,
  qualitySwitchUrl: null,
  qualitySwitchQuality: null,
  qualitySwitchPrevious: null,
  qualitySwitching: false,
  pendingSeek: null,
  loadingUrl: false,
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
  lyricTheme: readStr("reverie_lyrictheme", "neon"),
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
  showPlayerComments: false,
  toasts: [],

  // --- toast ---
  toast: (text, type = "info") => {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts, { id, text, type }] }));
    setTimeout(() => get().dismissToast(id), 3200);
  },
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

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
    const { playing, currentUrl, currentSong, queue, queueSource } = get();
    if (!currentSong) return;
    if (!currentUrl) {
      get().playSong(currentSong, queue, queueSource);
      return;
    }
    set({ playing: !playing });
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
    if (!current.availablePlaybackQualities.includes(quality)) return;
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
    const url = await resolveUrl(currentSong, quality);
    const latest = get();
    if (
      latest.currentSong?.id !== currentSong.id ||
      latest.playbackQuality !== quality
    )
      return;
    if (!url) {
      set({
        playbackQuality: previousQuality,
        qualitySwitchUrl: null,
        qualitySwitchQuality: null,
        qualitySwitchPrevious: null,
        qualitySwitching: false,
      });
      write("reverie_playback_quality", previousQuality);
      get().toast("该歌曲暂不支持此音质，已保留原音质", "info");
      return;
    }
    set({
      qualitySwitchUrl: url,
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
      const currentQuality = get().playbackQuality;
      set({ availablePlaybackQualities: available });
      if (!available.includes(currentQuality)) {
        const fallback = [...available].reverse()[0] ?? "standard";
        set({ playbackQuality: fallback });
        write("reverie_playback_quality", fallback);
      }
    } catch {
      if (get().currentSong?.id === song.id) set({ availablePlaybackQualities: ["standard"] });
    }
  },
  commitQualitySwitch: (url, quality, position) => {
    const state = get();
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

    let nextIndex = index + 1;
    if (state.playMode === "shuffle" && queue.length > 1) {
      nextIndex = Math.floor(Math.random() * queue.length);
      if (nextIndex === index) nextIndex = (index + 1) % queue.length;
    }
    const nextSong = queue[nextIndex];
    if (nextSong && nextSong.id !== song.id) {
      void resolveUrl(nextSong, state.playbackQuality)
        .then((nextUrl) => {
          const latest = get();
          if (
            latest.currentSong?.id === song.id &&
            latest.currentUrl === url &&
            nextUrl
          ) {
            set({ preloadedSongId: nextSong.id, preloadedUrl: nextUrl });
          }
        })
        .catch(() => {});
    }
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
  setLyricTheme: (t) => {
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
  setShowSettings: (v) => set({ showSettings: v }),
  setShowPlayerComments: (v) => set({ showPlayerComments: v }),
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
    set({ activeView: "home" });
    if (homeLoadPromise) {
      await homeLoadPromise;
      return get().loadHome(refreshPlaylists);
    }

    const tasks: Promise<unknown>[] = [];
    if (
      refreshPlaylists ||
      !get().hotPlaylists.length ||
      !isCacheFresh(HOME_PLAYLISTS_CACHE_AT_KEY, HOME_DATA_CACHE_TTL)
    ) {
      set({ hotPlaylistsLoading: true });
      tasks.push(
        getHotPlaylists(
          12,
          refreshPlaylists ? Math.floor(Math.random() * 8) * 12 : 0,
        )
          .then((lists) => {
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
      set({ topSongsLoading: true });
      tasks.push(
        getTopSongs(0, 10)
          .then((songs) => {
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
        ))
    ) {
      set({ recommendSongsLoading: true });
      tasks.push(
        getRecommendSongs()
          .then((songs) => {
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
  loadUserPlaylists: async () => {
    const uid = get().profile?.userId;
    if (!uid) {
      get().toast("请先登录", "info");
      set({ showLogin: true });
      return;
    }
    set({ activeView: "userlist", userPlaylistsLoading: true });
    try {
      const lists = await getUserPlaylists(uid);
      set({ userPlaylists: lists });
    } catch {
      get().toast("加载我的歌单失败", "error");
    } finally {
      set({ userPlaylistsLoading: false });
    }
  },
  openPlaylist: async (id, name) => {
    set({
      activeView: "playlist",
      playlistName: name,
      prevView: get().activeView,
      playlistSongs: [],
      playlistLoading: true,
    });
    try {
      const detail = await getPlaylistDetail(id);
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
      get().toast("载入歌单失败", "error");
    } finally {
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
    const st = get();
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

    set({
      queue: targetQueue,
      index: targetIndex,
      queueSource: source ?? (queue ? "list" : st.queueSource),
      currentSong: song,
      currentUrl: null,
      preloadedSongId: null,
      preloadedUrl: null,
      qualitySwitchUrl: null,
      qualitySwitchQuality: null,
      qualitySwitchPrevious: null,
      qualitySwitching: false,
      pendingSeek: options?.startAt ?? null,
      loadingUrl: true,
      playing: autoplay,
      progress: 0,
      duration: song.duration || 0,
      availablePlaybackQualities: ["standard"],
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

    const url = await resolveUrl(song, quality);
    // A newer play request started while this url was resolving: drop this one
    // instead of playing a song the user already moved on from.
    if (token !== playToken) return;
    if (!url) {
      set({ loadingUrl: false, currentUrl: null, playing: false });
      get().failCurrent(
        song.fee === 1
          ? "该歌曲为 VIP 歌曲，请登录并开通会员后播放"
          : "无法获取播放地址（可能需要登录）",
      );
      return;
    }
    set({ currentUrl: url, loadingUrl: false, playing: autoplay });

    // Prefetch the next track's URL while the current one plays; it lands in
    // the song-url cache and makes the next playSong near-instant.
    const state = get();
    let nextIdx = -1;
    if (state.playMode === "shuffle" && state.queue.length > 1) {
      nextIdx = Math.floor(Math.random() * state.queue.length);
      if (nextIdx === state.index)
        nextIdx = (state.index + 1) % state.queue.length;
    } else if (state.index + 1 < state.queue.length) {
      nextIdx = state.index + 1;
    }
    const nextSong = nextIdx >= 0 ? state.queue[nextIdx] : null;
    if (nextSong && nextSong.id !== song.id) {
      void resolveUrl(nextSong, quality)
        .then((nextUrl) => {
          const latest = get();
          if (
            token === playToken &&
            latest.currentSong?.id === song.id &&
            nextUrl
          ) {
            set({ preloadedSongId: nextSong.id, preloadedUrl: nextUrl });
          }
        })
        .catch(() => {});
    }
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
    if (!uid) return;
    try {
      const ids = await getLikedIds(uid);
      set({ likedIds: ids });
      writeJson(likedIdsCacheKey(uid), ids);
    } catch {
      /* ignore */
    }
  },
  loadLikedSongs: async () => {
    const { likedIds, likedAt } = get();
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
      set({ likedSongs: songs });
    } catch {
      /* ignore */
    } finally {
      set({ likedSongsLoading: false });
    }
  },
  loadVipInfo: async () => {
    const uid = get().profile?.userId;
    if (!uid) return;
    try {
      const info = await getVipInfo(uid);
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
            set({ homeQuote: quote });
            writeJson(HOME_QUOTE_CACHE_KEY, quote);
            touchCache(HOME_QUOTE_CACHE_AT_KEY);
            return;
          }
        } catch {
          /* try next */
        }
      }
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
    try {
      const profile = await loginStatusWithRetry();
      if (profile && profile.userId > 0) {
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
        return true;
      }
      clearCookie();
      localStorage.removeItem(PROFILE_CACHE_KEY);
      if (get().profile?.userId) {
        localStorage.removeItem(vipCacheKey(get().profile!.userId));
      }
      set({ loggedIn: false, authReady: true, profile: null });
      return false;
    } catch {
      set({ authReady: true });
      return false;
    }
  },
  logout: () => {
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
      recommendSongs: [],
      recommendSongsLoading: false,
      likedSongsLoading: false,
      fmSongs: [],
      currentSong: null,
      currentUrl: null,
      playing: false,
      progress: 0,
      duration: 0,
      queue: [],
      index: -1,
      queueSource: "list",
      lyricLines: [],
      lyricSongId: null,
      showPlayerComments: false,
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
        writeJson(PROFILE_CACHE_KEY, profile);
        void get().loadLiked();
        void get().loadVipInfo();
      } else {
        clearCookie();
        localStorage.removeItem(PROFILE_CACHE_KEY);
        set({ loggedIn: false, authReady: true, profile: null });
      }
    } catch {
      // Keep a cached profile visible when the local sidecar/network is slow.
      // A later authenticated request will still surface an actionable error.
      set({ authReady: true });
    }
  },
}));
