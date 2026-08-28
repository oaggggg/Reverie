import type { ReactNode } from "react";
import { Play } from "lucide-react";
import type { PlaylistInfo } from "../api/types";
import { sizedImage } from "../utils/image";
import { LoadingState } from "./Page";

function formatPlaylistPlayCount(value: number | null | undefined): string {
  const count = Math.max(0, Number(value) || 0);
  if (count < 10_000) return count.toLocaleString("zh-CN");
  if (count < 100_000_000) {
    const scaled = count / 10_000;
    return `${Number(scaled.toFixed(scaled < 10 ? 1 : 0)).toLocaleString("zh-CN")}万`;
  }
  const scaled = count / 100_000_000;
  return `${Number(scaled.toFixed(scaled < 10 ? 1 : 0)).toLocaleString("zh-CN")}亿`;
}

interface Props {
  playlists: PlaylistInfo[];
  onOpen: (id: number, name: string) => void;
  emptyText?: string;
  renderActions?: (playlist: PlaylistInfo) => ReactNode;
  loading?: boolean;
  showPlayCount?: boolean;
}

export default function PlaylistGrid({
  playlists,
  onOpen,
  emptyText = "暂无歌单",
  renderActions,
  loading = false,
  showPlayCount = false,
}: Props) {
  if (!playlists.length) {
    if (loading) return <LoadingState label="正在加载歌单…" />;
    return <div className="empty">{emptyText}</div>;
  }
  return (
    <div className="playlist-grid">
      {playlists.map((p) => (
        <div
          key={p.id}
          className="playlist-card"
          onPointerEnter={() => void import("./PlaylistPage")}
          onClick={() => onOpen(p.id, p.name)}
        >
          <div className="card-cover">
            <img
              src={sizedImage(p.coverImgUrl, 320)}
              alt=""
              loading="lazy"
              decoding="async"
            />
            {showPlayCount && (p.playCount ?? 0) > 0 && (
              <span
                className="playlist-play-count"
                title={`播放量 ${formatPlaylistPlayCount(p.playCount)}`}
              >
                <Play aria-hidden="true" className="playlist-play-count-icon" size={10} strokeWidth={2.5} />
                {formatPlaylistPlayCount(p.playCount)}
              </span>
            )}
            {renderActions && (
              <div
                className="playlist-card-actions"
                onClick={(e) => e.stopPropagation()}
              >
                {renderActions(p)}
              </div>
            )}
          </div>
          <div className="n">{p.name}</div>
          <div className="c">{p.trackCount} 首</div>
        </div>
      ))}
    </div>
  );
}
