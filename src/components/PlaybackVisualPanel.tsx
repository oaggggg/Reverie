import { useEffect, useState } from "react";
import type { RefObject } from "react";
import { Image as ImageIcon, Moon, Music4, Sparkles } from "lucide-react";
import { X } from "lucide-react";
import { usePlayerStore } from "../store/playerStore";
import type { LyricFx, NpWallpaper, ParticleEffect } from "../store/playerStore";
import type { CoverQuality } from "../utils/gpuBenchmark";
import { particleCount, QUALITY_LABEL } from "../utils/gpuBenchmark";

/** Rust 侧 list_wallpaper_engine_wallpapers 返回的条目（仅 mp4 视频壁纸）。 */
interface WallpaperEngineItem {
  id: string;
  title: string;
  kind: "video";
  path: string;
  preview: string;
}

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

/** 3D 歌词动效预设（与颜色无关；颜色始终自动取自背景）。 */
const LYRIC_FX: Array<{ id: LyricFx; name: string }> = [
  { id: "stair", name: "阶梯" },
  { id: "fade", name: "淡入" },
  { id: "bounce", name: "弹入" },
  { id: "flip", name: "翻入" },
  { id: "blur", name: "模糊滑入" },
];

type VisualTab = "background" | "lyrics";

/** 画质卡片副标签用的粒子数短格式：57,600 → 5.8万。 */
function shortParticleCount(quality: CoverQuality): string {
  if (quality === "image") return "静态";
  const n = particleCount(quality);
  return n >= 10000
    ? `${(n / 10000).toFixed(1).replace(/\.0$/, "")}万`
    : String(n);
}

