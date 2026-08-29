import { useEffect, useRef, useState } from "react";
import type { LyricFx, LyricLayout } from "../store/playerStore";
import type { LyricLine } from "../api/types";
import type { CoverAccent } from "../utils/coverAccent";

interface Lyrics3DProps {
  currentLine: string;
  nextLine: string;
  /** 当前句 / 下一句的翻译（showTranslation 开启时展示）。 */
  currentTranslation?: string;
  nextTranslation?: string;
  /** true = 当前还没有唱到的行（前奏/间奏），以上一行待唱样式弱化展示。 */
  pending?: boolean;
  rotationRef: { current: { x: number; y: number } };
  /** 滚轮缩放联动：粒子封面每帧写入的缩放系数（1 = 静息大小）。 */
  zoomRef?: { current: number };
  fx: LyricFx;
  /** 歌词清晰度 0~100：越高彩色辉光越弱、字面越锐利。 */
  clarity?: number;
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
/** 静置摆动的幅度（rad）：让歌词层随时都有立体纵深感。 */
const SWAY_X = 0.05;
const SWAY_Y = 0.07;

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
  translation,
  showTranslation,
  className,
  pending,
}: {
  text: string;
  translation?: string;
  showTranslation?: boolean;
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
      {showTranslation && translation && (
        <span className="lyric-3d-trans">{translation}</span>
      )}
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
      {lines.map((line, index) => {
        // 阶梯下沉：离当前句越远的行，沉得越深、越小、越暗——
        // 从侧面看整个列表呈现向纵深退去的阶梯。
        const dist = Math.min(Math.abs(index - activeIndex), 6);
        const depth = index === activeIndex ? 0 : dist;
        return (
          <button
            key={`${line.time}-${index}`}
            className={`np-full-lyric${index === activeIndex ? " active" : ""}`}
            style={{
              transform: `translateZ(${-depth * 30}px)`,
              opacity: String(Math.max(0.3, 1 - depth * 0.11)),
            }}
            onClick={() => onSeekLine?.(line.time)}
          >
            <span>{line.text}</span>
            {showTranslation && line.translation && (
              <small>{line.translation}</small>
            )}
          </button>
        );
      })}
      <div className="np-full-lyrics-pad" aria-hidden />
    </div>
  );
}

export default function Lyrics3D({
  currentLine,
  nextLine,
  currentTranslation,
  nextTranslation,
  pending = false,
  rotationRef,
  zoomRef,
  fx,
  clarity = 60,
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
  // 叠加缓慢的静置摆动让歌词随时都有 3D 纵深感；正反两层按朝向
  // 交叉淡隐——翻到背面时反歌词层提到封面上方（否则被粒子云挡住
  // 完全看不清），正面歌词随之淡出。
  useEffect(() => {
    let frameId = 0;
    const apply = () => {
      frameId = requestAnimationFrame(apply);
      const el = rootRef.current;
      if (!el) return;
      const { x, y } = rotationRef.current;
      const t = performance.now() / 1000;
      const rx = x + Math.sin(t * 0.45) * SWAY_X;
      const ry = y + Math.cos(t * 0.3) * SWAY_Y;
      const rotate = `rotateX(${rx}rad) rotateY(${ry}rad)`;
      const zoom = zoomRef?.current ?? 1;
      const scale = zoom !== 1 ? ` scale(${zoom})` : "";
      el.style.transform =
        side === "back"
          ? `${rotate} translateZ(${-LIFT}px) rotateY(180deg)${scale}`
          : `${rotate} translateZ(${LIFT}px)${scale}`;
      // 朝向系数：装配体正对时 0，翻到背面时 1。
      const facing = (1 - Math.cos(rx) * Math.cos(ry)) / 2;
      if (side === "front") {
        el.style.opacity = (1 - 0.92 * facing).toFixed(3);
      } else {
        el.style.opacity = (0.5 + 0.5 * facing).toFixed(3);
        el.style.filter = `blur(${(1.2 * (1 - facing)).toFixed(2)}px)`;
        if (el.parentElement) {
          el.parentElement.style.zIndex = facing > 0.5 ? "6" : "0";
        }
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
          // 清晰度 → 彩色辉光强度（越高越锐利）
          "--lyric-glow": String(1 - clarity / 100),
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
          <CrossfadeLine
            text={currentLine}
            translation={currentTranslation}
            showTranslation={showTranslation}
            className="lyrics-3d-current"
            pending={pending}
          />
          <CrossfadeLine
            text={nextLine}
            translation={nextTranslation}
            showTranslation={showTranslation}
            className="lyrics-3d-next"
          />
        </>
      )}
    </div>
  );
}
