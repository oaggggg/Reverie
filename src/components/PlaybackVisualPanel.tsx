import { useEffect, type RefObject } from "react";
import { BookOpen, Gauge, Sparkles, Type, X } from "lucide-react";
import { usePlayerStore } from "../store/playerStore";
import { useSongMetadataStore } from "../store/songMetadataStore.ts";
import type { ParticleEffect } from "../store/playerStore";
import type { CoverQuality } from "../utils/gpuBenchmark";
import { particleCount, QUALITY_LABEL } from "../utils/gpuBenchmark";

const THEMES = [
  { id: "default", name: "经典", color: "#ec4141" },
  { id: "neon", name: "霓虹", color: "#7df9ff" },
  { id: "fire", name: "火焰", color: "#ffd166" },
  { id: "aurora", name: "极光", color: "#a78bfa" },
  { id: "mint", name: "薄荷", color: "#6ee7b7" },
  { id: "rose", name: "玫瑰", color: "#fb7185" },
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
  const currentSong = usePlayerStore((s) => s.currentSong);
  const songMetadata = useSongMetadataStore((s) => s.metadata);
  const metadataLoading = useSongMetadataStore((s) => s.loading);
  const loadSongMetadata = useSongMetadataStore((s) => s.load);
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

  useEffect(() => {
    if (currentSong?.id) void loadSongMetadata(currentSong.id);
  }, [currentSong?.id, loadSongMetadata]);

  return (
    <aside ref={surfaceRef} className={`np-visual-panel ${transitionClassName}`}>
      <header>
        <div>
          <Sparkles size={17} />
          <strong>歌词与封面</strong>
        </div>
        <button className="icon-btn" onClick={onClose} title="关闭">
          <X size={17} />
        </button>
      </header>

      <div className="np-visual-scroll">
        <section>
          <h3>
            <BookOpen size={14} /> 歌曲信息
          </h3>
          {metadataLoading ? (
            <div className="metadata-loading">正在加载百科信息…</div>
          ) : songMetadata ? (
            <div className="song-metadata-copy">
              {songMetadata.summary && <p>{songMetadata.summary}</p>}
              {songMetadata.creators.length > 0 && (
                <div>
                  <strong>创作者</strong>
                  <span>
                    {songMetadata.creators
                      .map(
                        (item) =>
                          `${item.name}${item.role ? `（${item.role}）` : ""}`,
                      )
                      .join("、")}
                  </span>
                </div>
              )}
              {songMetadata.chorus.length > 0 && (
                <div>
                  <strong>副歌</strong>
                  <span>
                    {songMetadata.chorus
                      .map(
                        (item) =>
                          `${Math.round(item.start / 1000)}s-${Math.round(item.end / 1000)}s`,
                      )
                      .join("、")}
                  </span>
                </div>
              )}
              {songMetadata.musicDetail && (
                <div>
                  <strong>音质</strong>
                  <span>
                    {[songMetadata.musicDetail.level, songMetadata.musicDetail.format]
                      .filter(Boolean)
                      .join(" · ") || "标准音质"}
                    {songMetadata.musicDetail.bitrate > 0 &&
                      ` · ${Math.round(songMetadata.musicDetail.bitrate / 1000)} kbps`}
                  </span>
                </div>
              )}
              {songMetadata.redCount !== undefined && (
                <div>
                  <strong>红心</strong>
                  <span>{songMetadata.redCount.toLocaleString("zh-CN")} 次</span>
                </div>
              )}
            </div>
          ) : (
            <div className="metadata-loading">暂无百科信息</div>
          )}
        </section>
        <section>
          <h3>
            <Type size={14} /> 歌词
          </h3>
          <div className="np-visual-row stacked">
            <span>特效主题</span>
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
        </section>
      </div>
    </aside>
  );
}
