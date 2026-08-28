import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
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
import { readCoverOrigin } from "../utils/sharedCoverTransition";
import {
  captureInteractionOrigin,
  useOriginTransition,
} from "../utils/originTransition";
import PlaybackVisualPanel from "./PlaybackVisualPanel";

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
// The cover is displayed at roughly 380 CSS px. A 2x source is enough for
// sharpness while avoiding the much larger decoded 1120px bitmap.
const COVER_IMAGE_SIZE = 760;
/** 间奏判定：下一句歌词超过该时长才到来时，按"待唱"弱化展示下一句。 */
const INTERLUDE_MS = 10000;

export default function NowPlayingView() {
  const currentSong = usePlayerStore((s) => s.currentSong);
  const lyricLines = usePlayerStore((s) => s.lyricLines);
  const progress = usePlayerStore((s) => s.progress);
  const seek = usePlayerStore((s) => s.seek);
  const setPage = usePlayerStore((s) => s.setPage);
  const ensureLyrics = usePlayerStore((s) => s.ensureLyrics);
  const particleEffect = usePlayerStore((s) => s.particleEffect);
  const lyricTheme = usePlayerStore((s) => s.lyricTheme);
  const lyricLayout = usePlayerStore((s) => s.lyricLayout);
  const lyricFontSize = usePlayerStore((s) => s.lyricFontSize);
  const showTranslation = usePlayerStore((s) => s.showTranslation);
  const npFrameRate = usePlayerStore((s) => s.npFrameRate);
  const npWallpaper = usePlayerStore((s) => s.npWallpaper);
  const coverQuality = usePlayerStore((s) => s.coverQuality);
  const transitionCoverRef = useRef<HTMLImageElement>(null);
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
  const [lyricPending, setLyricPending] = useState(false);
  // 封面与歌词共用的旋转状态：ParticleAlbumCover 逐帧写入，
  // 两层 Lyrics3D（正/反）逐帧读取，拖拽时歌词与封面一体联动。
  const rotationRef = useRef({ x: 0, y: 0 });
  const [coverAccent, setCoverAccent] = useState<CoverAccent>({
    color: "#7df9ff",
    soft: "rgba(125, 249, 255, 0.32)",
  });
  const [wallpaperSrc, setWallpaperSrc] = useState("");

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

  useEffect(() => {
    let disposed = false;
    void extractCoverAccent(currentSong?.picUrl ?? "").then((accent) => {
      if (!disposed) setCoverAccent(accent);
    });
    return () => {
      disposed = true;
    };
  }, [currentSong?.picUrl]);

  // Wallpaper Engine 壁纸：本机绝对路径需经 asset 协议暴露给 WebView。
  useEffect(() => {
    let disposed = false;
    if (!npWallpaper) {
      setWallpaperSrc("");
      return;
    }
    void import("@tauri-apps/api/core")
      .then(({ convertFileSrc }) => {
        if (!disposed) setWallpaperSrc(convertFileSrc(npWallpaper.path));
      })
      .catch(() => {});
    return () => {
      disposed = true;
    };
  }, [npWallpaper]);

  // A session restored on startup never went through playSong, so its lyrics
  // were never fetched. This view is the only lyric surface, so it has to ask.
  useEffect(() => {
    ensureLyrics();
  }, [ensureLyrics, currentSong?.id]);

  // Parse and update lyrics based on progress. 前奏与长间奏不再显示孤零零的
  // 音符，而是把下一句歌词以"待唱"弱化样式提前展示。
  useEffect(() => {
    if (!lyricLines || !lyricLines.length) {
      setCurrentLyricLine("");
      setNextLyricLine("");
      setLyricPending(false);
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
      setLyricPending(true);
      return;
    }

    const nextTime = lyricLines[currentIndex + 1]?.time;
    if (nextTime !== undefined && nextTime - progress > INTERLUDE_MS) {
      // 长间奏：当前句早已结束，直接弱化展示下一句。
      setCurrentLyricLine(lyricLines[currentIndex + 1]?.text || "");
      setNextLyricLine(lyricLines[currentIndex + 2]?.text || "");
      setLyricPending(true);
      return;
    }

    setLyricPending(false);
    setCurrentLyricLine(lyricLines[currentIndex].text || "♪");
    if (currentIndex + 1 < lyricLines.length) {
      setNextLyricLine(lyricLines[currentIndex + 1].text || "");
    } else {
      setNextLyricLine("");
    }
  }, [lyricLines, progress]);

  // A lightweight shared image performs the source-to-destination transition.
  // The full-screen WebGL scene can initialize behind it without being scaled.
  useLayoutEffect(() => {
    const cover = transitionCoverRef.current;
    const origin = readCoverOrigin();
    if (!cover || !origin || !currentSong?.picUrl) {
      setFadedIn(true);
      setTransitionPhase("idle");
      return;
    }

    const targetSize = Math.min(window.innerWidth * 0.34, 380);
    const targetLeft = (window.innerWidth - targetSize) / 2;
    const targetTop = (window.innerHeight - targetSize) / 2 - 20;
    // Animate only composited properties to avoid layout work per frame.
    const originCenterX = origin.left + origin.width / 2;
    const originCenterY = origin.top + origin.height / 2;
    const targetCenterX = targetLeft + targetSize / 2;
    const targetCenterY = targetTop + targetSize / 2;
    const scaleX = targetSize / Math.max(origin.width, 1);
    const scaleY = targetSize / Math.max(origin.height, 1);
    const fromTransform = "translate(" + originCenterX + "px, " + originCenterY + "px) translate(-50%, -50%) scale(1)";
    const centerTransform = "translate(" + targetCenterX + "px, " + targetCenterY + "px) translate(-50%, -50%) scale(" + scaleX + ", " + scaleY + ")";
    cover.style.left = "0px";
    cover.style.top = "0px";
    cover.style.width = origin.width + "px";
    cover.style.height = origin.height + "px";
    cover.style.borderRadius = "50%";

    if (transitionPhase === "opening") {
      setFadedIn(true);
      const animation = cover.animate(
        [
          { transform: fromTransform, borderRadius: "50%", opacity: 1 },
          { transform: centerTransform, borderRadius: "28px", opacity: 1, offset: 0.78 },
          { transform: centerTransform, borderRadius: "28px", opacity: 0 },
        ],
        { duration: 520, easing: EASE, fill: "forwards" },
      );
      void animation.finished
        .then(() => setTransitionPhase("idle"))
        .catch(() => {});
      return () => animation.cancel();
    }

    if (transitionPhase === "closing") {
      const animation = cover.animate(
        [
          { transform: centerTransform, borderRadius: "28px", opacity: 0 },
          { transform: centerTransform, borderRadius: "28px", opacity: 1, offset: 0.18 },
          { transform: fromTransform, borderRadius: "50%", opacity: 1 },
        ],
        { duration: 420, easing: EASE, fill: "forwards" },
      );
      void animation.finished.then(() => setPage("browse")).catch(() => {});
      return () => animation.cancel();
    }
  }, [currentSong?.picUrl, setPage, transitionPhase]);

  // Closing: collapse the cover back to the player bar cover, then navigate.
  const handleClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setVisualOpen(false);
    setFadedIn(false);
    if (currentSong?.picUrl && readCoverOrigin()) {
      setTransitionPhase("closing");
    } else {
      setPage("browse");
    }
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
    pending: lyricPending,
    rotationRef,
    theme: lyricTheme,
    accent: coverAccent,
    layout: lyricLayout,
    lyricLines,
    progress,
    showTranslation,
    lyricFontSize,
    onSeekLine: (time: number) => seek(time),
  };

  const wallpaperBackground = npWallpaper && wallpaperSrc ? (
    npWallpaper.kind === "video" ? (
      <video
        key={wallpaperSrc}
        className="np-wallpaper"
        src={wallpaperSrc}
        autoPlay
        loop
        muted
        playsInline
      />
    ) : (
      <iframe
        key={wallpaperSrc}
        className="np-wallpaper"
        src={wallpaperSrc}
        title={npWallpaper.title}
        scrolling="no"
      />
    )
  ) : null;

  return (
    <div
      className={`now-playing now-playing-3d ${fadedIn ? "np-scene-ready" : "np-scene-leaving"}`}
    >
      <button
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

      {transitionPhase !== "idle" && currentSong?.picUrl && (
        <img
          ref={transitionCoverRef}
          className="np-shared-cover"
          src={sizedImage(currentSong.picUrl, COVER_IMAGE_SIZE)}
          alt=""
        />
      )}

      <div className="np-stage-3d">
        {/* 反歌词层：位于粒子封面之后，经 Y 轴翻转的镜像画面 */}
        <div className="np-lyrics-3d np-lyrics-back" aria-hidden>
          <Lyrics3D {...lyricsProps} side="back" />
        </div>

        <div className="np-cover-3d">
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
                  effect={particleEffect}
                  grid={QUALITY_GRID[coverQuality]}
                  fpsLimit={npFrameRate}
                  rotationRef={rotationRef}
                  onOverload={() =>
                    usePlayerStore.getState().degradeCoverQuality()
                  }
                />
              </Suspense>
            </CoverErrorBoundary>
          )}
        </div>

        {/* 正歌词层：与封面同一 3D 装配体，悬浮于封面平面之前 */}
        <div className="np-lyrics-3d np-lyrics-front">
          <Lyrics3D {...lyricsProps} side="front" />
        </div>
      </div>

      {wallpaperBackground}
    </div>
  );
}
