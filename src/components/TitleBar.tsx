import { useEffect, useState, type CSSProperties } from "react";
import { usePlayerStore } from "../store/playerStore";
import { Copy, Minus, Settings, Square, X } from "lucide-react";
import { captureInteractionOrigin } from "../utils/originTransition";

/** macOS draws its own close/minimize/zoom buttons; only Windows needs ours. */
const isMac =
  typeof window !== "undefined" && window.ncm?.platform === "darwin";

/**
 * 品牌名动效的编排数据：光带从左向右扫过整段字标（一个周期内完成一次），
 * 波形永远沿 “R → e → v → e → r → i → e” 从左向右传播并无限循环。
 */
const BRAND_LETTERS = Array.from("Reverie");

/** 与 CSS 编排参数保持一致（.titlebar-name-text）。 */
const BRAND_CYCLE_S = 7.2;
const SWEEP_END = 0.66;
/** 单次跳跃的上升段占周期的比例（CSS 触发公式中的常数）。 */
const RISE_FRACTION = 0.032;
/** 光斑峰值相对其行程段起点的偏移比例：position 150%→-60% 线性推进，
 *  亮峰（50% 刻度）出现在行程段的 (150-50)/(150+60)=47.6% 处 ≈ 0.314 周期。 */
const SHEEN_PEAK_OFFSET = 0.314;

/**
 * 每个字母在整词中的归一化中心位置：按 800 字重的近似字宽
 * （R≈0.72 e≈0.60 v≈0.60 r≈0.45 i≈0.30 em）加 0.2em 字距累加求出，
 * 用于把跳动/光效相位与真实字形几何对齐——旧的均匀分布假设会让
 * 宽窄不一的字母起跳时刻偏离光带实际到达时刻，看起来「不同步」。
 */
const LETTER_CENTERS = [0.068, 0.231, 0.383, 0.535, 0.673, 0.782, 0.895];

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
              每个字母的跳动/光效延迟按其在整词中的真实几何位置
              （LETTER_CENTERS）推算后以内联变量传入，光带经过哪个
              字母，那个字母就恰好在那一刻起跳。 */}
          <span className="titlebar-letter-layer" aria-hidden="true">
            {BRAND_LETTERS.map((letter, index) => {
              const center = LETTER_CENTERS[index] ?? (index + 0.5) / BRAND_LETTERS.length;
              return (
                <span
                  className="titlebar-letter"
                  key={index}
                  data-ch={letter}
                  style={
                    {
                      "--bounce-delay": `${(
                        (center * SWEEP_END - RISE_FRACTION) *
                        BRAND_CYCLE_S
                      ).toFixed(3)}s`,
                      "--sheen-delay": `${(
                        (center * SWEEP_END - SHEEN_PEAK_OFFSET) *
                        BRAND_CYCLE_S
                      ).toFixed(3)}s`,
                    } as CSSProperties
                  }
                >
                  {letter}
                </span>
              );
            })}
          </span>
          <span className="titlebar-sweep" aria-hidden="true">Reverie</span>
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
