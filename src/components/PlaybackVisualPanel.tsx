import { Gauge, Sparkles, Type, WandSparkles, X } from "lucide-react";
import type { RefObject } from "react";
import { usePlayerStore } from "../store/playerStore";
import type { LyricTheme, ParticleEffect } from "../store/playerStore";
import type { CoverQuality } from "../utils/gpuBenchmark";
import { particleCount, QUALITY_LABEL } from "../utils/gpuBenchmark";

const THEMES: Array<{ id: LyricTheme; name: string; color: string }> = [
  { id: "auto", name: "封面取色", color: "#7df9ff" },
  { id: "default", name: "经典", color: "#ec4141" },
  { id: "neon", name: "霓虹", color: "#7df9ff" },
  { id: "fire", name: "火焰", color: "#ffd166" },
  { id: "aurora", name: "极光", color: "#a78bfa" },
  { id: "mint", name: "薄荷", color: "#6ee7b7" },
  { id: "rose", name: "玫瑰", color: "#fb7185" },
  { id: "pure", name: "纯净", color: "#ffffff" },
];

const COVER_QUALITIES: CoverQuality[] = [
  "image",
  "low",
  "medium",
  "high",
  "ultra",
];

const PARTICLE_EFFECTS: Array<{ id: ParticleEffect; name: string }> = [
  { id: "none", name: "静止" },
  { id: "spin", name: "自转" },
  { id: "wave", name: "波动" },
  { id: "audio", name: "律动" },
  { id: "orbit", name: "环绕" },
  { id: "ripple", name: "涟漪" },
  { id: "shimmer", name: "闪烁" },
];

export default function PlaybackVisualPanel({
  surfaceRef,
  transitionClassName,
  onClose,
}: {
  surfaceRef: RefObject<HTMLElement | null>;
  transitionClassName: string;
  onClose: () => void;
}) {
  const lyricTheme = usePlayerStore((s) => s.lyricTheme);
  const setLyricTheme = usePlayerStore((s) => s.setLyricTheme);
  const lyricFontSize = usePlayerStore((s) => s.lyricFontSize);
  const setLyricFontSize = usePlayerStore((s) => s.setLyricFontSize);
  const showTranslation = usePlayerStore((s) => s.showTranslation);
  const setShowTranslation = usePlayerStore((s) => s.setShowTranslation);
  const coverQuality = usePlayerStore((s) => s.coverQuality);
  const setCoverQuality = usePlayerStore((s) => s.setCoverQuality);
  const particleEffect = usePlayerStore((s) => s.particleEffect);
  const setParticleEffect = usePlayerStore((s) => s.setParticleEffect);
  const coverBenchmarking = usePlayerStore((s) => s.coverBenchmarking);
  const detectCoverQuality = usePlayerStore((s) => s.detectCoverQuality);
  const applyDiyPreset = usePlayerStore((s) => s.applyDiyPreset);

  return (
    <aside
      ref={surfaceRef}
      className={`np-visual-panel ${transitionClassName}`}
    >
      <header>
        <div>
          <Sparkles size={17} />
          <strong>DIY</strong>
        </div>
        <button className="icon-btn" onClick={onClose} title="关闭">
          <X size={17} />
        </button>
      </header>

      <div className="np-visual-scroll">
        <section>
          <h3>
            <Type size={14} /> 歌词
          </h3>
          <div className="np-visual-row stacked">
            <span>歌词预设</span>
            <div className="theme-swatches">
              {THEMES.map((item) => (
                <button
                  key={item.id}
                  className={`theme-swatch ${lyricTheme === item.id ? "active" : ""}`}
                  onClick={() => setLyricTheme(item.id)}
                  title={item.name}
                >
                  <i style={{ background: item.color }} />
                  <span>{item.name}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="np-visual-row">
            <span>
              字号 <small>{lyricFontSize}</small>
            </span>
            <input
              className="slider settings-slider"
              type="range"
              min={14}
              max={40}
              value={lyricFontSize}
              style={{
                ["--val" as never]: `${((lyricFontSize - 14) / 26) * 100}%`,
              }}
              onChange={(event) => setLyricFontSize(Number(event.target.value))}
            />
          </div>
          <div className="np-visual-row diy-note">
            <span>
              <WandSparkles size={13} />{" "}
              自动取色会根据当前专辑封面选择高对比歌词颜色
            </span>
          </div>
          <div className="np-visual-row">
            <span>显示翻译</span>
            <button
              className={`setting-switch ${showTranslation ? "active" : ""}`}
              role="switch"
              aria-checked={showTranslation}
              onClick={() => setShowTranslation(!showTranslation)}
            >
              <span />
            </button>
          </div>
        </section>

        <section>
          <h3>
            <Gauge size={14} /> 动态封面
          </h3>
          <div className="np-visual-row stacked">
            <span>
              画质
              <small>
                {coverQuality === "image"
                  ? "静态图"
                  : `${particleCount(coverQuality).toLocaleString()} 粒子`}
              </small>
            </span>
            <div className="opt-group">
              {COVER_QUALITIES.map((quality) => (
                <button
                  key={quality}
                  className={`opt-btn ${coverQuality === quality ? "active" : ""}`}
                  onClick={() => setCoverQuality(quality, "手动设置")}
                >
                  {QUALITY_LABEL[quality]}
                </button>
              ))}
            </div>
          </div>
          <div className="np-visual-row stacked">
            <span>粒子效果</span>
            <div className="opt-group">
              {PARTICLE_EFFECTS.map((item) => (
                <button
                  key={item.id}
                  className={`opt-btn ${particleEffect === item.id ? "active" : ""}`}
                  disabled={coverQuality === "image"}
                  onClick={() => setParticleEffect(item.id)}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>
          <button
            className="btn np-detect-btn"
            onClick={() => void detectCoverQuality(true)}
            disabled={coverBenchmarking}
          >
            {coverBenchmarking ? "检测中…" : "自动检测性能"}
          </button>
          <button
            className="btn np-pure-btn"
            onClick={() => applyDiyPreset("pure")}
          >
            <Sparkles size={14} /> 使用纯净预设
          </button>
        </section>
      </div>
    </aside>
  );
}
