import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ImagePlay, Music4, X } from "lucide-react";
import { usePlayerStore } from "../store/playerStore";
import type { NpWallpaper } from "../store/playerStore";

/** Rust 侧 list_wallpaper_engine_wallpapers 返回的条目（仅 mp4 视频壁纸）。 */
interface WallpaperEngineItem {
  id: string;
  title: string;
  kind: "video";
  path: string;
  preview: string;
}

/** Wallpaper 壁纸选择弹窗：卡片网格展示创意工坊视频壁纸，点击即应用。 */
export default function WallpaperPickerModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const npWallpaper = usePlayerStore((s) => s.npWallpaper);
  const setNpWallpaper = usePlayerStore((s) => s.setNpWallpaper);
  // null = 扫描中；[] = 扫描完成但没有可用的 mp4 视频壁纸
  const [items, setItems] = useState<WallpaperEngineItem[] | null>(null);
  const [error, setError] = useState("");

  // 打开时扫描 Wallpaper Engine 工坊库，仅桌面版可用。
  useEffect(() => {
    let disposed = false;
    void (async () => {
      try {
        const { invoke, convertFileSrc } = await import("@tauri-apps/api/core");
        const list = await invoke<WallpaperEngineItem[]>(
          "list_wallpaper_engine_wallpapers",
        );
        if (disposed) return;
        setItems(
          list.map((item) => ({
            ...item,
            preview: item.preview ? convertFileSrc(item.preview) : "",
          })),
        );
      } catch {
        if (!disposed) setError("未找到 Wallpaper Engine（仅桌面版支持）");
      }
    })();
    return () => {
      disposed = true;
    };
  }, []);

  // Escape 关闭。
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const select = (item: WallpaperEngineItem | null) => {
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
    onClose();
  };

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal wp-picker-modal"
        role="dialog"
        aria-modal="true"
        aria-label="选择 Wallpaper 壁纸"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="notification-modal-head">
          <h2>Wallpaper 壁纸</h2>
          <span className="notification-modal-sub">
            来自 Wallpaper Engine 的视频壁纸
          </span>
          <div className="notification-modal-actions">
            <button className="topnav-icon-btn" title="关闭" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </header>
        <div className="wp-picker-body">
          {error && <div className="empty">{error}</div>}
          {!error && items === null && (
            <div className="empty">正在扫描壁纸库…</div>
          )}
          {!error && items !== null && !items.length && (
            <div className="empty">
              未找到可用的壁纸（需安装 Wallpaper Engine 的 mp4 视频壁纸）
            </div>
          )}
          {!error && items !== null && items.length > 0 && (
            <div className="wp-picker-grid">
              <button
                className={`wp-picker-card ${npWallpaper === null ? "active" : ""}`}
                onClick={() => select(null)}
                title="不使用壁纸"
              >
                <span className="wp-picker-thumb">
                  <Music4 size={22} />
                </span>
                <span className="wp-picker-meta">
                  <span className="wp-picker-name">不使用壁纸</span>
                  <small>恢复粒子封面背景</small>
                </span>
              </button>
              {items.map((item) => (
                <button
                  key={item.id}
                  className={`wp-picker-card ${npWallpaper?.id === item.id ? "active" : ""}`}
                  onClick={() => select(item)}
                  title={item.title}
                >
                  <span className="wp-picker-thumb">
                    {item.preview ? (
                      <img src={item.preview} alt="" loading="lazy" />
                    ) : (
                      <ImagePlay size={22} />
                    )}
                  </span>
                  <span className="wp-picker-meta">
                    <span className="wp-picker-name">{item.title}</span>
                    <small>视频</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
