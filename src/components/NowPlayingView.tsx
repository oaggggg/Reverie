import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ChevronDown, Disc3, SlidersHorizontal } from "lucide-react";
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

export default function NowPlayingView() {
  const currentSong = usePlayerStore((s) => s.currentSong);
  const lyricLines = usePlayerStore((s) => s.lyricLines);
  const progress = usePlayerStore((s) => s.progress);
  const setPage = usePlayerStore((s) => s.setPage);
  const ensureLyrics = usePlayerStore((s) => s.ensureLyrics);
  const particleEffect = usePlayerStore((s) => s.particleEffect);
  const lyricTheme = usePlayerStore((s) => s.lyricTheme);
  const coverQuality = usePlayerStore((s) => s.coverQuality);
  const transitionCoverRef = useRef<HTMLImageElement>(null);
  const [fadedIn, setFadedIn] = useState(false);
  const closingRef = useRef(false);
  const [transitionPhase, setTransitionPhase] = useState<
    "opening" | "idle" | "closing"
  >("opening");
  const [visualOpen, setVisualOpen] = useState(false);
  const visualTransition = useOriginTransition<HTMLElement>(
    visualOpen,
    "np-visual",
    220,
  );
  const [currentLyricLine, setCurrentLyricLine] = useState("");
  const [nextLyricLine, setNextLyricLine] = useState("");
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [coverAccent, setCoverAccent] = useState<CoverAccent>({
    color: "#7df9ff",
    soft: "rgba(125, 249, 255, 0.32)",
  });

  useEffect(() => {
    let disposed = false;
    void extractCoverAccent(currentSong?.picUrl ?? "").then((accent) => {
      if (!disposed) setCoverAccent(accent);
    });
    return () => {
      disposed = true;
    };
  }, [currentSong?.picUrl]);

  // A session restored on startup never went through playSong, so its lyrics
  // were never fetched. This view is the only lyric surface, so it has to ask.
  useEffect(() => {
    ensureLyrics();
  }, [ensureLyrics, currentSong?.id]);

  // Parse and update lyrics based on progress
  useEffect(() => {
    if (!lyricLines || !lyricLines.length) {
      setCurrentLyricLine("");
      setNextLyricLine("");
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

    if (currentIndex >= 0) {
      setCurrentLyricLine(lyricLines[currentIndex].text || "♪");
      if (currentIndex + 1 < lyricLines.length) {
        setNextLyricLine(lyricLines[currentIndex + 1].text || "");
      } else {
        setNextLyricLine("");
      }
    } else {
      setCurrentLyricLine("♪");
      setNextLyricLine(lyricLines[0]?.text || "");
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
    const from = {
      left: `${origin.left}px`,
      top: `${origin.top}px`,
      width: `${origin.width}px`,
      height: `${origin.height}px`,
      borderRadius: "50%",
      opacity: 1,
    };
    const center = {
      left: `${targetLeft}px`,
      top: `${targetTop}px`,
      width: `${targetSize}px`,
      height: `${targetSize}px`,
      borderRadius: "28px",
    };

    if (transitionPhase === "opening") {
      setFadedIn(true);
      const animation = cover.animate(
        [
          from,
          { ...center, opacity: 1, offset: 0.78 },
          { ...center, opacity: 0 },
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
          { ...center, opacity: 0 },
          { ...center, opacity: 1, offset: 0.18 },
          from,
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

  // Must keep a stable identity: this view re-renders on every playback tick,
  // and ParticleAlbumCover rebuilds its scene whenever this callback changes.
  const handleDoubleClick = useCallback(() => {
    setRotation({ x: 0, y: 0 });
  }, []);

  const staticCover = currentSong?.picUrl ? (
    <img
      className="np-cover-img"
      src={sizedImage(currentSong.picUrl, COVER_IMAGE_SIZE)}
      alt=""
    />
  ) : (
    <div className="np-cover-ph">
      <Disc3 size={56} />
    </div>
  );

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
        <div className="np-cover-3d">
          {!currentSong?.picUrl ? (
            <div className="np-cover-ph">
              <Disc3 size={56} />
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
                  onOverload={() =>
                    usePlayerStore.getState().degradeCoverQuality()
                  }
                  onDoubleClick={handleDoubleClick}
                />
              </Suspense>
            </CoverErrorBoundary>
          )}
        </div>
        {/* 3D lyrics overlay */}
        <div className="np-lyrics-3d">
          <Lyrics3D
            currentLine={currentLyricLine}
            nextLine={nextLyricLine}
            rotation={rotation}
            theme={lyricTheme}
            accent={coverAccent}
          />
        </div>
      </div>
    </div>
  );
}
