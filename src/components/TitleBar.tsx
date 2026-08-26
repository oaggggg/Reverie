import { useEffect, useState, type CSSProperties } from "react";
import { usePlayerStore } from "../store/playerStore";
import { Copy, Minus, Settings, Square, X } from "lucide-react";
import { captureInteractionOrigin } from "../utils/originTransition";

/** macOS draws its own close/minimize/zoom buttons; only Windows needs ours. */
const isMac =
  typeof window !== "undefined" && window.ncm?.platform === "darwin";

/**
 * 品牌名动效的编排数据：光带从左向右扫过整段字标（一个周期内完成一次），
 * 每个字母的光效与跳动都由 CSS 依据自身序号（--letter-i）推算触发时刻，
 * 波形永远沿 “R → e → v → e → r → i → e” 从左向右传播并无限循环。
 */
const BRAND_LETTERS = Array.from("Reverie");

export default function TitleBar() {
  const [maximized, setMaximized] = useState(false);
  const setShowSettings = usePlayerStore((s) => s.setShowSettings);

  useEffect(() => {
    if (!window.ncm) return;
    window.ncm
      .isMaximized()
      .then(setMaximized)
      .catch(() => {});
    return window.ncm.onMaximized(setMaximized);
  }, []);

  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="titlebar-drag" data-tauri-drag-region />
      <div className="titlebar-name" aria-label="Reverie">
        <span
          className="titlebar-name-text"
          aria-hidden="true"
        >
          {/* 单层字母结构：高光带是每个字母内部的 ::after 渐变切片，
              随字母一同跳动——不存在第二份静止文字，因此不会有重影。
              各字母的光带相位按序号错开，视觉上仍是一道自左向右
              连续扫过的行波。 */}
          <span className="titlebar-letter-layer" aria-hidden="true">
            {BRAND_LETTERS.map((letter, index) => (
              <span
                className="titlebar-letter"
                key={index}
                data-ch={letter}
                style={{ "--letter-i": index } as CSSProperties}
              >
                {letter}
              </span>
            ))}
          </span>
        </span>
      </div>
      <div className="titlebar-controls">
        <button
          className="tb-btn tb-settings"
          onClick={(event) => {
            captureInteractionOrigin("settings", event.currentTarget);
            setShowSettings(true);
          }}
          title="设置"
          aria-label="设置"
        >
          <Settings size={15} />
        </button>
        {!isMac && (
          <>
            <button
              className="tb-btn"
              onClick={() => window.ncm?.minimize()}
              title="最小化"
              aria-label="最小化"
            >
              <Minus size={15} />
            </button>
            <button
              className="tb-btn"
              onClick={() => window.ncm?.maximize()}
              title={maximized ? "还原" : "最大化"}
              aria-label={maximized ? "还原窗口" : "最大化窗口"}
            >
              {maximized ? <Copy size={13} /> : <Square size={13} />}
            </button>
            <button
              className="tb-btn tb-close"
              onClick={() => window.ncm?.close()}
              title="关闭"
              aria-label="关闭"
            >
              <X size={15} />
            </button>
          </>
        )}
      </div>
    </header>
  );
}
