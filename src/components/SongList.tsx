import {
  ArrowDown,
  ArrowUp,
  Disc3,
  Download,
  FileText,
  ListEnd,
  Play,
  Trash2,
  UserRound,
  Clapperboard,
} from "lucide-react";
import { useState } from "react";
import type { Song } from "../api/types";
import { useMediaStore } from "../store/mediaStore";
import { isVipSong, usePlayerStore } from "../store/playerStore";
import { downloadSongFile } from "../api/client";
import { formatTime } from "../utils/lyrics";
import { sizedImage } from "../utils/image";
import { openAlbumModal, openArtistModal } from "../utils/detailModals";
import { LoadingState } from "./Page";

interface Props {
  songs: Song[];
  title?: string;
  countLabel?: string;
  emptyText?: string;
  showCover?: boolean;
  loading?: boolean;
  onRemove?: (song: Song, index: number) => void;
  onMove?: (song: Song, index: number, direction: -1 | 1) => void;
  onOpenProgram?: (song: Song) => void;
}

// 歌曲行标识只保留官方数据可判定的两项：VIP 歌曲（fee===1）与
// 支持超清母带（privilege 判定）。版本标识（原唱/翻唱/Live 等）已按
// 需求整体移除。

export default function SongList({
  songs,
  title,
  countLabel,
  emptyText = "暂无歌曲",
  showCover = true,
  loading = false,
  onRemove,
  onMove,
  onOpenProgram,
}: Props) {
  const currentSong = usePlayerStore((s) => s.currentSong);
  const playing = usePlayerStore((s) => s.playing);
  const playSong = usePlayerStore((s) => s.playSong);
  const playNext = usePlayerStore((s) => s.playNext);
  const openMedia = useMediaStore((s) => s.open);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  return (
    <>
      {title && (
        <div className="list-header">
          <h3>{title}</h3>
          <span className="count">{countLabel ?? `${songs.length} 首`}</span>
        </div>
      )}
      <div className="song-list">
        {songs.length === 0 && loading ? (
          <LoadingState />
        ) : songs.length === 0 ? (
          <div className="empty">{emptyText}</div>
        ) : (
          songs.map((song, i) => {
            const isCur = currentSong?.id === song.id;
            return (
              <div
                key={`${song.id}-${i}`}
                className={`song-item ${isCur ? "playing" : ""}`}
                onClick={() => playSong(song, songs)}
              >
                <span className="idx">
                  {isCur ? (
                    playing ? (
                      // 正在播放：动态均衡器指示条（随播放状态动画）
                      <span className="eq-bars" aria-label="正在播放">
                        <i />
                        <i />
                        <i />
                      </span>
                    ) : (
                      <Play size={13} fill="currentColor" />
                    )
                  ) : (
                    i + 1
                  )}
                </span>
                {showCover &&
                  (song.picUrl ? (
                    <img
                      src={sizedImage(song.picUrl, 80)}
                      alt=""
                      loading="lazy"
                    />
                  ) : (
                    <span
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 9,
                        background: "var(--bg-3)",
                        flex: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--text-faint)",
                      }}
                    >
                      <Disc3 size={17} />
                    </span>
                  ))}
                <div className="meta">
                  <div className={`t ${isCur ? "playing-text" : ""}`}>
                    {song.name}
                    {isVipSong(song) && (
                      <span
                        className="vip-badge"
                        title={
                          song.fee === 1
                            ? "需要网易云音乐会员，非会员可试听 60 秒（如资源支持）"
                            : "非会员可免费试听标准音质，高音质需要会员"
                        }
                      >
                        VIP
                      </span>
                    )}
                  </div>
                  <div className="a">
                    {song.master && (
                      <span className="song-tag master" title="支持超清母带音质">
                        超清母带
                      </span>
                    )}
                    {song.artists}
                    {song.album ? ` · ${song.album}` : ""}
                  </div>
                </div>
                <div
                  className="song-row-actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  {song.mvId ? (
                    <button
                      className="icon-action"
                      title="观看 MV"
                      onClick={() =>
                        void openMedia({
                          id: String(song.mvId),
                          name: song.name,
                          coverUrl: song.picUrl,
                          creatorName: song.artists,
                          duration: 0,
                          playCount: 0,
                          kind: "mv",
                        })
                      }
                    >
                      <Clapperboard size={15} />
                    </button>
                  ) : null}
                  {song.artistIds?.[0] ? (
                    <button
                      className="icon-action"
                      title="歌手详情"
                      onClick={() => openArtistModal(song.artistIds![0])}
                    >
                      <UserRound size={15} />
                    </button>
                  ) : null}
                  {song.albumId > 0 ? (
                    <button
                      className="icon-action"
                      title="专辑详情"
                      onClick={() => openAlbumModal(song.albumId)}
                    >
                      <Disc3 size={15} />
                    </button>
                  ) : null}
                  {song.programId && onOpenProgram ? (
                    <button
                      className="icon-action"
                      title="节目详情"
                      onClick={() => onOpenProgram(song)}
                    >
                      <FileText size={15} />
                    </button>
                  ) : null}
                  {onMove && (
                    <>
                      <button
                        className="icon-action"
                        title="上移"
                        disabled={i === 0}
                        onClick={() => onMove(song, i, -1)}
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        className="icon-action"
                        title="下移"
                        disabled={i === songs.length - 1}
                        onClick={() => onMove(song, i, 1)}
                      >
                        <ArrowDown size={15} />
                      </button>
                    </>
                  )}
                  {onRemove && (
                    <button
                      className="icon-action danger"
                      title="从歌单移除"
                      onClick={() => onRemove(song, i)}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                  <button
                    className="icon-action"
                    title="下一首播放"
                    onClick={() => playNext(song)}
                  >
                    <ListEnd size={15} />
                  </button>
                  <button
                    className="icon-action"
                    title="下载歌曲"
                    disabled={downloadingId === song.id}
                    onClick={() => {
                      setDownloadingId(song.id);
                      void downloadSongFile(song)
                        .then(() =>
                          usePlayerStore
                            .getState()
                            .toast("已开始下载歌曲", "success"),
                        )
                        .catch(() =>
                          usePlayerStore
                            .getState()
                            .toast("歌曲暂时无法下载", "error"),
                        )
                        .finally(() => setDownloadingId(null));
                    }}
                  >
                    <Download size={15} />
                  </button>
                </div>
                <span className="dur">{formatTime(song.duration)}</span>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
