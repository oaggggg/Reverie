import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Song } from "../api/types";
import { usePlayerStore } from "../store/playerStore";
import { sizedImage } from "../utils/image";
import { Disc3, ThumbsDown } from "lucide-react";
import { LoadingState } from "./Page";
import {
  capturePointerOrigin,
  useOriginTransition,
} from "../utils/originTransition";

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
  const [entering, setEntering] = useState<number[]>([]);
  const previousSongIds = useRef<Set<number> | null>(null);
  const [contextMenu, setContextMenu] = useState<SongContextMenu | null>(null);
  const [lastContextMenu, setLastContextMenu] =
    useState<SongContextMenu | null>(null);
  const [contextSongId, setContextSongId] = useState<number | null>(null);
  const contextTransition = useOriginTransition<HTMLDivElement>(
    Boolean(contextMenu),
    "song-context-menu",
    150,
  );

  useEffect(() => {
    const currentIds = new Set(songs.map((song) => song.id));
    const previousIds = previousSongIds.current;
    previousSongIds.current = currentIds;

    if (!previousIds) return;
    const addedIds = songs
      .map((song) => song.id)
      .filter((id) => !previousIds.has(id));
    if (!addedIds.length) return;

    setEntering((current) => [...new Set([...current, ...addedIds])]);
    const timer = window.setTimeout(() => {
      setEntering((current) => current.filter((id) => !addedIds.includes(id)));
    }, 320);
    return () => window.clearTimeout(timer);
  }, [songs]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => {
      setContextMenu(null);
      setContextSongId(null);
    };
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

  const dismissTimers = useRef<number[]>([]);
  useEffect(
    () => () => {
      for (const timer of dismissTimers.current) window.clearTimeout(timer);
      dismissTimers.current = [];
    },
    [],
  );

  const dismiss = (song: Song) => {
    if (dismissing.includes(song.id)) return;
    setContextMenu(null);
    setContextSongId(null);
    setDismissing((current) => [...current, song.id]);
    const timer = window.setTimeout(() => onDislike?.(song), 220);
    dismissTimers.current.push(timer);
  };

  if (!songs.length && loading) return <LoadingState label="正在加载推荐…" />;
  if (!songs.length) return <div className="empty">暂无推荐</div>;
  return (
    <>
      <div className="song-cards">
        {songs.map((song) => {
          const isDismissing = dismissing.includes(song.id);
          const isEntering = entering.includes(song.id);
          return (
            <article
              key={song.id}
              className={`song-card ${isDismissing ? "dismissing" : ""} ${isEntering ? "entering" : ""} ${contextSongId === song.id ? "context-active" : ""}`}
              onClick={() => playSong(song, songs)}
              onPointerDown={(event) => {
                if (event.button === 2 && onDislike) setContextSongId(song.id);
              }}
              onContextMenu={(event) => {
                if (!onDislike) return;
                event.preventDefault();
                setContextSongId(song.id);
                const nextMenu = {
                  song,
                  x: Math.max(
                    8,
                    Math.min(event.clientX, window.innerWidth - 142),
                  ),
                  y: Math.max(
                    8,
                    Math.min(event.clientY, window.innerHeight - 48),
                  ),
                };
                capturePointerOrigin(
                  "song-context-menu",
                  event.clientX,
                  event.clientY,
                );
                setLastContextMenu(nextMenu);
                setContextMenu(nextMenu);
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
              <div className="n">
                {song.name}
                {song.fee === 1 && (
                  <span
                    className="vip-badge"
                    title="需要网易云音乐会员，非会员可试听 60 秒（如资源支持）"
                  >
                    VIP
                  </span>
                )}
              </div>
              <div className="a">{song.artists}</div>
            </article>
          );
        })}
      </div>
      {contextTransition.rendered &&
        lastContextMenu &&
        createPortal(
          <div
            ref={contextTransition.surfaceRef}
            className={`song-card-context-menu ${contextTransition.surfaceClassName}`}
            role="menu"
            style={{ left: lastContextMenu.x, top: lastContextMenu.y }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button
              role="menuitem"
              onClick={() => dismiss(lastContextMenu.song)}
            >
              <ThumbsDown size={14} />
              <span>不感兴趣</span>
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
