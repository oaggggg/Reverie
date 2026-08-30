import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ChevronDown, DiscAlbum, MicVocal, SlidersHorizontal } from "lucide-react";
import { usePlayerStore } from "../store/playerStore";
import { loadParticleAlbumCover } from "../utils/nowPlayingPreload";
// three.js is ~530 kB of the bundle and only the particle cover needs it.
// Loading it lazily keeps it out of the first paint entirely, and a machine on
// the "image" tier never downloads or parses it at all.
const ParticleAlbumCover = lazy(loadParticleAlbumCover);
import CoverErrorBoundary from "./CoverErrorBoundary";
import { QUALITY_GRID } from "../utils/gpuBenchmark";
import Lyrics3D from "./Lyrics3D";
import { sizedImage } from "../utils/image";
import { extractCoverAccent, type CoverAccent } from "../utils/coverAccent";
import {
  captureInteractionOrigin,
  useOriginTransition,
} from "../utils/originTransition";
import PlaybackVisualPanel from "./PlaybackVisualPanel";

// The cover is displayed at roughly 380 CSS px. A 2x source is enough for
// sharpness while avoiding the much larger decoded 1120px bitmap.
const COVER_IMAGE_SIZE = 760;
/** 间奏判定：下一句歌词超过该时长才到来时，按"待唱"弱化展示下一句。 */
const INTERLUDE_MS = 10000;

