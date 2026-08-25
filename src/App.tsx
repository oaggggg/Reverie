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
import { playbackFailureMessage, usePlayerStore } from "./store/playerStore";
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

const AUDIO_FADE_IN_MS = 180;
const AUDIO_FADE_OUT_MS = 140;
const SEAMLESS_CROSSFADE_MS = 260;

const ChartPage = lazy(() => import("./components/ChartPage"));
const SearchPage = lazy(() => import("./components/SearchPage"));
const ProfilePage = lazy(() => import("./components/ProfilePage"));
const CollectionPage = lazy(() => import("./components/CollectionPage"));
const NotificationPage = lazy(() => import("./components/NotificationPage"));
const CommentPage = lazy(() => import("./components/CommentPage"));
const PlaylistPage = lazy(() => import("./components/PlaylistPage"));
const UserListPage = lazy(() => import("./components/UserListPage"));
const LikesPage = lazy(() => import("./components/LikesPage"));
const RecentPage = lazy(() => import("./components/RecentPage"));
const AlbumPage = lazy(() => import("./components/AlbumPage"));
const ArtistPage = lazy(() => import("./components/ArtistPage"));
const RadioPage = lazy(() => import("./components/RadioPage"));
const RadioDetailPage = lazy(() => import("./components/RadioDetailPage"));
const SocialPage = lazy(() => import("./components/SocialPage"));
const CloudPage = lazy(() => import("./components/CloudPage"));
const YunbeiPage = lazy(() => import("./components/YunbeiPage"));
const CommentHistoryPage = lazy(
  () => import("./components/CommentHistoryPage"),
);
const ListenTogetherPage = lazy(
  () => import("./components/ListenTogetherPage"),
);
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
const LoginModal = lazy(() => import("./components/LoginModal"));
const UpdateModal = lazy(() => import("./components/UpdateModal"));

export default function App() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const preloadAudioRef = useRef<HTMLAudioElement>(null);
  const fadeFramesRef = useRef(new Map<HTMLAudioElement, number>());
  const playbackSyncRef = useRef(0);
  const seamlessTransitionRef = useRef(false);
  const skipNextFadeInRef = useRef(false);
  const handledEndedUrlRef = useRef<string | null>(null);
  // 静音看门狗：AudioContext 被系统挂起或音量被竞态留在 0 时，
  // 媒体元素照常走表（播放栏正常）却没有声音。连续多帧异常才触发自愈，
  // 避免把正常的淡入淡出误判为故障；toast 只提示一次，防止刷屏。
  const silentGraphTicksRef = useRef(0);
  const silentVolumeTicksRef = useRef(0);
  const silentToastShownRef = useRef(false);

  const cancelAudioFade = (audio: HTMLAudioElement) => {
    const frame = fadeFramesRef.current.get(audio);
    if (frame !== undefined) {
      window.cancelAnimationFrame(frame);
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
    if (duration <= 0 || Math.abs(start - end) < 0.005) {
      audio.volume = end;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      const startedAt = performance.now();
      const step = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        audio.volume = start + (end - start) * eased;
        if (progress >= 1) {
          fadeFramesRef.current.delete(audio);
          resolve();
          return;
        }
        fadeFramesRef.current.set(audio, window.requestAnimationFrame(step));
      };
      fadeFramesRef.current.set(audio, window.requestAnimationFrame(step));
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
  const showLogin = usePlayerStore((s) => s.showLogin);
  const showUpdate = usePlayerStore((s) => s.showUpdate);
  const currentSong = usePlayerStore((s) => s.currentSong);
  const coverQuality = usePlayerStore((s) => s.coverQuality);
  const reportedSongRef = useRef<number | null>(null);
  const scrollPositionsRef = useRef(new Map<string, number>());
  const [NowPlayingView, setNowPlayingView] = useState<ComponentType | null>(
    null,
  );
  const [mountedOverlays, setMountedOverlays] = useState({
    comments: showPlayerComments,
    login: showLogin,
    update: showUpdate,
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
    if (!showPlayerComments && !showLogin && !showUpdate) return;
    setMountedOverlays((current) => ({
      comments: current.comments || showPlayerComments,
      login: current.login || showLogin,
      update: current.update || showUpdate,
    }));
  }, [showLogin, showPlayerComments, showUpdate]);

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

  // theme: follow system / light / dark
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const effective =
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
          a.play().catch(() => {
            a.volume = target;
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
            return fadeAudioVolume(a, target, AUDIO_FADE_IN_MS);
          })
          .catch(() => {
            a.volume = target;
            // 过期轮次的 play 被新一轮 load() 打断属正常现象；
            // 只有当前轮次失败才代表真的无法播放。
            const state = usePlayerStore.getState();
            if (
              syncToken === playbackSyncRef.current &&
              state.currentUrl === currentUrl &&
              state.playing
            ) {
              usePlayerStore.setState({ playing: false });
              state.toast("音频启动失败，请点击播放重试", "error");
            }
          });
      }
    } else if (!a.paused) {
      void fadeAudioVolume(a, 0, AUDIO_FADE_OUT_MS).then(() => {
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
        // ── 静音自愈看门狗 ──────────────────────────────────────────
        // 症状：进度条正常前进，但听不到声音。两个已知成因：
        // 1) Web Audio 图被系统挂起（设备切换/休眠唤醒/autoplay 策略），
        //    元素输出被路由进挂起的上下文 → 整条链静音；
        // 2) 淡入淡出竞态把元素音量留在 ≈0。
        if (!audio.paused && audio.volume < 0.01 && !state.muted) {
          silentVolumeTicksRef.current += 1;
        } else {
          silentVolumeTicksRef.current = 0;
        }
        const graphState = audioGraphState();
        const graphSilent =
          graphState !== null && graphState !== "running" && !state.muted;
        if (graphSilent && !audio.paused) {
          silentGraphTicksRef.current += 1;
          resumeAnalyser();
        } else {
          silentGraphTicksRef.current = 0;
        }
        // ≈600ms（前台）仍无起色才动手：淡入只有 180ms，不会误伤。
        if (
          silentGraphTicksRef.current > 18 ||
          silentVolumeTicksRef.current > 18
        ) {
          silentGraphTicksRef.current = 0;
          silentVolumeTicksRef.current = 0;
          audio.volume = state.muted ? 0 : state.volume;
          resumeAnalyser();
          if (!silentToastShownRef.current) {
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
      if (audio.ended) advanceAfterEnded(audio);
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
    if (pendingSeek !== null && Number.isFinite(el.duration)) {
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
    const active =
      activeAudio === 0 ? audioRef.current : preloadAudioRef.current;
    const position = active ? Math.max(0, active.currentTime * 1000) : 0;
    inactive.currentTime = position / 1000;
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
      case "notifications":
        return <NotificationPage />;
      case "comments":
        return <CommentPage />;
      case "playlist":
        return <PlaylistPage />;
      case "userlist":
        return <UserListPage />;
      case "likes":
        return <LikesPage />;
      case "recent":
        return <RecentPage />;
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
      case "commentHistory":
        return <CommentHistoryPage />;
      case "listenTogether":
        return <ListenTogetherPage />;
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
      {mountedOverlays.comments && (
        <Suspense fallback={null}>
          <PlayerCommentsDrawer />
        </Suspense>
      )}
      <PlayerBar />
      {mountedOverlays.login && (
        <Suspense fallback={null}>
          <LoginModal />
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
