import { lazy, Suspense, useEffect, useRef } from "react";
import { usePlayerStore } from "./store/playerStore";
import { ensureAnalyser, resumeAnalyser } from "./utils/audioAnalyser";
import TitleBar from "./components/TitleBar";
import TopNav from "./components/TopNav";
import PlayerBar from "./components/PlayerBar";
import LoginGate from "./components/LoginGate";
import HomePage from "./components/HomePage";
import Toasts from "./components/Toasts";
import SettingsModal from "./components/SettingsModal";
import MediaDetailDialog from "./components/MediaDetailDialog";
import { reportScrobble, reportWeblog } from "./api/playbackReport";

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
const RecommendHistoryPage = lazy(
  () => import("./components/RecommendHistoryPage"),
);
const VipPage = lazy(() => import("./components/VipPage"));
const CommentHistoryPage = lazy(
  () => import("./components/CommentHistoryPage"),
);
const DownloadHistoryPage = lazy(
  () => import("./components/DownloadHistoryPage"),
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
const NowPlayingView = lazy(() => import("./components/NowPlayingView"));
const PlayerCommentsDrawer = lazy(
  () => import("./components/PlayerCommentsDrawer"),
);
const LoginModal = lazy(() => import("./components/LoginModal"));
const UpdateModal = lazy(() => import("./components/UpdateModal"));

export default function App() {
  const audioRef = useRef<HTMLAudioElement>(null);

  const currentUrl = usePlayerStore((s) => s.currentUrl);
  const playing = usePlayerStore((s) => s.playing);
  const theme = usePlayerStore((s) => s.theme);
  const setAudioEl = usePlayerStore((s) => s.setAudioEl);

  const activeView = usePlayerStore((s) => s.activeView);
  const currentPage = usePlayerStore((s) => s.currentPage);
  const showPlayerComments = usePlayerStore((s) => s.showPlayerComments);
  const showLogin = usePlayerStore((s) => s.showLogin);
  const showSettings = usePlayerStore((s) => s.showSettings);
  const showUpdate = usePlayerStore((s) => s.showUpdate);
  const currentSong = usePlayerStore((s) => s.currentSong);
  const reportedSongRef = useRef<number | null>(null);

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

  // register audio element
  useEffect(() => {
    if (audioRef.current) setAudioEl(audioRef.current);
  }, [setAudioEl]);

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
    const el = audioRef.current;
    if (!el) return;
    const st = usePlayerStore.getState();
    if (ensureAnalyser(el)) {
      resumeAnalyser();
    } else {
      st.toast("当前环境不支持音频分析，已切换为波动效果", "error");
      st.setParticleEffect("wave");
    }
  }, [particleEffect]);

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
          void bridge.checkUpdate(false);
        },
        { timeout: delay },
      );
      if (idle === undefined) {
        fallback = window.setTimeout(
          () => {
            fallback = 0;
            void bridge.checkUpdate(false);
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

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
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

  // set src + play on url change
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    // Explicitly detach the previous media resource before assigning a new
    // URL. WebView2 can otherwise keep the old decoder/buffer alive while
    // the next track is loading.
    a.pause();
    a.removeAttribute("src");
    a.load();
    if (currentUrl) {
      a.src = currentUrl;
      a.load();
      a.play().catch(() => {});
    } else {
      a.currentTime = 0;
    }
  }, [currentUrl]);

  // react to play/pause toggle
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !currentUrl) return;
    if (playing) a.play().catch(() => {});
    else a.pause();
  }, [playing, currentUrl]);

  // `timeupdate` only fires a few times per second in WebView. Sample the
  // actual audio clock at 30 fps while playing so the progress bar and lyrics
  // move continuously without forcing the whole app to render at 60 fps.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playing || !currentUrl) return;
    let frame = 0;
    let lastPaint = 0;
    const tick = (now: number) => {
      if (now - lastPaint >= 32 && !document.hidden) {
        lastPaint = now;
        const progress = Math.floor(audio.currentTime * 1000);
        const duration = Number.isFinite(audio.duration)
          ? Math.floor(audio.duration * 1000)
          : 0;
        const state = usePlayerStore.getState();
        if (
          Math.abs(state.progress - progress) >= 16 ||
          state.duration !== duration
        ) {
          usePlayerStore.setState({ progress, duration });
        }
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [playing, currentUrl]);

  const handleEnded = () => {
    const st = usePlayerStore.getState();
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
      st.seek(0);
      audioRef.current?.play().catch(() => {});
      return;
    }
    if (mode === "sequence" && index >= queue.length - 1) {
      usePlayerStore.setState({ playing: false });
      return;
    }
    next();
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
      case "recommendHistory":
        return <RecommendHistoryPage />;
      case "vip":
        return <VipPage />;
      case "commentHistory":
        return <CommentHistoryPage />;
      case "downloadHistory":
        return <DownloadHistoryPage />;
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
      {currentPage === "nowplaying" && (
        <Suspense fallback={<div className="now-playing-loading" />}>
          <NowPlayingView />
        </Suspense>
      )}
      {showPlayerComments && (
        <Suspense fallback={null}>
          <PlayerCommentsDrawer />
        </Suspense>
      )}
      <PlayerBar />
      {showLogin && (
        <Suspense fallback={null}>
          <LoginModal />
        </Suspense>
      )}
      {showSettings && <SettingsModal />}
      {showUpdate && (
        <Suspense fallback={null}>
          <UpdateModal />
        </Suspense>
      )}
      <Toasts />
      <MediaDetailDialog />

      <audio
        ref={audioRef}
        // Required for the spectrum analyser: without it the Web Audio graph
        // is fed a CORS-tainted source and is specified to emit silence.
        crossOrigin="anonymous"
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          usePlayerStore.setState({
            progress: Math.floor(el.currentTime * 1000),
            duration: Number.isFinite(el.duration)
              ? Math.floor(el.duration * 1000)
              : 0,
          });
        }}
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          if (Number.isFinite(el.duration)) {
            usePlayerStore.setState({
              duration: Math.floor(el.duration * 1000),
            });
          }
        }}
        onEnded={handleEnded}
        onPlaying={() => {
          usePlayerStore.getState().notePlaybackOk();
          resumeAnalyser();
        }}
        onError={() => {
          usePlayerStore.setState({ playing: false });
          usePlayerStore.getState().failCurrent("音频加载失败");
        }}
        style={{ display: "none" }}
      />
    </div>
  );
}
