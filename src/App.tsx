import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type SyntheticEvent,
} from "react";
import {
  flushScrobble,
  playbackFailureMessage,
  usePlayerStore,
} from "./store/playerStore";
import {
  audioGraphState,
  ensureAnalyser,
  resumeAnalyser,
} from "./utils/audioAnalyser";
import TitleBar from "./components/TitleBar";
import TopNav from "./components/TopNav";
import PlayerBar from "./components/PlayerBar";
import LoginGate from "./components/LoginGate";
import HomePage from "./components/HomePage";
import Toasts from "./components/Toasts";
import SettingsModal from "./components/SettingsModal";
import MediaDetailDialog from "./components/MediaDetailDialog";
import { reportScrobble, reportWeblog } from "./api/playbackReport";
import {
  loadNowPlayingView,
  preloadNowPlayingAssets,
} from "./utils/nowPlayingPreload";

const FALLBACK_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 160'%3E%3Crect width='160' height='160' rx='18' fill='%23e9eaf0'/%3E%3Ccircle cx='80' cy='80' r='42' fill='%23c9cad4'/%3E%3Ccircle cx='80' cy='80' r='14' fill='%23f5f5f8'/%3E%3Cpath d='M94 42v46.5a20 20 0 1 1-8-16V42h8Z' fill='%237b7f92'/%3E%3C/svg%3E";

/** 淡入淡出进行中的句柄：rAF 主驱动 + 墙钟 interval 兜底。 */
interface ActiveFade {
  frame: number;
  timer: number;
}

const SEAMLESS_CROSSFADE_MS = 260;
// 无缝过渡交接链的总预算。超出说明渐变回调被系统冻结或 play() 卡死，
// 必须放弃交叉淡化走兜底，不能让下一首永久卡在“已起播未接管”。
const SEAMLESS_WATCHDOG_MS = SEAMLESS_CROSSFADE_MS * 4 + 3000;
// 淡入淡出时长由设置驱动（audioFadeSeconds，1~12 秒）；无缝切歌过渡
// 是独立机制，保持短促避免拖沓。
const fadeMs = () => usePlayerStore.getState().audioFadeSeconds * 1000;
// 静音看门狗判定窗口：系统通知音、蓝牙切换等会让 AudioContext 短暂
// 离开 running 态并在一两秒内自行恢复，属于正常现象，不应提示。
const SILENT_RECOVERY_MS = 2500;

const ChartPage = lazy(() => import("./components/ChartPage"));
const SearchPage = lazy(() => import("./components/SearchPage"));
const ProfilePage = lazy(() => import("./components/ProfilePage"));
const CollectionPage = lazy(() => import("./components/CollectionPage"));
const NotificationModal = lazy(
  () => import("./components/NotificationModal"),
);
const CommentPage = lazy(() => import("./components/CommentPage"));
const PlaylistPage = lazy(() => import("./components/PlaylistPage"));
const UserListPage = lazy(() => import("./components/UserListPage"));
const AlbumPage = lazy(() => import("./components/AlbumPage"));
const ArtistPage = lazy(() => import("./components/ArtistPage"));
const RadioPage = lazy(() => import("./components/RadioPage"));
const RadioDetailPage = lazy(() => import("./components/RadioDetailPage"));
const SocialPage = lazy(() => import("./components/SocialPage"));
const CloudPage = lazy(() => import("./components/CloudPage"));
const YunbeiPage = lazy(() => import("./components/YunbeiPage"));
const CommentHistoryModal = lazy(
  () => import("./components/CommentHistoryModal"),
);
const LikesModal = lazy(() => import("./components/LikesModal"));
const RecentModal = lazy(() => import("./components/RecentModal"));
const ArtistModal = lazy(() => import("./components/ArtistModal"));
const AlbumModal = lazy(() => import("./components/AlbumModal"));
const VoiceWorkbenchPage = lazy(
  () => import("./components/VoiceWorkbenchPage"),
);
const LyricsMarkPage = lazy(() => import("./components/LyricsMarkPage"));
const DigitalAlbumPage = lazy(() => import("./components/DigitalAlbumPage"));
const MusicianPage = lazy(() => import("./components/MusicianPage"));
const SatiPage = lazy(() => import("./components/SatiPage"));
const BroadcastPage = lazy(() => import("./components/BroadcastPage"));
const UgcPage = lazy(() => import("./components/UgcPage"));
const ListenReportsPage = lazy(() => import("./components/ListenReportsPage"));
const FansPage = lazy(() => import("./components/FansPage"));
const StylePage = lazy(() => import("./components/StylePage"));
const TopicPage = lazy(() => import("./components/TopicPage"));
const LibraryPage = lazy(() => import("./components/LibraryPage"));
const CalendarPage = lazy(() => import("./components/CalendarPage"));
const PrivateDjPage = lazy(() => import("./components/PrivateDjPage"));
const VideoPage = lazy(() => import("./components/VideoPage"));
const PlayerCommentsDrawer = lazy(
  () => import("./components/PlayerCommentsDrawer"),
);
const CommentsModal = lazy(() => import("./components/CommentsModal"));
const LoginModal = lazy(() => import("./components/LoginModal"));
const UpdateModal = lazy(() => import("./components/UpdateModal"));

