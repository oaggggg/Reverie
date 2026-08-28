import { useEffect, useRef, useState } from "react";
import type { LyricLayout, LyricTheme } from "../store/playerStore";
import type { LyricLine } from "../api/types";
import type { CoverAccent } from "../utils/coverAccent";

interface Lyrics3DProps {
  currentLine: string;
  nextLine: string;
  /** true = 当前还没有唱到的行（前奏/间奏），以上一行待唱样式弱化展示。 */
  pending?: boolean;
  rotationRef: { current: { x: number; y: number } };
  theme: LyricTheme;
  accent: CoverAccent;
  layout: LyricLayout;
  /** layout === "full" 时启用滚动歌词列表。 */
  lyricLines?: LyricLine[];
  progress?: number;
  showTranslation?: boolean;
  lyricFontSize?: number;
  onSeekLine?: (time: number) => void;
  /** front = 粒子封面之前；back = 封面之后（镜像的"反歌词"）。 */
  side?: "front" | "back";
}

/** Cross-fade duration in ms. Keep in sync with the CSS animations. */
const SWAP_MS = 420;

/** 歌词平面相对粒子封面平面的悬浮深度（px）。 */
const LIFT = 150;
/** 旋转角度小于该值视为静止，不再写 transform。 */
const EPSILON = 0.0004;

interface Slot {
  text: string;
  id: number;
}

/**
 * One lyric slot.
 *
 * Swapping the text of a single node changes it in one frame, with nothing to
 * transition. Instead the outgoing and incoming lines are both mounted and
 * stacked in the same grid cell, so they cross-fade in place.
 */
function CrossfadeLine({
  text,
  className,
  pending,
}: {
  text: string;
  className: string;
  pending?: boolean;
}) {
  const [current, setCurrent] = useState<Slot>({ text, id: 0 });
  const [leaving, setLeaving] = useState<Slot | null>(null);
  const idRef = useRef(0);
  const lastRef = useRef(text);

  useEffect(() => {
    if (text === lastRef.current) return;
    const outgoing: Slot = { text: lastRef.current, id: idRef.current };
    lastRef.current = text;
    idRef.current += 1;
    setLeaving(outgoing);
    setCurrent({ text, id: idRef.current });
    // Drop the outgoing node once its animation has played out.
    const timer = window.setTimeout(() => setLeaving(null), SWAP_MS);
    return () => window.clearTimeout(timer);
  }, [text]);

  return (
    <div className={`${className}${pending ? " is-pending" : ""}`}>
      {leaving && (
        <span key={leaving.id} className="lyric-3d-text is-leaving">
          {leaving.text}
        </span>
      )}
      <span key={current.id} className="lyric-3d-text is-entering">
        {current.text}
      </span>
    </div>
  );
}

/**
 * 全部歌词滚动列表：类似常规播放器的整页歌词，随播放进度自动滚动，
 * 点击任意行跳转播放。
 */
function LyricScrollList({
  lines,
  progress,
  showTranslation,
  fontSize,
  onSeekLine,
}: {
  lines: LyricLine[];
  progress: number;
  showTranslation: boolean;
  fontSize: number;
  onSeekLine?: (time: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  let activeIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= progress) activeIndex = i;
    else break;
  }

  const activeRef = useRef(-1);
  useEffect(() => {
    if (activeIndex === activeRef.current) return;
    activeRef.current = activeIndex;
    const container = containerRef.current;
    const active = container?.querySelector<HTMLElement>(".np-full-lyric.active");
    if (!container || !active) return;
    container.scrollTo({
      top:
        active.offsetTop -
        container.clientHeight / 2 +
        active.clientHeight / 2,
      behavior: "smooth",
    });
  }, [activeIndex]);

  return (
    <div
      ref={containerRef}
      className="np-full-lyrics"
      style={{ fontSize: `${fontSize}px` }}
    >
      {lines.map((line, index) => (
        <button
          key={`${line.time}-${index}`}
          className={`np-full-lyric${index === activeIndex ? " active" : ""}`}
          onClick={() => onSeekLine?.(line.time)}
        >
          <span>{line.text || "♪"}</span>
          {showTranslation && line.translation && (
            <small>{line.translation}</small>
          )}
        </button>
      ))}
    </div>
  );
}

export default function Lyrics3D({
  currentLine,
  nextLine,
  pending = false,
  rotationRef,
  theme,
  accent,
  layout,
  lyricLines = [],
  progress = 0,
  showTranslation = false,
  lyricFontSize = 22,
  onSeekLine,
  side = "front",
}: Lyrics3DProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  // 逐帧读取共享旋转（拖拽粒子封面时由 ParticleAlbumCover 写入），
  // 直接写 transform，避免逐帧 setState。背面层在装配旋转之上再绕 Y
  // 翻转 180°，构成"正歌词 -> 粒子封面 -> 反歌词"的双面夹心。
  useEffect(() => {
    let frameId = 0;
    let last = { x: NaN, y: NaN };
    const apply = () => {
      frameId = requestAnimationFrame(apply);
      const el = rootRef.current;
      if (!el) return;
      const { x, y } = rotationRef.current;
      if (
        Math.abs(x - last.x) < EPSILON &&
        Math.abs(y - last.y) < EPSILON &&
        !Number.isNaN(last.x)
      ) {
        return;
      }
      last = { x, y };
      const rotate = `rotateX(${x}rad) rotateY(${y}rad)`;
      el.style.transform =
        side === "back"
          ? `${rotate} translateZ(${-LIFT}px) rotateY(180deg)`
          : `${rotate} translateZ(${LIFT}px)`;
    };
    frameId = requestAnimationFrame(apply);
    return () => cancelAnimationFrame(frameId);
  }, [rotationRef, side]);

  return (
    <div
      ref={rootRef}
      className={`lyrics-3d lyrics-theme-${theme}${side === "back" ? " lyrics-3d-back" : ""}`}
      style={
        {
          "--lyric-accent": accent.color,
          "--lyric-accent-soft": accent.soft,
        } as React.CSSProperties
      }
    >
      {layout === "full" ? (
        <LyricScrollList
          lines={lyricLines}
          progress={progress}
          showTranslation={showTranslation}
          fontSize={lyricFontSize}
          onSeekLine={onSeekLine}
        />
      ) : (
        <>
          <CrossfadeLine text={currentLine} className="lyrics-3d-current" pending={pending} />
          <CrossfadeLine text={nextLine} className="lyrics-3d-next" />
        </>
      )}
    </div>
  );
}
