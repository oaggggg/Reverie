import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Song } from "../api/types";
import { usePlayerStore } from "../store/playerStore";
import { sizedImage } from "../utils/image";
import { Disc3, ThumbsDown } from "lucide-react";
import { LoadingState } from "./Page";

interface SongContextMenu {
  song: Song;
  x: number;
  y: number;
}

export default function SongCards({
  songs,
  loading = false,
  onDislike,
}: {
  songs: Song[];
  loading?: boolean;
  onDislike?: (song: Song) => void;
}) {
  const playSong = usePlayerStore((s) => s.playSong);
  const [dismissing, setDismissing] = useState<number[]>([]);
  const [contextMenu, setContextMenu] = useState<SongContextMenu | null>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [contextMenu]);

  const dismiss = (song: Song) => {
    setContextMenu(null);
    setDismissing((current) => [...current, song.id]);
    window.setTimeout(() => onDislike?.(song), 220);
  };

  if (!songs.length && loading) return <LoadingState label="正在加载推荐…" />;
  if (!songs.length) return <div className="empty">暂无推荐</div>;
  return (
    <>
      <div className="song-cards">
        {songs.map((song) => {
          const isDismissing = dismissing.includes(song.id);
          return (
            <article
              key={song.id}
              className={`song-card ${isDismissing ? "dismissing" : ""}`}
              onClick={() => playSong(song, songs)}
              onContextMenu={(event) => {
                if (!onDislike) return;
                event.preventDefault();
                setContextMenu({
                  song,
                  x: Math.max(8, Math.min(event.clientX, window.innerWidth - 142)),
                  y: Math.max(8, Math.min(event.clientY, window.innerHeight - 48)),
                });
              }}
            >
              <div className="card-cover">
                {song.picUrl ? (
                  <img
                    src={sizedImage(song.picUrl, 320)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className="song-card-ph">
                    <Disc3 size={24} />
                  </span>
                )}
              </div>
              <div className="n">{song.name}</div>
              <div className="a">{song.artists}</div>
            </article>
          );
        })}
      </div>
      {contextMenu &&
        createPortal(
          <div
            className="song-card-context-menu"
            role="menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button role="menuitem" onClick={() => dismiss(contextMenu.song)}>
              <ThumbsDown size={14} />
              <span>不感兴趣</span>
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