export default function NowPlayingView() {
  const currentSong = usePlayerStore((s) => s.currentSong);
  const playing = usePlayerStore((s) => s.playing);
  const lyricLines = usePlayerStore((s) => s.lyricLines);
  // In full-list mode the list subscribes to the derived active line itself;
  // keeping raw progress out of this component prevents a whole-scene render
  // on every playback tick.
  const progress = usePlayerStore((s) =>
    s.lyricLayout === "full" ? 0 : s.progress,
  );
  const seek = usePlayerStore((s) => s.seek);
  const setPage = usePlayerStore((s) => s.setPage);
  const ensureLyrics = usePlayerStore((s) => s.ensureLyrics);
  const lyricFx = usePlayerStore((s) => s.lyricFx);
  const lyricLayout = usePlayerStore((s) => s.lyricLayout);
  const lyricFontSize = usePlayerStore((s) => s.lyricFontSize);
  const showTranslation = usePlayerStore((s) => s.showTranslation);
  const npFrameRate = usePlayerStore((s) => s.npFrameRate);
  const npWallpaper = usePlayerStore((s) => s.npWallpaper);
  const npVoid = usePlayerStore((s) => s.npVoid);
  const coverQuality = usePlayerStore((s) => s.coverQuality);
  const rhythmGain = usePlayerStore((s) => s.rhythmGain);
  const lyricClarity = usePlayerStore((s) => s.lyricClarity);
  const lyricOffsetX = usePlayerStore((s) => s.lyricOffsetX);
  const lyricOffsetY = usePlayerStore((s) => s.lyricOffsetY);
  const [fadedIn, setFadedIn] = useState(false);
  const closingRef = useRef(false);
  const [transitionPhase, setTransitionPhase] = useState<
    "opening" | "idle" | "closing"
  >("opening");
  const [visualOpen, setVisualOpen] = useState(false);
  const visualTriggerRef = useRef<HTMLButtonElement>(null);
  const visualTransition = useOriginTransition<HTMLElement>(
    visualOpen,
    "np-visual",
    220,
  );
  const [currentLyricLine, setCurrentLyricLine] = useState("");
  const [nextLyricLine, setNextLyricLine] = useState("");
  const [currentLyricTranslation, setCurrentLyricTranslation] = useState("");
  const [nextLyricTranslation, setNextLyricTranslation] = useState("");
  const [lyricPending, setLyricPending] = useState(false);
  // 封面与歌词共用的旋转状态：ParticleAlbumCover 逐帧写入，
  // 两层 Lyrics3D（正/反）逐帧读取，拖拽时歌词与封面一体联动。
  const rotationRef = useRef({ x: 0, y: 0 });
  // 滚轮缩放同样共享：封面推拉相机，歌词按同一系数缩放。
  const zoomRef = useRef(1);
  const motionListenersRef = useRef(new Set<() => void>());
  const handleCoverOverload = useCallback(() => {
    usePlayerStore.getState().degradeCoverQuality();
  }, []);
  const [coverAccent, setCoverAccent] = useState<CoverAccent>({
    color: "#7df9ff",
    soft: "rgba(125, 249, 255, 0.32)",
  });
  const [wallpaperSrc, setWallpaperSrc] = useState("");
  const [wallpaperPreviewSrc, setWallpaperPreviewSrc] = useState("");
  // 深度休眠：页面隐藏 60s 后卸载视频解码器/网页 iframe（pause 挂起
  // 并不释放显存中的解码缓冲与合成层），恢复可见时重新挂载。后台长
  // 时间挂机时壁纸的 GPU/内存占用归零，只保留静态预览图。
  const [wallpaperSleep, setWallpaperSleep] = useState(false);
  const wallpaperRef = useRef<HTMLVideoElement>(null);
  // 顶部按钮（返回 / DIY）与底部播放栏的显隐：进入页面展示，
  // 停顿后自动隐藏。呼出区按各控件收窄：返回=左上角、DIY=右上角、
  // 播放栏=底部边缘，各自独立呼出互不影响。
  const [backShown, setBackShown] = useState(true);
  const [diyShown, setDiyShown] = useState(true);
  const [barShown, setBarShown] = useState(true);

  useEffect(() => {
    if (!visualOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (visualTransition.surfaceRef.current?.contains(target)) return;
      if (visualTriggerRef.current?.contains(target)) return;
      setVisualOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [visualOpen, visualTransition.surfaceRef]);

  // 歌词自动取色：有壁纸时取壁纸预览图的颜色，否则取专辑封面的颜色。
  useEffect(() => {
    if (npWallpaper) return;
    let disposed = false;
    void extractCoverAccent(currentSong?.picUrl ?? "").then((accent) => {
      if (!disposed) setCoverAccent(accent);
    });
    return () => {
      disposed = true;
    };
  }, [currentSong?.picUrl, npWallpaper]);

  // Wallpaper Engine 壁纸：本机绝对路径需经 asset 协议暴露给 WebView。
  // 壁纸启用后歌词改从壁纸预览图自动取色。
  useEffect(() => {
    let disposed = false;
    if (!npWallpaper) {
      setWallpaperSrc("");
      return;
    }
    void import("@tauri-apps/api/core")
      .then(({ convertFileSrc }) => {
        if (disposed) return;
        setWallpaperSrc(convertFileSrc(npWallpaper.path));
        setWallpaperPreviewSrc(
          npWallpaper.preview ? convertFileSrc(npWallpaper.preview) : "",
        );
        if (npWallpaper.preview) {
          void extractCoverAccent(convertFileSrc(npWallpaper.preview)).then(
            (accent) => {
              if (!disposed) setCoverAccent(accent);
            },
          );
        }
      })
      .catch(() => {});
    return () => {
      disposed = true;
    };
  }, [npWallpaper]);

  // Wallpaper video is a sizeable, continuous GPU workload. Keep it paused
  // when audio is paused or the document is hidden, then resume on return.
  useEffect(() => {
    const video = wallpaperRef.current;
    if (!video || !wallpaperSrc || wallpaperSleep) return;
    const sync = () => {
      if (playing && !document.hidden) {
        void video.play().catch(() => {});
      } else {
        video.pause();
      }
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, [playing, wallpaperSrc, wallpaperSleep]);

  // 壁纸深度休眠计时：视频壁纸在页面隐藏持续 60s 后整体卸载
  // <video> 载体（pause 挂起并不释放解码缓冲与合成层显存），
  // 恢复可见立即唤醒重挂载，休眠期间以静态预览图顶替。
  useEffect(() => {
    if (!npWallpaper || !wallpaperSrc) return;
    const HIDE_SLEEP_MS = 60_000;
    let timer = 0;
    const onVis = () => {
      window.clearTimeout(timer);
      if (document.hidden) {
        timer = window.setTimeout(() => setWallpaperSleep(true), HIDE_SLEEP_MS);
      } else {
        setWallpaperSleep(false);
      }
    };
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [npWallpaper, wallpaperSrc]);

  // 播放页 chrome 自动隐藏：进入页面展示。呼出范围就是各控件自身的
  // 矩形范围（外扩 8px 容差）：悬停在返回/DIY 按钮或播放栏本体上才
  // 呼出，离开约 0.6s 后单独收起，互不联动；指针完全不动 2.6s 后全部
  // 隐藏。播放栏在 NowPlayingView 之外渲染，通过根元素 data 属性通知；
  // 其矩形由 CSS 变量推算（hidden 态的 transform 会让 getBoundingClientRect
  // 失真，而 offset 尺寸稳定）。
  const backRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const PAD = 8;
    const LEAVE_MS = 600;
    const IDLE_MS = 2600;
    let pointerX = -1;
    let pointerY = -1;
    const leaveTimers = { back: 0, diy: 0, bar: 0 };
    const idleId = { current: 0 };

    const cssVarPx = (name: string, fallback: number) => {
      const v = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(name),
      );
      return Number.isFinite(v) ? v : fallback;
    };
    const barRect = () => {
      const inset = cssVarPx("--bar-inset", 24);
      const width = Math.min(
        cssVarPx("--bar-max", 900),
        window.innerWidth - inset * 2,
      );
      const height = cssVarPx("--bar-h", 76);
      const float = cssVarPx("--bar-float", 16);
      return {
        left: (window.innerWidth - width) / 2,
        right: (window.innerWidth + width) / 2,
        top: window.innerHeight - float - height,
        bottom: window.innerHeight,
      };
    };
    const rectOf = (el: HTMLElement | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
      };
    };
    const inRect = (r: {
      left: number;
      right: number;
      top: number;
      bottom: number;
    }) =>
      pointerX >= r.left - PAD &&
      pointerX <= r.right + PAD &&
      pointerY >= r.top - PAD &&
      pointerY <= r.bottom + PAD;

    const setters = {
      back: setBackShown,
      diy: setDiyShown,
      bar: setBarShown,
    };
    const reveal = (key: "back" | "diy" | "bar") => {
      const rect =
        key === "back"
          ? rectOf(backRef.current)
          : key === "diy"
            ? rectOf(visualTriggerRef.current)
            : barRect();
      if (!rect) return;
      if (inRect(rect)) {
        window.clearTimeout(leaveTimers[key]);
        setters[key](true);
      } else if (!leaveTimers[key]) {
        leaveTimers[key] = window.setTimeout(() => {
          leaveTimers[key] = 0;
          setters[key](false);
        }, LEAVE_MS);
      }
    };
    const onMove = (event: PointerEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      reveal("back");
      reveal("diy");
      reveal("bar");
      window.clearTimeout(idleId.current);
      idleId.current = window.setTimeout(() => {
        setBackShown(false);
        setDiyShown(false);
        setBarShown(false);
      }, IDLE_MS);
    };
    window.addEventListener("pointermove", onMove);
    // 初始（可能没有指针移动）全部隐藏
    idleId.current = window.setTimeout(() => {
      setBackShown(false);
      setDiyShown(false);
      setBarShown(false);
    }, IDLE_MS);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.clearTimeout(idleId.current);
      for (const t of Object.values(leaveTimers)) window.clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.npChromeBottom = barShown ? "show" : "hide";
    return () => {
      delete root.dataset.npChromeBottom;
    };
  }, [barShown]);

  // DIY 面板挂在 DIY 按钮下方，面板打开期间 DIY 按钮保持可见。
  useEffect(() => {
    if (visualOpen) setDiyShown(true);
  }, [visualOpen]);

  // A session restored on startup never went through playSong, so its lyrics
  // were never fetched. This view is the only lyric surface, so it has to ask.
  useEffect(() => {
    ensureLyrics();
  }, [ensureLyrics, currentSong?.id]);

  // Parse and update lyrics based on progress. 前奏与长间奏不再显示孤零零的
  // 音符，而是把下一句歌词以"待唱"弱化样式提前展示。
  useEffect(() => {
    const clear = () => {
      setCurrentLyricLine("");
      setNextLyricLine("");
      setCurrentLyricTranslation("");
      setNextLyricTranslation("");
      setLyricPending(false);
    };
    if (!lyricLines || !lyricLines.length) {
      clear();
      return;
    }

    let currentIndex = -1;
    for (let i = 0; i < lyricLines.length; i++) {
      if (lyricLines[i].time <= progress) {
        currentIndex = i;
      } else {
        break;
      }
    }

    if (currentIndex < 0) {
      // 前奏：还没唱到第一句。
      setCurrentLyricLine(lyricLines[0]?.text || "");
      setNextLyricLine(lyricLines[1]?.text || "");
      setCurrentLyricTranslation(lyricLines[0]?.translation || "");
      setNextLyricTranslation(lyricLines[1]?.translation || "");
      setLyricPending(true);
      return;
    }

    const nextTime = lyricLines[currentIndex + 1]?.time;
    if (nextTime !== undefined && nextTime - progress > INTERLUDE_MS) {
      // 长间奏：当前句早已结束，直接弱化展示下一句。
      setCurrentLyricLine(lyricLines[currentIndex + 1]?.text || "");
      setNextLyricLine(lyricLines[currentIndex + 2]?.text || "");
      setCurrentLyricTranslation(lyricLines[currentIndex + 1]?.translation || "");
      setNextLyricTranslation(lyricLines[currentIndex + 2]?.translation || "");
      setLyricPending(true);
      return;
    }

    setLyricPending(false);
    // 解析层已剔除空行与 "♪" 间奏标记行，这里不再需要音符占位。
    setCurrentLyricLine(lyricLines[currentIndex].text || "");
    setCurrentLyricTranslation(lyricLines[currentIndex].translation || "");
    if (currentIndex + 1 < lyricLines.length) {
      setNextLyricLine(lyricLines[currentIndex + 1].text || "");
      setNextLyricTranslation(lyricLines[currentIndex + 1].translation || "");
    } else {
      setNextLyricLine("");
      setNextLyricTranslation("");
    }
  }, [lyricLines, progress]);

  // 页面采用整体淡入并轻微上移，避免专辑封面在进入/退出时缩放跳动。
  useEffect(() => {
    if (transitionPhase !== "opening") return;
    const frame = requestAnimationFrame(() => setFadedIn(true));
    const timer = window.setTimeout(() => setTransitionPhase("idle"), 320);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [transitionPhase]);

  useEffect(() => {
    if (transitionPhase !== "closing") return;
    const timer = window.setTimeout(() => setPage("browse"), 240);
    return () => window.clearTimeout(timer);
  }, [setPage, transitionPhase]);

  // Closing: collapse the cover back to the player bar cover, then navigate.
  const handleClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setVisualOpen(false);
    setFadedIn(false);
    setTransitionPhase("closing");
  };

  const staticCover = currentSong?.picUrl ? (
    <img
      className="np-cover-img"
      src={sizedImage(currentSong.picUrl, COVER_IMAGE_SIZE)}
      alt=""
    />
  ) : (
    <div className="np-cover-ph">
      <DiscAlbum size={56} />
    </div>
  );

  const lyricsProps = {
    currentLine: currentLyricLine,
    nextLine: nextLyricLine,
    currentTranslation: currentLyricTranslation,
    nextTranslation: nextLyricTranslation,
    pending: lyricPending,
    rotationRef,
    zoomRef,
    motionListenersRef,
    fx: lyricFx,
    clarity: lyricClarity,
    accent: coverAccent,
    layout: lyricLayout,
    lyricLines,
    progress,
    showTranslation,
    lyricFontSize,
    onSeekLine: (time: number) => seek(time),
  };

  const wallpaperBackground = (() => {
    if (!npWallpaper || !wallpaperSrc) return null;
    // 深度休眠：视频壁纸卸载后以预览图顶替，视觉几乎无感。
    if (wallpaperSleep) {
      return wallpaperPreviewSrc ? (
        <img
          className="np-wallpaper"
          src={wallpaperPreviewSrc}
          alt=""
          aria-hidden
        />
      ) : null;
    }
    return (
      <video
        key={wallpaperSrc}
        ref={wallpaperRef}
        className="np-wallpaper"
        src={wallpaperSrc}
        autoPlay={playing}
        loop
        muted
        playsInline
      />
    );
  })();

  return (
    <div
      className={`now-playing now-playing-3d${playing ? " np-playing" : ""} ${fadedIn ? "np-scene-ready" : "np-scene-leaving"}${backShown ? "" : " np-hide-back"}${diyShown ? "" : " np-hide-diy"}`}
    >
      <button
        ref={backRef}
        className={`np-btn np-back ${fadedIn ? "np-fade-in" : ""}`}
        onClick={handleClose}
        title="返回"
      >
        <ChevronDown size={20} />
      </button>

      <button
        ref={visualTriggerRef}
        className={`np-btn np-visual-trigger ${fadedIn ? "np-fade-in" : ""}`}
        onClick={(event) => {
          captureInteractionOrigin("np-visual", event.currentTarget);
          setVisualOpen(true);
        }}
        title="DIY"
      >
        <SlidersHorizontal size={18} />
      </button>

      {visualTransition.rendered && (
        <PlaybackVisualPanel
          surfaceRef={visualTransition.surfaceRef}
          transitionClassName={visualTransition.surfaceClassName}
          onClose={() => setVisualOpen(false)}
        />
      )}

      <div className="np-stage-3d">
        {/* 反歌词层：位于粒子封面之后，经 Y 轴翻转的镜像画面；虚空模式无封面，随之隐藏 */}
        {!npVoid && (
          <div
            className="np-lyrics-3d np-lyrics-back"
            aria-hidden
            style={{
              transform: `translate(${lyricOffsetX}px, ${lyricOffsetY}px)`,
            }}
          >
            <Lyrics3D {...lyricsProps} side="back" />
          </div>
        )}

        {/* 虚空时封面保持挂载仅隐藏（透明过渡），切换零重建不卡顿 */}
        <div className={`np-cover-3d${npVoid ? " np-cover-hidden" : ""}`}>
          {!currentSong?.picUrl ? (
            <div className="np-cover-ph">
              <MicVocal size={56} />
            </div>
          ) : coverQuality === "image" ? (
            staticCover
          ) : (
            // Any WebGL failure degrades to the plain cover instead of taking
            // the whole app down with it; Suspense shows the same cover while
            // the three.js chunk loads.
            <CoverErrorBoundary
              fallback={staticCover}
              onError={() =>
                usePlayerStore
                  .getState()
                  .setCoverQuality("image", "封面渲染失败，已切换为静态封面")
              }
            >
              <Suspense fallback={staticCover}>
                <ParticleAlbumCover
                  imageUrl={sizedImage(currentSong.picUrl, COVER_IMAGE_SIZE)}
                  grid={QUALITY_GRID[coverQuality]}
                  fpsLimit={npFrameRate}
                  rhythmGain={rhythmGain}
                  paused={npVoid || !playing}
                  active={playing && !npVoid}
                  rotationRef={rotationRef}
                  zoomRef={zoomRef}
                  motionListenersRef={motionListenersRef}
                  onOverload={handleCoverOverload}
                />
              </Suspense>
            </CoverErrorBoundary>
          )}
        </div>

        {/* 正歌词层：与封面同一 3D 装配体，悬浮于封面平面之前 */}
        <div
          className="np-lyrics-3d np-lyrics-front"
          style={{
            transform: `translate(${lyricOffsetX}px, ${lyricOffsetY}px)`,
          }}
        >
          <Lyrics3D {...lyricsProps} side="front" />
        </div>
      </div>

      {wallpaperBackground}
    </div>
  );
}