export default function App() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const preloadAudioRef = useRef<HTMLAudioElement>(null);
  const fadeFramesRef = useRef(new Map<HTMLAudioElement, ActiveFade>());
  const playbackSyncRef = useRef(0);
  const seamlessTransitionRef = useRef(false);
  // 无缝过渡的尝试序号：交接链成功/失败/看门狗放弃都会推进它，
  // 使同一次尝试的迟到回调全部失效，防止旧链覆盖新状态。
  const seamlessAttemptRef = useRef(0);
  const seamlessWatchdogRef = useRef<number | null>(null);
  const skipNextFadeInRef = useRef(false);
  const handledEndedUrlRef = useRef<string | null>(null);
  // 音质切换两阶段交接：记录已对哪个目标 URL 完成寻址（第一阶段 seek）。
  const qualitySeekRef = useRef<{ url: string; seeked: boolean }>({
    url: "",
    seeked: false,
  });
  // 静音看门狗：AudioContext 被系统挂起或音量被竞态留在 0 时，
  // 媒体元素照常走表（播放栏正常）却没有声音。异常需持续存在
  // （SILENT_RECOVERY_MS）才触发自愈，短暂打断不提示；toast 只提示一次。
  const silentSinceRef = useRef<number | null>(null);
  const silentToastShownRef = useRef(false);

  const cancelAudioFade = (audio: HTMLAudioElement) => {
    const fade = fadeFramesRef.current.get(audio);
    if (fade) {
      window.cancelAnimationFrame(fade.frame);
      window.clearInterval(fade.timer);
      fadeFramesRef.current.delete(audio);
    }
  };

  const fadeAudioVolume = (
    audio: HTMLAudioElement,
    target: number,
    duration: number,
  ) => {
    cancelAudioFade(audio);
    const start = audio.volume;
    const end = Math.min(1, Math.max(0, target));
    // 设置里关闭淡入淡出时，所有渐变统一退化为立即切换。
    const effective = usePlayerStore.getState().audioFadeEnabled
      ? duration
      : 0;
    if (effective <= 0 || Math.abs(start - end) < 0.005) {
      audio.volume = end;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      const startedAt = performance.now();
      let settled = false;
      let frame = 0;
      let timer = 0;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.cancelAnimationFrame(frame);
        window.clearInterval(timer);
        if (fadeFramesRef.current.get(audio)?.frame === frame)
          fadeFramesRef.current.delete(audio);
        resolve();
      };
      // 进度按墙钟计算：窗口隐藏时 rAF 会整体冻结、interval 被节流，
      // 但只要二者其一能跑起来，渐变就会推进并最终 resolve——
      // 无缝切歌的交接链绝不能被后台窗口卡死。
      const step = () => {
        const progress = Math.min(
          1,
          (performance.now() - startedAt) / effective,
        );
        const eased = 1 - Math.pow(1 - progress, 3);
        audio.volume = start + (end - start) * eased;
        if (progress >= 1) finish();
      };
      frame = window.requestAnimationFrame(step);
      timer = window.setInterval(step, 400);
      fadeFramesRef.current.set(audio, { frame, timer });
    });
  };

  const currentUrl = usePlayerStore((s) => s.currentUrl);
  const preloadedUrl = usePlayerStore((s) => s.preloadedUrl);
  const qualitySwitchUrl = usePlayerStore((s) => s.qualitySwitchUrl);
  const qualitySwitchQuality = usePlayerStore((s) => s.qualitySwitchQuality);
  const preloadedSongId = usePlayerStore((s) => s.preloadedSongId);
  const activeAudio = usePlayerStore((s) => s.activeAudio);
  const pendingSeek = usePlayerStore((s) => s.pendingSeek);
  const previewEnd = usePlayerStore((s) => s.previewEnd);
  const playing = usePlayerStore((s) => s.playing);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const theme = usePlayerStore((s) => s.theme);
  const glassOpacity = usePlayerStore((s) => s.glassOpacity);
  const glassBlur = usePlayerStore((s) => s.glassBlur);
  const glassContrast = usePlayerStore((s) => s.glassContrast);
  const animationSpeed = usePlayerStore((s) => s.animationSpeed);
  const reducedMotion = usePlayerStore((s) => s.reducedMotion);
  const setAudioEl = usePlayerStore((s) => s.setAudioEl);
  const commitQualitySwitch = usePlayerStore((s) => s.commitQualitySwitch);
  const cancelQualitySwitch = usePlayerStore((s) => s.cancelQualitySwitch);

  const activeView = usePlayerStore((s) => s.activeView);
  const currentPage = usePlayerStore((s) => s.currentPage);
  const showPlayerComments = usePlayerStore((s) => s.showPlayerComments);
  const showCommentsModal = usePlayerStore((s) => s.showCommentsModal);
  const showLogin = usePlayerStore((s) => s.showLogin);
  const showUpdate = usePlayerStore((s) => s.showUpdate);
  const showNotifications = usePlayerStore((s) => s.showNotifications);
  const showCommentHistory = usePlayerStore((s) => s.showCommentHistory);
  const showLikes = usePlayerStore((s) => s.showLikes);
  const showRecent = usePlayerStore((s) => s.showRecent);
  const showArtistModal = usePlayerStore((s) => s.showArtistModal);
  const showAlbumModal = usePlayerStore((s) => s.showAlbumModal);
  const artistModalSeq = usePlayerStore((s) => s.artistModalSeq);
  const albumModalSeq = usePlayerStore((s) => s.albumModalSeq);
  const currentSong = usePlayerStore((s) => s.currentSong);
  const coverQuality = usePlayerStore((s) => s.coverQuality);
  const reportedSongRef = useRef<number | null>(null);
  const scrollPositionsRef = useRef(new Map<string, number>());
  const [NowPlayingView, setNowPlayingView] = useState<ComponentType | null>(
    null,
  );
  const [mountedOverlays, setMountedOverlays] = useState({
    comments: showPlayerComments,
    commentsModal: showCommentsModal,
    login: showLogin,
    update: showUpdate,
    notifications: showNotifications,
    commentHistory: showCommentHistory,
    likes: showLikes,
    recent: showRecent,
    artistDetail: showArtistModal,
    albumDetail: showAlbumModal,
  });

  useEffect(() => {
    const handleImageError = (event: Event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement)) return;
      if (image.dataset.reverieFallback === "true") return;
      image.dataset.reverieFallback = "true";
      image.removeAttribute("srcset");
      image.src = FALLBACK_IMAGE;
    };
    window.addEventListener("error", handleImageError, true);
    return () => window.removeEventListener("error", handleImageError, true);
  }, []);

  useEffect(() => {
    if (
      !showPlayerComments &&
      !showCommentsModal &&
      !showLogin &&
      !showUpdate &&
      !showNotifications &&
      !showCommentHistory &&
      !showLikes &&
      !showRecent &&
      !showArtistModal &&
      !showAlbumModal
    )
      return;
    setMountedOverlays((current) => ({
      comments: current.comments || showPlayerComments,
      commentsModal: current.commentsModal || showCommentsModal,
      login: current.login || showLogin,
      update: current.update || showUpdate,
      notifications: current.notifications || showNotifications,
      commentHistory: current.commentHistory || showCommentHistory,
      likes: current.likes || showLikes,
      recent: current.recent || showRecent,
      artistDetail: current.artistDetail || showArtistModal,
      albumDetail: current.albumDetail || showAlbumModal,
    }));
  }, [
    showLogin,
    showPlayerComments,
    showCommentsModal,
    showUpdate,
    showNotifications,
    showCommentHistory,
    showLikes,
    showRecent,
    showArtistModal,
    showAlbumModal,
  ]);

  useLayoutEffect(() => {
    if (currentPage !== "browse") return;
    const key = activeView;
    const frame = window.requestAnimationFrame(() => {
      const scroller = document.querySelector<HTMLElement>(".page-scroll");
      if (scroller)
        scroller.scrollTop = scrollPositionsRef.current.get(key) ?? 0;
    });
    return () => {
      window.cancelAnimationFrame(frame);
      const scroller = document.querySelector<HTMLElement>(".page-scroll");
      if (scroller) scrollPositionsRef.current.set(key, scroller.scrollTop);
    };
  }, [activeView, currentPage]);

  useEffect(() => {
    if (!currentSong) return;
    let alive = true;
    preloadNowPlayingAssets(currentSong.picUrl, coverQuality !== "image");
    void loadNowPlayingView().then((module) => {
      if (alive) setNowPlayingView(() => module.default);
    });
    return () => {
      alive = false;
    };
  }, [coverQuality, currentSong?.id, currentSong?.picUrl]);

  useEffect(() => {
    if (
      !playing ||
      !currentSong ||
      reportedSongRef.current === currentSong.id
    ) {
      return;
    }
    reportedSongRef.current = currentSong.id;
    void reportScrobble({
      id: currentSong.id,
      sourceId: currentSong.id,
      time: Math.floor((currentSong.duration || 0) / 1000),
    }).catch(() => {});
  }, [playing, currentSong]);

  const particleEffect = usePlayerStore((s) => s.particleEffect);
  const refreshLogin = usePlayerStore((s) => s.refreshLogin);
  const loadHome = usePlayerStore((s) => s.loadHome);
  const loadHomeQuote = usePlayerStore((s) => s.loadHomeQuote);
  const next = usePlayerStore((s) => s.next);

  // Register the active decoder before paint so the play button never holds
  // the previous decoder for one render after a seamless promotion.
  useLayoutEffect(() => {
    const active =
      activeAudio === 0 ? audioRef.current : preloadAudioRef.current;
    if (active) setAudioEl(active);
  }, [activeAudio, setAudioEl]);

  // A suspended Web Audio context is allowed to make an otherwise healthy
  // media element advance silently. Resume it from the next real user gesture,
  // and also when the window regains focus: 系统休眠唤醒、切换音频设备后
  // AudioContext 常停留在 suspended，仅靠点击无法覆盖“放着放着没声了”。
  useEffect(() => {
    const resume = () => resumeAnalyser();
    document.addEventListener("pointerdown", resume, true);
    document.addEventListener("keydown", resume, true);
    document.addEventListener("visibilitychange", resume, true);
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    return () => {
      document.removeEventListener("pointerdown", resume, true);
      document.removeEventListener("keydown", resume, true);
      document.removeEventListener("visibilitychange", resume, true);
      window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume);
    };
  }, []);

  // 禁用播放器内的鼠标右键菜单
  useEffect(() => {
    const block = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", block);
    return () => document.removeEventListener("contextmenu", block);
  }, []);

  // First launch only: size the particle cover to this machine's GPU.
  useEffect(() => {
    let idle: number | undefined;
    let fallback = 0;
    const timer = window.setTimeout(() => {
      const run = () => void usePlayerStore.getState().detectCoverQuality();
      idle = window.requestIdleCallback?.(run, { timeout: 8000 });
      if (idle === undefined) fallback = window.setTimeout(run, 1000);
    }, 4000);
    return () => {
      window.clearTimeout(timer);
      if (fallback) window.clearTimeout(fallback);
      if (idle !== undefined) window.cancelIdleCallback?.(idle);
    };
  }, []);

  // Restore auth before authenticated home data is refreshed. Cached content
  // remains visible while the local API sidecar finishes starting.
  useEffect(() => {
    let cancelled = false;
    let idle: number | undefined;
    let timer = 0;
    void (async () => {
      await refreshLogin();
      if (cancelled) return;
      const refreshHome = () => {
        if (!cancelled)
          void Promise.allSettled([loadHome(true), loadHomeQuote()]);
      };
      idle = window.requestIdleCallback?.(refreshHome, { timeout: 1800 });
      if (idle === undefined) timer = window.setTimeout(refreshHome, 250);
      // 启动直达私人漫游：设置开启且当前没有恢复的在播内容时才触发；
      // 未登录时静默跳过，不在启动流程里弹登录框打扰。
      const boot = usePlayerStore.getState();
      if (boot.launchFmOnStart && !boot.currentSong && boot.loggedIn) {
        void usePlayerStore.getState().loadPersonalFm();
      }
    })();
    return () => {
      cancelled = true;
      if (idle !== undefined) window.cancelIdleCallback?.(idle);
      if (timer) window.clearTimeout(timer);
    };
  }, [refreshLogin, loadHome, loadHomeQuote]);

  // "音乐律动" needs the player routed through an AnalyserNode. Wire it only
  // when that effect is picked, and fall back if Web Audio is unavailable.
  useEffect(() => {
    if (particleEffect !== "audio") return;
    const active =
      activeAudio === 0 ? audioRef.current : preloadAudioRef.current;
    const inactive =
      activeAudio === 0 ? preloadAudioRef.current : audioRef.current;
    if (!active || !inactive) return;
    const st = usePlayerStore.getState();
    if (ensureAnalyser(inactive) && ensureAnalyser(active)) {
      resumeAnalyser();
    } else {
      st.toast("当前环境不支持音频分析，已切换为波动效果", "error");
      st.setParticleEffect("wave");
    }
  }, [activeAudio, particleEffect]);

  // Subscribe before starting the packaged-build update check so no event is lost.
  useEffect(() => {
    const bridge = window.ncm;
    const off = bridge?.onUpdateEvent?.((event) => {
      usePlayerStore.getState().applyUpdateEvent(event.type, event.data);
    });
    let idle: number | undefined;
    let fallback = 0;
    let interval = 0;
    const clearScheduled = () => {
      if (fallback) {
        window.clearTimeout(fallback);
        fallback = 0;
      }
      if (idle !== undefined) {
        window.cancelIdleCallback?.(idle);
        idle = undefined;
      }
    };
    const schedule = (delay: number) => {
      if (!bridge || bridge.skipUpdate) return;
      clearScheduled();
      idle = window.requestIdleCallback?.(
        () => {
          idle = undefined;
          void bridge.checkUpdate(false)?.catch?.(() => {});
        },
        { timeout: delay },
      );
      if (idle === undefined) {
        fallback = window.setTimeout(
          () => {
            fallback = 0;
            void bridge.checkUpdate(false)?.catch?.(() => {});
          },
          Math.min(delay, 2000),
        );
      }
    };
    const timer = window.setTimeout(() => {
      if (!bridge || bridge.skipUpdate) return;
      schedule(12000);
      // Keep long-running sessions current without polling aggressively.
      interval = window.setInterval(
        () => {
          if (document.visibilityState === "visible") schedule(2000);
        },
        6 * 60 * 60 * 1000,
      );
    }, 8000);
    const onVisible = () => {
      if (document.visibilityState === "visible") schedule(2500);
    };
    const onFocus = () => schedule(2500);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearTimeout(timer);
      clearScheduled();
      if (interval) window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      off?.();
    };
  }, []);

  // 将当前播放结算到网易云官方记录：切到后台或窗口关闭时补记一次，
  // 避免播放过半就关闭应用导致的漏记（试听片段自动排除）。
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") flushScrobble();
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", flushScrobble);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", flushScrobble);
    };
  }, []);

  // theme: follow system / light / dark
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {      const effective =
        theme === "system" ? (mql.matches ? "dark" : "light") : theme;
      document.documentElement.setAttribute("data-theme", effective);
    };
    apply();
    if (theme === "system") {
      mql.addEventListener("change", apply);
      return () => mql.removeEventListener("change", apply);
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-reduced-motion",
      reducedMotion ? "true" : "false",
    );
  }, [reducedMotion]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-glass-opacity", glassOpacity);
    root.setAttribute("data-glass-blur", glassBlur);
    root.setAttribute("data-glass-contrast", glassContrast);
    root.setAttribute("data-animation-speed", animationSpeed);
  }, [animationSpeed, glassBlur, glassContrast, glassOpacity]);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const editing =
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable);
      const command = window.ncm?.platform === "darwin" ? e.metaKey : e.ctrlKey;
      if (command && e.key.toLowerCase() === "f") {
        e.preventDefault();
        const state = usePlayerStore.getState();
        state.setPage("browse");
        state.setSearchOpen(true);
        return;
      }
      if (command && e.key === ",") {
        e.preventDefault();
        usePlayerStore.getState().setShowSettings(true);
        return;
      }
      if (editing || e.metaKey || e.ctrlKey || e.altKey) return;
      const s = usePlayerStore.getState();
      switch (e.code) {
        case "Space":
          e.preventDefault();
          s.togglePlay();
          break;
        case "ArrowRight":
          s.seek(Math.min(s.duration, s.progress + 5000));
          break;
        case "ArrowLeft":
          s.seek(Math.max(0, s.progress - 5000));
          break;
        case "ArrowUp":
          s.setVolume(s.volume + 0.05);
          break;
        case "ArrowDown":
          s.setVolume(s.volume - 0.05);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Keep the active decoder attached to the current URL. When a preloaded
  // decoder is promoted, its existing buffer is reused instead of reloading.
  useEffect(() => {
    const syncToken = ++playbackSyncRef.current;
    const a = activeAudio === 0 ? audioRef.current : preloadAudioRef.current;
    if (!a) return;
    if (audioRef.current) cancelAudioFade(audioRef.current);
    if (preloadAudioRef.current) cancelAudioFade(preloadAudioRef.current);
    if (!currentUrl) {
      cancelAudioFade(a);
      a.pause();
      a.removeAttribute("src");
      a.load();
      a.currentTime = 0;
    } else if (a.getAttribute("src") !== currentUrl) {
      cancelAudioFade(a);
      a.pause();
      a.src = currentUrl;
      a.load();
    }
    if (!currentUrl) return;
    if (playing) {
      const target = muted ? 0 : volume;
      resumeAnalyser();
      if (skipNextFadeInRef.current) {
        skipNextFadeInRef.current = false;
        a.volume = target;
        if (a.paused) {
          a.play().catch(async () => {
            a.volume = target;
            // 瞬时媒体管线故障：重置解码器后自动重试一次再报错。
            try {
              a.pause();
              a.load();
              await a.play();
              return;
            } catch {
              /* 走下方失败提示 */
            }
            const state = usePlayerStore.getState();
            if (state.currentUrl === currentUrl && state.playing) {
              usePlayerStore.setState({ playing: false });
              state.toast("音频启动失败，请点击播放重试", "error");
            }
          });
        }
      } else {
        a.volume = 0;
        a.play()
          .then(() => {
            const latest = usePlayerStore.getState();
            if (syncToken !== playbackSyncRef.current) {
              // 更新的同步轮次已接管此解码器。绝不能在这里暂停它：
              // 那会把新一轮刚启动的播放打断，而新一轮的 .then 已经过了，
              // 没有人会再恢复 —— 状态停在“播放中”却永远无声/冻结。
              return;
            }
            if (!latest.playing) {
              a.pause();
              a.volume = target;
              return;
            }
            return fadeAudioVolume(a, target, fadeMs());
          })
          .catch(async () => {
            a.volume = target;
            // 过期轮次的 play 被新一轮 load() 打断属正常现象；
            // 只有当前轮次失败才代表真的无法播放。
            const state = usePlayerStore.getState();
            if (
              syncToken !== playbackSyncRef.current ||
              state.currentUrl !== currentUrl ||
              !state.playing
            )
              return;
            // 瞬时媒体管线故障：重置解码器后自动重试一次。
            try {
              a.pause();
              a.load();
              await a.play();
              if (syncToken !== playbackSyncRef.current) return;
              const latest = usePlayerStore.getState();
              if (!latest.playing) {
                a.pause();
                return;
              }
              await fadeAudioVolume(a, target, fadeMs());
              return;
            } catch {
              /* 重试仍失败才提示 */
            }
            const latest = usePlayerStore.getState();
            if (
              syncToken === playbackSyncRef.current &&
              latest.currentUrl === currentUrl &&
              latest.playing
            ) {
              usePlayerStore.setState({ playing: false });
              latest.toast("音频启动失败，请点击播放重试", "error");
            }
          });
      }
    } else if (!a.paused) {
      void fadeAudioVolume(a, 0, fadeMs()).then(() => {
        if (
          syncToken !== playbackSyncRef.current ||
          usePlayerStore.getState().playing
        )
          return;
        a.pause();
        a.volume = muted ? 0 : volume;
      });
    }
  }, [activeAudio, currentUrl, playing]);

  // Start the next already-buffered track slightly before the current one
  // ends. The store is promoted only after both decoders finish their volume
  // ramps, so the progress clock and lyrics keep following one active track.
  useEffect(() => {
    if (
      !playing ||
      !currentUrl ||
      !preloadedUrl ||
      !preloadedSongId ||
      seamlessTransitionRef.current
    )
      return;
    const current =
      activeAudio === 0 ? audioRef.current : preloadAudioRef.current;
    const nextAudio =
      activeAudio === 0 ? preloadAudioRef.current : audioRef.current;
    if (!current || !nextAudio) return;
    const timer = window.setInterval(() => {
      if (
        seamlessTransitionRef.current ||
        !Number.isFinite(current.duration) ||
        current.duration - current.currentTime > SEAMLESS_CROSSFADE_MS / 1000
      )
        return;
      const state = usePlayerStore.getState();
      if (
        state.playMode === "one" ||
        (state.playMode === "sequence" && state.index >= state.queue.length - 1)
      )
        return;
      const nextSong = state.queue.find((song) => song.id === preloadedSongId);
      if (!nextSong || nextAudio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA)
        return;
      seamlessTransitionRef.current = true;
      const attemptId = ++seamlessAttemptRef.current;
      const cancelWatchdog = () => {
        if (seamlessWatchdogRef.current !== null) {
          window.clearTimeout(seamlessWatchdogRef.current);
          seamlessWatchdogRef.current = null;
        }
      };
      // 看门狗：交接链迟迟不结算（后台冻结 / play() 卡死）就放弃本次
      // 交叉淡化，回到 ended 兜底路径完成切换。切到下一首永远比挂着强。
      seamlessWatchdogRef.current = window.setTimeout(() => {
        seamlessWatchdogRef.current = null;
        if (seamlessAttemptRef.current !== attemptId) return;
        seamlessAttemptRef.current++;
        seamlessTransitionRef.current = false;
        nextAudio.pause();
        nextAudio.currentTime = 0;
      }, SEAMLESS_WATCHDOG_MS);
      nextAudio.currentTime = 0;
      nextAudio.volume = 0;
      nextAudio
        .play()
        .then(() =>
          Promise.all([
            fadeAudioVolume(current, 0, SEAMLESS_CROSSFADE_MS),
            fadeAudioVolume(
              nextAudio,
              state.muted ? 0 : state.volume,
              SEAMLESS_CROSSFADE_MS,
            ),
          ]),
        )
        .then(() => {
          if (seamlessAttemptRef.current !== attemptId) return;
          seamlessAttemptRef.current++;
          cancelWatchdog();
          current.pause();
          current.currentTime = 0;
          skipNextFadeInRef.current = true;
          usePlayerStore
            .getState()
            .commitPreloaded(
              nextSong,
              state.queue,
              state.queueSource,
              preloadedUrl,
            );
          seamlessTransitionRef.current = false;
        })
        .catch(() => {
          if (seamlessAttemptRef.current !== attemptId) return;
          seamlessAttemptRef.current++;
          cancelWatchdog();
          nextAudio.pause();
          nextAudio.volume = state.muted ? 0 : state.volume;
          seamlessTransitionRef.current = false;
        });
    }, 50);
    return () => window.clearInterval(timer);
  }, [activeAudio, currentUrl, playing, preloadedSongId, preloadedUrl]);

  // 无缝过渡被暂停打断时，丢弃残留的“跳过淡入”标记，
  // 否则下一次手动播放会直接把音量拉满。
  useEffect(() => {
    if (!playing) skipNextFadeInRef.current = false;
  }, [playing]);

  // 组件卸载时清掉仍可能计时的交接看门狗与进行中的渐变句柄。
  // 注意交接链（含其看门狗）生命周期长于触发它的轮询 effect，
  // 因此只在真正的 unmount 里统一收口。
  useEffect(
    () => () => {
      if (seamlessWatchdogRef.current !== null)
        window.clearTimeout(seamlessWatchdogRef.current);
      const fades = [...fadeFramesRef.current.keys()];
      fades.forEach((el) => cancelAudioFade(el));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Fill the inactive decoder while the current track plays. The URL comes
  // directly from Netease's official song URL endpoint.
  useEffect(() => {
    const a = activeAudio === 0 ? preloadAudioRef.current : audioRef.current;
    if (!a) return;
    const targetUrl = qualitySwitchUrl ?? preloadedUrl;
    if (!targetUrl) {
      cancelAudioFade(a);
      a.pause();
      a.removeAttribute("src");
      a.load();
      return;
    }
    if (a.getAttribute("src") !== targetUrl) {
      cancelAudioFade(a);
      a.pause();
      a.src = targetUrl;
      a.load();
    }
  }, [activeAudio, preloadedUrl, qualitySwitchUrl]);

  // `timeupdate` only fires a few times per second in WebView. Sample the
  // actual audio clock at 30 fps while playing so the progress bar and lyrics
  // move continuously without forcing the whole app to render at 60 fps.
  useEffect(() => {
    const audio =
      activeAudio === 0 ? audioRef.current : preloadAudioRef.current;
    if (!audio || !playing || !currentUrl) return;
    let frame = 0;
    let lastPaint = 0;
    const tick = (now: number) => {
      const state = usePlayerStore.getState();
      // 切歌过渡窗口内旧解码器仍在走表，不能把旧进度写进新歌的状态。
      if (state.pendingPlayToken !== 0) {
        frame = window.requestAnimationFrame(tick);
        return;
      }
      const foreground =
        document.visibilityState === "visible" && document.hasFocus();
      const interval = foreground ? 32 : 250;
      if (now - lastPaint >= interval && !document.hidden) {
        lastPaint = now;
        const progress = Math.floor(audio.currentTime * 1000);
        // 临近结束（<150s）才预取下一首地址，避免高音质下与当前曲抢带宽
        const durationMs = Math.floor(audio.duration * 1000) || state.duration;
        if (
          durationMs > 0 &&
          !audio.paused &&
          durationMs - progress > 0 &&
          durationMs - progress < 150_000
        ) {
          void usePlayerStore.getState().requestPreloadNext();
        }
        // ── 静音自愈看门狗 ──────────────────────────────────────────
        // 症状：进度条正常前进，但听不到声音。两个已知成因：
        // 1) Web Audio 图被系统挂起（设备切换/休眠唤醒/autoplay 策略），
        //    元素输出被路由进挂起的上下文 → 整条链静音；
        // 2) 淡入淡出竞态把元素音量留在 ≈0。
        // 判定改为按异常持续时长：系统消息通知音等短暂打断会让上下文
        // 短暂离开 running 态并自行恢复，只有连续 ≥2.5s 仍无起色才
        // 动手修复并提示，通知音（通常 ≤2s）不再触发误报。
        const expectedVolume = state.muted ? 0 : state.volume;
        const volumeDead =
          !audio.paused && audio.volume < 0.01 && expectedVolume >= 0.01;
        const graphState = audioGraphState();
        const graphDead =
          !audio.paused &&
          expectedVolume > 0 &&
          graphState !== null &&
          graphState !== "running";
        if (volumeDead || graphDead) {
          silentSinceRef.current ??= now;
          resumeAnalyser();
        } else {
          silentSinceRef.current = null;
        }
        const silentMs = silentSinceRef.current
          ? now - silentSinceRef.current
          : 0;
        if (silentMs >= SILENT_RECOVERY_MS) {
          silentSinceRef.current = null;
          audio.volume = expectedVolume;
          resumeAnalyser();
          // 只有确认图真的处于坏状态才提示；纯音量竞态静默修复即可。
          if (
            !silentToastShownRef.current &&
            (graphState === "suspended" ||
              graphState === "interrupted" ||
              graphState === "closed")
          ) {
            silentToastShownRef.current = true;
            usePlayerStore
              .getState()
              .toast("检测到音频输出被系统中断，已自动恢复", "info");
          }
        }
        if (state.previewEnd !== null && progress >= state.previewEnd) {
          const previewPosition = state.previewEnd;
          audio.pause();
          state.toast("试听已结束，开通网易云音乐会员后可继续播放", "info");
          usePlayerStore.setState({
            currentUrl: null,
            loadingUrl: false,
            playing: false,
            previewEnd: null,
            progress: previewPosition,
          });
          return;
        }
        const duration = Number.isFinite(audio.duration)
          ? Math.floor(audio.duration * 1000)
          : 0;
        const visibleDuration =
          state.previewEnd === null
            ? duration
            : Math.min(duration || state.previewEnd, state.previewEnd);
        if (
          Math.abs(state.progress - progress) >= 16 ||
          state.duration !== visibleDuration
        ) {
          usePlayerStore.setState({ progress, duration: visibleDuration });
        }
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [activeAudio, playing, currentUrl, previewEnd]);

  const advanceAfterEnded = (audio: HTMLAudioElement) => {
    const active =
      activeAudio === 0 ? audioRef.current : preloadAudioRef.current;
    if (audio !== active || seamlessTransitionRef.current) return;
    const st = usePlayerStore.getState();
    // 切歌过渡窗口内，ended 事件来自旧曲目：此时 queue/index 已指向新歌，
    // 若继续推进会用新 index+1 直接跳过用户刚选的歌。
    if (st.pendingPlayToken !== 0) return;
    if (!st.currentUrl || handledEndedUrlRef.current === st.currentUrl) return;
    handledEndedUrlRef.current = st.currentUrl;
    const endedSong = st.currentSong;
    if (endedSong) {
      void reportWeblog({
        id: endedSong.id,
        sourceId: endedSong.id,
        time: Math.floor((st.duration || endedSong.duration || 0) / 1000),
        source: st.queueSource === "fm" ? "fm" : "list",
      }).catch(() => {});
    }
    const { queue, index, playMode: mode, queueSource } = st;
    if (queueSource === "fm" && queue.length > 0) {
      void st.fmNext();
      return;
    }
    if (mode === "one") {
      handledEndedUrlRef.current = null;
      st.seek(0);
      const active =
        activeAudio === 0 ? audioRef.current : preloadAudioRef.current;
      if (active) {
        resumeAnalyser();
        void active.play().catch(() => {
          handledEndedUrlRef.current = null;
          usePlayerStore.setState({ playing: false });
          usePlayerStore
            .getState()
            .toast("音频循环启动失败，请点击播放重试", "error");
        });
      }
      return;
    }
    if (mode === "sequence" && index >= queue.length - 1) {
      usePlayerStore.setState({ playing: false });
      return;
    }
    let nextIndex = index + 1;
    if (mode === "shuffle" && queue.length > 1) {
      nextIndex = Math.floor(Math.random() * queue.length);
      if (nextIndex === index) nextIndex = (index + 1) % queue.length;
    }
    const nextSong =
      mode === "shuffle" && preloadedSongId
        ? queue.find((song) => song.id === preloadedSongId)
        : queue[nextIndex];
    if (nextSong && preloadedSongId === nextSong.id && preloadedUrl) {
      st.commitPreloaded(nextSong, queue, queueSource, preloadedUrl);
    } else {
      next();
    }
  };

  const handleEnded = (event: SyntheticEvent<HTMLAudioElement>) => {
    advanceAfterEnded(event.currentTarget);
  };

  // WebView media events can be dropped during decoder promotion. The native
  // ended flag is stable, so use it as a low-frequency fallback for the same
  // transition path.
  useEffect(() => {
    const audio =
      activeAudio === 0 ? audioRef.current : preloadAudioRef.current;
    if (!playing) {
      handledEndedUrlRef.current = null;
      return;
    }
    if (!audio || !currentUrl) return;
    const timer = window.setInterval(() => {
      // WebView 在解码器交接窗口可能直接丢掉 ended 事件；此外个别流
      // 结尾会停在最后 <120ms 处、ended 永不置位。两种残局都按“已播完”
      // 兜底推进（试听截断与此无关，previewEnd 时绝不插手）。
      const st = usePlayerStore.getState();
      const nearEnd =
        st.previewEnd === null &&
        !audio.paused &&
        Number.isFinite(audio.duration) &&
        audio.duration - audio.currentTime <= 0.12;
      if (audio.ended || nearEnd) advanceAfterEnded(audio);
    }, 200);
    return () => window.clearInterval(timer);
  }, [activeAudio, currentUrl, playing, preloadedSongId, preloadedUrl]);

  const handleAudioTimeUpdate = (event: SyntheticEvent<HTMLAudioElement>) => {
    const active =
      activeAudio === 0 ? audioRef.current : preloadAudioRef.current;
    if (event.currentTarget !== active) return;
    const state = usePlayerStore.getState();
    // 过渡窗口内不写进度；同时 duration 需按试听截断，避免总时长来回跳。
    if (state.pendingPlayToken !== 0) return;
    const el = event.currentTarget;
    const rawDuration = Number.isFinite(el.duration)
      ? Math.floor(el.duration * 1000)
      : 0;
    usePlayerStore.setState({
      progress: Math.floor(el.currentTime * 1000),
      duration:
        state.previewEnd === null
          ? rawDuration
          : Math.min(rawDuration || state.previewEnd, state.previewEnd),
    });
  };

  const handleAudioMetadata = (event: SyntheticEvent<HTMLAudioElement>) => {
    const active =
      activeAudio === 0 ? audioRef.current : preloadAudioRef.current;
    if (event.currentTarget !== active) return;
    const el = event.currentTarget;
    // 试听歌曲固定从歌曲开头播放，不应用续播位置。
    if (
      pendingSeek !== null &&
      usePlayerStore.getState().previewEnd === null &&
      Number.isFinite(el.duration)
    ) {
      el.currentTime = Math.min(el.duration, Math.max(0, pendingSeek / 1000));
      usePlayerStore.setState({
        pendingSeek: null,
        progress: el.currentTime * 1000,
      });
    }
    if (Number.isFinite(el.duration)) {
      const state = usePlayerStore.getState();
      const duration = Math.floor(el.duration * 1000);
      usePlayerStore.setState({
        duration:
          state.previewEnd === null
            ? duration
            : Math.min(duration, state.previewEnd),
      });
    }
  };

  const handleAudioPlaying = (event: SyntheticEvent<HTMLAudioElement>) => {
    const active =
      activeAudio === 0 ? audioRef.current : preloadAudioRef.current;
    if (event.currentTarget !== active) return;
    usePlayerStore.getState().notePlaybackOk();
    resumeAnalyser();
  };

  const handleAudioCanPlay = (event: SyntheticEvent<HTMLAudioElement>) => {
    const inactive =
      activeAudio === 0 ? preloadAudioRef.current : audioRef.current;
    if (
      event.currentTarget !== inactive ||
      !qualitySwitchUrl ||
      !qualitySwitchQuality
    )
      return;
    const el = event.currentTarget;
    // 每次换源重置寻址标记（不同目标 URL 视为新一次切换）。
    if (qualitySeekRef.current.url !== qualitySwitchUrl) {
      qualitySeekRef.current = { url: qualitySwitchUrl, seeked: false };
    }
    const active =
      activeAudio === 0 ? audioRef.current : preloadAudioRef.current;
    const position = active ? Math.max(0, active.currentTime * 1000) : 0;
    if (!qualitySeekRef.current.seeked) {
      // 第一阶段：先跳到当前播放位置，让浏览器围绕目标位置取流。
      // 新加载的流只会从 0 开始缓冲，对中途切换毫无意义；seek 后
      // seeked/canplay 会再次触发本 handler 进入第二阶段。
      el.currentTime = position / 1000;
      qualitySeekRef.current.seeked = true;
      return;
    }
    // 第二阶段：目标位置数据充分（HAVE_ENOUGH_DATA）才交接。旧解码器
    // 在此期间持续出声，杜绝「切完直接没声、几秒后才有声音」的空窗；
    // 缓冲不足时保持等待，progress/canplay 事件会再次驱动本流程。
    if (el.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) return;
    // 先让新音质真正出声，再停掉旧解码器。旧实现先 pause 再 play，
    // 一旦 play() 因缓冲/系统原因迟迟不返回，UI 停在“播放中”却既无进度
    // 也无声；现在最坏情况只是短暂双声重叠，不会出现静默挂起。
    const switchSuperseded = () =>
      usePlayerStore.getState().qualitySwitchUrl !== qualitySwitchUrl ||
      usePlayerStore.getState().qualitySwitchQuality !== qualitySwitchQuality;
    if (!usePlayerStore.getState().playing) {
      active?.pause();
      commitQualitySwitch(qualitySwitchUrl, qualitySwitchQuality, position);
      return;
    }
    resumeAnalyser();
    // 瞬时交接，不做交叉淡化：淡化会让音量先变小再恢复，听感像「声音
    // 被压下去好几秒」。缓冲就绪后立即换手。
    void inactive
      .play()
      .then(() => {
        if (switchSuperseded()) return;
        active?.pause();
        commitQualitySwitch(qualitySwitchUrl, qualitySwitchQuality, position);
      })
      .catch(() => {
        inactive.pause();
        if (!switchSuperseded()) {
          cancelQualitySwitch();
          qualitySeekRef.current = { url: "", seeked: false };
          usePlayerStore
            .getState()
            .toast("音质切换启动失败，已保留当前播放", "info");
        }
      });
  };

  const handleAudioError = (event: SyntheticEvent<HTMLAudioElement>) => {
    const active =
      activeAudio === 0 ? audioRef.current : preloadAudioRef.current;
    const inactive =
      activeAudio === 0 ? preloadAudioRef.current : audioRef.current;
    if (event.currentTarget === inactive && qualitySwitchUrl) {
      cancelQualitySwitch();
      qualitySeekRef.current = { url: "", seeked: false };
      usePlayerStore.getState().toast("该音质暂时不可用，已保留原音质", "info");
      return;
    }
    if (event.currentTarget !== active) return;
    const mediaCode = event.currentTarget.error?.code;
    const currentSong = usePlayerStore.getState().currentSong;
    const message =
      mediaCode === MediaError.MEDIA_ERR_NETWORK
        ? "音频网络加载失败，请检查网络连接后重试"
        : mediaCode === MediaError.MEDIA_ERR_DECODE
          ? "音频文件解码失败，该歌曲资源可能已损坏或失效"
          : mediaCode === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
            ? playbackFailureMessage(currentSong)
            : "音频播放被中断，请稍后重试";
    usePlayerStore.setState({ playing: false });
    usePlayerStore.getState().failCurrent(message);
  };

  const renderPage = () => {
    switch (activeView) {
      case "home":
        return <HomePage />;
      case "chart":
        return <ChartPage />;
      case "search":
        return <SearchPage />;
      case "profile":
        return <ProfilePage />;
      case "collection":
        return <CollectionPage />;
      case "comments":
        return <CommentPage />;
      case "playlist":
        return <PlaylistPage />;
      case "userlist":
        return <UserListPage />;
      case "album":
        return <AlbumPage />;
      case "artist":
        return <ArtistPage />;
      case "radio":
        return <RadioPage />;
      case "radioDetail":
        return <RadioDetailPage />;
      case "social":
        return <SocialPage />;
      case "cloud":
        return <CloudPage />;
      case "yunbei":
        return <YunbeiPage />;
      case "voiceWorkbench":
        return <VoiceWorkbenchPage />;
      case "lyricsMark":
        return <LyricsMarkPage />;
      case "digitalAlbum":
        return <DigitalAlbumPage />;
      case "musician":
        return <MusicianPage />;
      case "sati":
        return <SatiPage />;
      case "broadcast":
        return <BroadcastPage />;
      case "ugc":
        return <UgcPage />;
      case "listenReports":
        return <ListenReportsPage />;
      case "fans":
        return <FansPage />;
      case "style":
        return <StylePage />;
      case "topics":
        return <TopicPage />;
      case "library":
        return <LibraryPage />;
      case "calendar":
        return <CalendarPage />;
      case "privateDj":
        return <PrivateDjPage />;
      case "videos":
        return <VideoPage />;
      default:
        return <HomePage />;
    }
  };

  return (
    <div className="app">
      {currentPage !== "nowplaying" && (
        <div className="browse-layer">
          <TitleBar />
          <TopNav />
          <main className="page-content">
            <LoginGate>
              <Suspense fallback={<div className="page-loading" />}>
                {renderPage()}
              </Suspense>
            </LoginGate>
          </main>
        </div>
      )}
      {currentPage === "nowplaying" &&
        (NowPlayingView ? (
          <NowPlayingView />
        ) : (
          <div className="now-playing-loading" />
        ))}
      <PlayerBar />
      {mountedOverlays.login && (
        <Suspense fallback={null}>
          <LoginModal />
        </Suspense>
      )}
      {mountedOverlays.notifications && (
        <Suspense fallback={null}>
          <NotificationModal />
        </Suspense>
      )}
      {mountedOverlays.commentHistory && (
        <Suspense fallback={null}>
          <CommentHistoryModal />
        </Suspense>
      )}
      {mountedOverlays.likes && (
        <Suspense fallback={null}>
          <LikesModal />
        </Suspense>
      )}
      {mountedOverlays.recent && (
        <Suspense fallback={null}>
          <RecentModal />
        </Suspense>
      )}
      {/* 歌手/专辑详情弹窗可互相叠加：后打开的渲染在后（视觉在上层） */}
      {artistModalSeq >= albumModalSeq ? (
        <>
          {mountedOverlays.artistDetail && (
            <Suspense fallback={null}>
              <ArtistModal />
            </Suspense>
          )}
          {mountedOverlays.albumDetail && (
            <Suspense fallback={null}>
              <AlbumModal />
            </Suspense>
          )}
        </>
      ) : (
        <>
          {mountedOverlays.albumDetail && (
            <Suspense fallback={null}>
              <AlbumModal />
            </Suspense>
          )}
          {mountedOverlays.artistDetail && (
            <Suspense fallback={null}>
              <ArtistModal />
            </Suspense>
          )}
        </>
      )}
      {/* 资源评论弹窗（专辑弹窗内继续打开的评论区）叠在详情弹窗之上 */}
      {mountedOverlays.commentsModal && (
        <Suspense fallback={null}>
          <CommentsModal />
        </Suspense>
      )}
      {/* 评论抽屉可能从播放栏等处打开，渲染在其后保证叠放在上层 */}
      {mountedOverlays.comments && (
        <Suspense fallback={null}>
          <PlayerCommentsDrawer />
        </Suspense>
      )}
      <SettingsModal />
      {mountedOverlays.update && (
        <Suspense fallback={null}>
          <UpdateModal />
        </Suspense>
      )}
      <Toasts />
      <MediaDetailDialog />

      <audio
        ref={audioRef}
        preload="auto"
        crossOrigin="anonymous"
        onTimeUpdate={handleAudioTimeUpdate}
        onLoadedMetadata={handleAudioMetadata}
        onCanPlay={handleAudioCanPlay}
        onEnded={handleEnded}
        onPlaying={handleAudioPlaying}
        onError={handleAudioError}
        style={{ display: "none" }}
      />
      <audio
        ref={preloadAudioRef}
        preload="auto"
        crossOrigin="anonymous"
        onTimeUpdate={handleAudioTimeUpdate}
        onLoadedMetadata={handleAudioMetadata}
        onCanPlay={handleAudioCanPlay}
        onEnded={handleEnded}
        onPlaying={handleAudioPlaying}
        onError={handleAudioError}
        style={{ display: "none" }}
      />
    </div>
  );
}
