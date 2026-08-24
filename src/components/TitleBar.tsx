import { useEffect, useState } from "react";
import { usePlayerStore } from "../store/playerStore";
import { Copy, Minus, Settings, Square, X } from "lucide-react";
import { captureInteractionOrigin } from "../utils/originTransition";

/** macOS draws its own close/minimize/zoom buttons; only Windows needs ours. */
const isMac =
  typeof window !== "undefined" && window.ncm?.platform === "darwin";

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
          data-text="Reverie"
          aria-hidden="true"
        >
          <span className="titlebar-letter-layer" aria-hidden="true">
            {Array.from("Reverie").map((letter, index) => (
              <span className="titlebar-letter" key={index}>
                {letter}
              </span>
            ))}
          </span>
          <span className="titlebar-sheen-layer" aria-hidden="true">
            {Array.from("Reverie").map((letter, index) => (
              <span className="titlebar-sheen-letter" key={index}>
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
