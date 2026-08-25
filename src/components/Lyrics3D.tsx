import { useEffect, useRef, useState } from "react";
import type { LyricTheme } from "../store/playerStore";
import type { CoverAccent } from "../utils/coverAccent";

interface Lyrics3DProps {
  currentLine: string;
  nextLine: string;
  rotation: { x: number; y: number };
  theme: LyricTheme;
  accent: CoverAccent;
}

/** Cross-fade duration in ms. Keep in sync with the CSS animations. */
const SWAP_MS = 420;

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
  style,
}: {
  text: string;
  className: string;
  style?: React.CSSProperties;
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
    <div className={className} style={style}>
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

export default function Lyrics3D({
  currentLine,
  nextLine,
  rotation,
  theme,
  accent,
}: Lyrics3DProps) {
  // The wrapper owns the 3D rotation so the swap animation, which drives the
  // children's own transform, cannot fight with it.
  const transform = `perspective(1000px) rotateX(${rotation.x * 20}rad) rotateY(${rotation.y * 20}rad)`;

  return (
    <div
      className={`lyrics-3d lyrics-theme-${theme}`}
      style={
        {
          "--lyric-accent": accent.color,
          "--lyric-accent-soft": accent.soft,
        } as React.CSSProperties
      }
    >
      <CrossfadeLine
        text={currentLine}
        className="lyrics-3d-current"
        style={{ transform }}
      />
      <CrossfadeLine
        text={nextLine}
        className="lyrics-3d-next"
        style={{ transform }}
      />
    </div>
  );
}
