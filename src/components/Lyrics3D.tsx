import { useEffect, useRef, useState } from "react";
import type { LyricFx, LyricLayout } from "../store/playerStore";
import { usePlayerStore } from "../store/playerStore";
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
  /** Shared listeners wake this layer only while the cover is being manipulated. */
  motionListenersRef?: { current: Set<() => void> };
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

function activeLyricIndex(lines: LyricLine[], progress: number): number {
  let low = 0;
  let high = lines.length - 1;
  let result = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lines[mid].time <= progress) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return result;
}

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
 *
 * 入场/离场动画作用在外层 .lyric-3d-text 上，效果预设的常驻动画（流光
 * 扫带、霓虹呼吸等）作用在内层 .lyric-fx-core 上：两者分属不同元素，
 * 避免 animation 属性互相覆盖导致换行动画失效、新旧两行叠影。
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
          <span className="lyric-fx-core">{leaving.text}</span>
        </span>
      )}
      <span key={current.id} className="lyric-3d-text is-entering">
        <span className="lyric-fx-core">{current.text}</span>
      </span>
      {showTranslation && translation && (
        <span className="lyric-3d-trans">{translation}</span>
      )}
    </div>
  );
}

/**
 * 多行滚动歌词列表：类似常规播放器的整页歌词，随播放进度自动滚动，
 * 点击任意行跳转播放。当前行同样吃歌词效果预设：行文本的 key 在
 * 成为当前行时变化一次，促使节点重挂载并重放入场动画。
 */
function LyricScrollList({
  lines,
  showTranslation,
  onSeekLine,
}: {
  lines: LyricLine[];
  showTranslation: boolean;
  onSeekLine?: (time: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Subscribe to the derived active line rather than raw progress. This keeps
  // the full lyric list asleep between line changes (often several seconds).
  const activeIndex = usePlayerStore((state) =>
    activeLyricIndex(lines, state.progress),
  );

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
    <div ref={containerRef} className="np-full-lyrics">
      {/* 上下各半窗高的占位，让首尾行也能滚到正中 */}
      <div className="np-full-lyrics-pad" aria-hidden />
      {lines.map((line, index) => {
        // 阶梯下沉：离当前句越远的行，沉得越深、越小、越暗——
        // 从侧面看整个列表呈现向纵深退去的阶梯。
        const dist = Math.min(Math.abs(index - activeIndex), 6);
        const depth = index === activeIndex ? 0 : dist;
        const active = index === activeIndex;
        return (
          <button
            key={`${line.time}-${index}`}
            className={`np-full-lyric${active ? " active" : ""}`}
            style={{
              transform: `translateZ(${-depth * 30}px)`,
              opacity: String(Math.max(0.3, 1 - depth * 0.11)),
            }}
            onClick={() => onSeekLine?.(line.time)}
          >
            <span
              key={active ? `act-${activeIndex}` : `idle-${index}`}
              className={`lyric-3d-text${active ? " is-entering" : ""}`}
            >
              <span className="lyric-fx-core">{line.text}</span>
            </span>
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
  motionListenersRef,
  fx,
  clarity = 60,
  accent,
  layout,
  lyricLines = [],
  showTranslation = false,
  lyricFontSize = 22,
  onSeekLine,
  side = "front",
}: Lyrics3DProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  // 仅在共享旋转/缩放发生变化时唤醒一次。静止时不再保留 rAF 轮询，
  // 避免播放页在没有交互时持续占用主线程；静置摆动仍由 CSS 合成器处理。
  // 背面层在装配旋转之上再绕 Y 翻转 180°，构成"正歌词 -> 粒子封面 ->
  // 反歌词"的双面夹心；正反两层按朝向交叉淡隐——翻到背面时反歌词层
  // 提到封面上方（否则被粒子云挡住完全看不清），正面歌词随之淡出。
  // 静置摆动改为纯 CSS 合成器动画（见 .lyrics-3d-sway-*），不占主线程。
  useEffect(() => {
    let frameId = 0;
    let lastTransformKey = "";
    let lastFacing = "";
    const apply = () => {
      frameId = 0;
      const el = rootRef.current;
      if (!el) return;
      const { x, y } = rotationRef.current;
      const zoom = zoomRef?.current ?? 1;
      const transformKey = `${x.toFixed(4)}|${y.toFixed(4)}|${zoom.toFixed(4)}`;
      if (transformKey !== lastTransformKey) {
        lastTransformKey = transformKey;
        const rotate = `rotateX(${x}rad) rotateY(${y}rad)`;
        const scale = zoom !== 1 ? ` scale(${zoom})` : "";
        el.style.transform =
          side === "back"
            ? `${rotate} translateZ(${-LIFT}px) rotateY(180deg)${scale}`
            : `${rotate} translateZ(${LIFT}px)${scale}`;
      }
      // 朝向系数：装配体正对时 0，翻到背面时 1。
      const facing = (1 - Math.cos(x) * Math.cos(y)) / 2;
      const facingKey = facing.toFixed(3);
      if (facingKey === lastFacing) return;
      lastFacing = facingKey;
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
    const wake = () => {
      if (frameId === 0) frameId = requestAnimationFrame(apply);
    };
    motionListenersRef?.current.add(wake);
    wake();
    return () => {
      motionListenersRef?.current.delete(wake);
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [motionListenersRef, rotationRef, zoomRef, side]);

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
          fontSize: `${lyricFontSize}px`,
        } as React.CSSProperties
      }
    >
      <div className="lyrics-3d-sway-x">
        <div className="lyrics-3d-sway-y">
          {layout === "full" ? (
              <LyricScrollList
                lines={lyricLines}
                showTranslation={showTranslation}
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
      </div>
    </div>
  );
}
