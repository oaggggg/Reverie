import { useEffect, useRef, useState } from "react";
import type { LyricFx, LyricLayout } from "../store/playerStore";
import type { LyricLine } from "../api/types";
import type { CoverAccent } from "../utils/coverAccent";

interface Lyrics3DProps {
  currentLine: string;
  nextLine: string;
  /** true = 当前还没有唱到的行（前奏/间奏），以上一行待唱样式弱化展示。 */
  pending?: boolean;
  rotationRef: { current: { x: number; y: number } };
  /** 滚轮缩放联动：粒子封面每帧写入的缩放系数（1 = 静息大小）。 */
  zoomRef?: { current: number };
  fx: LyricFx;
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

/** 反歌词静息时的弱化不透明度（正对封面时）。 */
const BACK_BASE_OPACITY = 0.42;
/** 反歌词静息时的模糊半径（px）。 */
const BACK_BASE_BLUR = 1.2;

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
 * 多行滚动歌词列表：类似常规播放器的整页歌词，随播放进度自动滚动，
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
      {/* 上下各半窗高的占位，让首尾行也能滚到正中 */}
      <div className="np-full-lyrics-pad" aria-hidden />
      {lines.map((line, index) => (
        <button
          key={`${line.time}-${index}`}
          className={`np-full-lyric${index === activeIndex ? " active" : ""}`}
          onClick={() => onSeekLine?.(line.time)}
        >
          <span>{line.text}</span>
          {showTranslation && line.translation && (
            <small>{line.translation}</small>
          )}
        </button>
      ))}
      <div className="np-full-lyrics-pad" aria-hidden />
    </div>
  );
}

export default function Lyrics3D({
  currentLine,
  nextLine,
  pending = false,
  rotationRef,
  zoomRef,
  fx,
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

  // 逐帧读取共享旋转与缩放（拖拽/滚轮时由 ParticleAlbumCover 写入），
  // 直接写 transform，避免逐帧 setState。背面层在装配旋转之上再绕 Y
  // 翻转 180°，构成"正歌词 -> 粒子封面 -> 反歌词"的双面夹心。
  // 反歌词的不透明度与模糊随朝向渐变：正对封面时弱化如隔着粒子云，
  // 整体翻到背面时变为全清晰，解决反面歌词看不清的问题。
  useEffect(() => {
    let frameId = 0;
    let last = { x: NaN, y: NaN, zoom: NaN };
    const apply = () => {
      frameId = requestAnimationFrame(apply);
      const el = rootRef.current;
      if (!el) return;
      const { x, y } = rotationRef.current;
      const zoom = zoomRef?.current ?? 1;
      if (
        Math.abs(x - last.x) < EPSILON &&
        Math.abs(y - last.y) < EPSILON &&
        Math.abs(zoom - last.zoom) < 0.001 &&
        !Number.isNaN(last.x)
      ) {
        return;
      }
      last = { x, y, zoom };
      const rotate = `rotateX(${x}rad) rotateY(${y}rad)`;
      const scale = zoom !== 1 ? ` scale(${zoom})` : "";
      el.style.transform =
        side === "back"
          ? `${rotate} translateZ(${-LIFT}px) rotateY(180deg)${scale}`
          : `${rotate} translateZ(${LIFT}px)${scale}`;
      if (side === "back") {
        // 朝向系数：装配体正对时 0（弱化），翻到背面时 1（全清晰）。
        const facing = (1 - Math.cos(x) * Math.cos(y)) / 2;
        el.style.opacity = String(BACK_BASE_OPACITY + 0.54 * facing);
        el.style.filter = `blur(${(BACK_BASE_BLUR * (1 - facing)).toFixed(2)}px)`;
      }
    };
    frameId = requestAnimationFrame(apply);
    return () => cancelAnimationFrame(frameId);
  }, [rotationRef, zoomRef, side]);

  return (
    <div
      ref={rootRef}
      className={`lyrics-3d lyrics-fx-${fx}${side === "back" ? " lyrics-3d-back" : ""}`}
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