export default function PlaybackVisualPanel({
  surfaceRef,
  transitionClassName,
  onClose,
}: {
  surfaceRef: RefObject<HTMLElement | null>;
  transitionClassName: string;
  onClose: () => void;
}) {
  const lyricFx = usePlayerStore((s) => s.lyricFx);
  const setLyricFx = usePlayerStore((s) => s.setLyricFx);
  const lyricFontSize = usePlayerStore((s) => s.lyricFontSize);
  const setLyricFontSize = usePlayerStore((s) => s.setLyricFontSize);
  const lyricLayout = usePlayerStore((s) => s.lyricLayout);
  const setLyricLayout = usePlayerStore((s) => s.setLyricLayout);
  const npFrameRate = usePlayerStore((s) => s.npFrameRate);
  const setNpFrameRate = usePlayerStore((s) => s.setNpFrameRate);
  const npWallpaper = usePlayerStore((s) => s.npWallpaper);
  const setNpWallpaper = usePlayerStore((s) => s.setNpWallpaper);
  const showTranslation = usePlayerStore((s) => s.showTranslation);
  const setShowTranslation = usePlayerStore((s) => s.setShowTranslation);
  const coverQuality = usePlayerStore((s) => s.coverQuality);
  const setCoverQuality = usePlayerStore((s) => s.setCoverQuality);
  const particleEffect = usePlayerStore((s) => s.particleEffect);
  const setParticleEffect = usePlayerStore((s) => s.setParticleEffect);
  const coverBenchmarking = usePlayerStore((s) => s.coverBenchmarking);
  const detectCoverQuality = usePlayerStore((s) => s.detectCoverQuality);
  const applyDiyPreset = usePlayerStore((s) => s.applyDiyPreset);
  const npVoid = usePlayerStore((s) => s.npVoid);
  // 退出虚空：恢复封面显示；虚空预设会把画质降到静态图，这里一并
  // 升回高画质，保证粒子封面立即可用。
  const exitVoid = () => {
    const state = usePlayerStore.getState();
    state.setNpVoid(false);
    if (state.coverQuality === "image") {
      state.setCoverQuality("high", "退出虚空");
    }
  };

  const [tab, setTab] = useState<VisualTab>("background");

  // Wallpaper Engine 壁纸扫描：面板打开时扫一次，仅桌面版可用。
  // null = 扫描中；[] = 扫描完成但没有可用的 mp4 视频壁纸
  const [wallpapers, setWallpapers] = useState<WallpaperEngineItem[] | null>(
    null,
  );
  const [wallpaperError, setWallpaperError] = useState("");
  useEffect(() => {
    let disposed = false;
    void (async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const { convertFileSrc } = await import("@tauri-apps/api/core");
        const list = await invoke<WallpaperEngineItem[]>(
          "list_wallpaper_engine_wallpapers",
        );
        if (disposed) return;
        setWallpapers(
          list.map((item) => ({
            ...item,
            preview: item.preview ? convertFileSrc(item.preview) : "",
          })),
        );
      } catch {
        if (!disposed) setWallpaperError("未找到 Wallpaper Engine（仅桌面版支持）");
      }
    })();
    return () => {
      disposed = true;
    };
  }, []);

  const selectWallpaper = (item: WallpaperEngineItem | null) => {
    const wallpaper: NpWallpaper | null = item
      ? {
          id: item.id,
          title: item.title,
          kind: "video",
          path: item.path,
          preview: item.preview || undefined,
        }
      : null;
    setNpWallpaper(wallpaper);
  };

  return (
    <aside
      ref={surfaceRef}
      className={`np-visual-panel ${transitionClassName}`}
    >
      <header>
        <strong>DIY</strong>
        <button
          className="np-visual-close"
          onClick={onClose}
          title="关闭"
          aria-label="关闭"
        >
          <X size={15} />
        </button>
      </header>

      <nav className="np-visual-tabs">
        <button
          className={tab === "background" ? "active" : ""}
          onClick={() => setTab("background")}
        >
          动态背景
        </button>
        <button
          className={tab === "lyrics" ? "active" : ""}
          onClick={() => setTab("lyrics")}
        >
          歌词
        </button>
      </nav>

      <div className="np-visual-scroll">
        {tab === "lyrics" ? (
          <section>
            <div className="np-visual-row stacked">
              <span>歌词动效</span>
              <div className="opt-group">
                {LYRIC_FX.map((item) => (
                  <button
                    key={item.id}
                    className={`opt-btn ${lyricFx === item.id ? "active" : ""}`}
                    onClick={() => setLyricFx(item.id)}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="np-visual-row">
              <span>歌词布局</span>
              <div className="opt-group">
                <button
                  className={`opt-btn ${lyricLayout === "dual" ? "active" : ""}`}
                  onClick={() => setLyricLayout("dual")}
                >
                  两行
                </button>
                <button
                  className={`opt-btn ${lyricLayout === "full" ? "active" : ""}`}
                  onClick={() => setLyricLayout("full")}
                >
                  多行
                </button>
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
            <div className="np-visual-row diy-note">
              <span>歌词颜色自动取自当前背景（壁纸或专辑封面），无需手动选择</span>
            </div>
          </section>
        ) : (
          <>
            <section>
              <h3>动态封面</h3>
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
                      <small>{shortParticleCount(quality)}</small>
                    </button>
                  ))}
                </div>
              </div>
              <div className="np-visual-row">
                <span>帧率</span>
                <div className="opt-group">
                  {[
                    { value: 0, label: "无限" },
                    { value: 120, label: "120" },
                    { value: 60, label: "60" },
                    { value: 30, label: "30" },
                  ].map((item) => (
                    <button
                      key={item.value}
                      className={`opt-btn ${npFrameRate === item.value ? "active" : ""}`}
                      onClick={() => setNpFrameRate(item.value)}
                    >
                      {item.label}
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
              {/* 封面模式卡片：与壁纸卡片同款样式 */}
              <div className="np-mode-cards">
                <button
                  className={`np-wallpaper-item ${!npVoid ? "active" : ""}`}
                  onClick={exitVoid}
                >
                  <span className="np-wallpaper-thumb">
                    <Sparkles size={22} />
                  </span>
                  <span className="np-wallpaper-title">
                    <span className="np-wallpaper-name">3D 粒子封面</span>
                    <small>封面粒子化 · 支持旋转缩放</small>
                  </span>
                </button>
                <button
                  className={`np-wallpaper-item ${npVoid ? "active" : ""}`}
                  onClick={() => applyDiyPreset("void")}
                >
                  <span className="np-wallpaper-thumb">
                    <Moon size={22} />
                  </span>
                  <span className="np-wallpaper-title">
                    <span className="np-wallpaper-name">虚空预设</span>
                    <small>隐藏封面 · 只留歌词</small>
                  </span>
                </button>
              </div>
            </section>

            <section>
              <h3>Wallpaper 壁纸</h3>
              <div className="np-visual-row stacked">
                <span>
                  播放页背景
                  <small>Wallpaper Engine（mp4 视频壁纸）</small>
                </span>
                <div className="np-wallpaper-list">
                  <button
                    className={`np-wallpaper-item ${npWallpaper === null ? "active" : ""}`}
                    onClick={() => selectWallpaper(null)}
                  >
                    <span className="np-wallpaper-thumb np-wallpaper-thumb-off">
                      <Music4 size={14} />
                    </span>
                    <span className="np-wallpaper-title">
                      <span className="np-wallpaper-name">不使用壁纸</span>
                    </span>
                  </button>
                  {wallpapers?.map((item) => (
                    <button
                      key={item.id}
                      className={`np-wallpaper-item ${npWallpaper?.id === item.id ? "active" : ""}`}
                      onClick={() => selectWallpaper(item)}
                    >
                      <span className="np-wallpaper-thumb">
                        {item.preview ? (
                          <img src={item.preview} alt="" loading="lazy" />
                        ) : (
                          <ImageIcon size={14} />
                        )}
                      </span>
                      <span className="np-wallpaper-title">
                        <span className="np-wallpaper-name">{item.title}</span>
                        <small>视频</small>
                      </span>
                    </button>
                  ))}
                  {wallpaperError && (
                    <div className="np-wallpaper-empty">{wallpaperError}</div>
                  )}
                  {!wallpaperError && wallpapers !== null && !wallpapers.length && (
                    <div className="np-wallpaper-empty">
                      未找到可用的壁纸（需安装 Wallpaper Engine 的 mp4 视频壁纸）
                    </div>
                  )}
                  {!wallpaperError && wallpapers === null && (
                    <div className="np-wallpaper-empty">正在扫描壁纸库…</div>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </aside>
  );
}
