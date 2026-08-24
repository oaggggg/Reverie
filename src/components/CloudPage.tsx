import { useEffect, useRef, useState } from "react";
import {
  Cloud,
  Download,
  FileAudio,
  Play,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCloudStore } from "../store/cloudStore";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { usePlayerStore } from "../store/playerStore";
import type { CloudSong } from "../api/types";
import ConfirmModal from "./ConfirmModal";
import { LoadingState, Page, PageHeader } from "./Page";
import { sizedImage } from "../utils/image";
import { useOriginTransition } from "../utils/originTransition";

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "大小未知";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function SongCover({ song }: { song: CloudSong }) {
  const [failed, setFailed] = useState(false);
  if (song.picUrl && !failed) {
    return (
      <img
        className="cloud-song-cover"
        src={sizedImage(song.picUrl, 120)}
        alt=""
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span
      className="cloud-song-cover cloud-song-placeholder"
      aria-hidden="true"
    >
      <FileAudio size={20} />
    </span>
  );
}

function SongRow({ song, songs }: { song: CloudSong; songs: CloudSong[] }) {
  const playSong = usePlayerStore((state) => state.playSong);
  const openDetail = useCloudStore((state) => state.openDetail);
  const match = useCloudStore((state) => state.match);
  const matchingId = useCloudStore((state) => state.matchingId);
  const [matchId, setMatchId] = useState(
    song.matchedSongId ? String(song.matchedSongId) : "",
  );
  const busy = matchingId === (song.cloudId || song.id);
  return (
    <article
      className="cloud-song-row"
      role="button"
      tabIndex={0}
      title="查看云盘歌曲详情"
      onClick={() => void openDetail(song)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          void openDetail(song);
        }
      }}
    >
      <SongCover song={song} />
      <div className="cloud-song-main">
        <strong title={song.fileName}>{song.name}</strong>
        <span>
          {song.artists} · {song.album}
        </span>
        <small>
          {formatBytes(song.fileSize)}
          {song.bitrate ? ` · ${Math.round(song.bitrate / 1000)} kbps` : ""}
        </small>
      </div>
      <div className="cloud-song-actions">
        <button
          className="icon-action"
          title="播放"
          onClick={(event) => {
            event.stopPropagation();
            void playSong(song, songs);
          }}
        >
          <Play size={16} fill="currentColor" />
        </button>
        <div className="cloud-match-control">
          <input
            value={matchId}
            inputMode="numeric"
            aria-label={`为 ${song.name} 输入匹配歌曲 ID`}
            placeholder="匹配歌曲 ID"
            onChange={(event) =>
              setMatchId(event.target.value.replace(/\D/g, ""))
            }
            onClick={(event) => event.stopPropagation()}
          />
          <button
            className="icon-action"
            title="匹配歌曲"
            disabled={busy || !matchId}
            onClick={(event) => {
              event.stopPropagation();
              void match(song, Number(matchId));
            }}
          >
            {busy ? (
              <RefreshCw size={15} className="spin" />
            ) : (
              <RefreshCw size={15} />
            )}
          </button>
        </div>
        <DeleteButton song={song} />
      </div>
    </article>
  );
}

function DeleteButton({ song }: { song: CloudSong }) {
  const remove = useCloudStore((state) => state.remove);
  const deletingId = useCloudStore((state) => state.deletingId);
  const [open, setOpen] = useState(false);
  const busy = deletingId === (song.cloudId || song.id);
  return (
    <>
      <button
        className="icon-action danger"
        title="删除云盘歌曲"
        disabled={busy}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <Trash2 size={16} />
      </button>
      <ConfirmModal
        open={open}
        title="删除云盘歌曲"
        message={`确定从云盘删除「${song.name}」吗？`}
        onClose={() => setOpen(false)}
        onConfirm={() => remove(song)}
      />
    </>
  );
}

function CloudDetailDialog({
  song,
  loading,
  onClose,
}: {
  song: CloudSong | null;
  loading: boolean;
  onClose: () => void;
}) {
  const cachedSong = useRef<CloudSong | null>(song);
  if (song) cachedSong.current = song;
  const transition = useOriginTransition<HTMLDivElement>(
    Boolean(song),
    "cloud-detail",
    220,
  );
  const currentSong = cachedSong.current;
  if (!transition.rendered || !currentSong) return null;
  return (
    <div className={`modal-backdrop ${transition.backdropClassName}`} onClick={onClose}>
      <div ref={transition.surfaceRef} className={`modal entity-editor ${transition.surfaceClassName}`} onClick={(event) => event.stopPropagation()}>
        <h2>{currentSong.name}</h2>
        <p className="sub">{loading ? "正在加载云盘详情…" : "云盘歌曲详情"}</p>
        <div className="cloud-detail-list">
          <div><span>歌手</span><strong>{currentSong.artists || "未知歌手"}</strong></div>
          <div><span>专辑</span><strong>{currentSong.album || "未知专辑"}</strong></div>
          <div><span>歌曲 ID</span><strong>{currentSong.id || "-"}</strong></div>
          <div><span>云盘 ID</span><strong>{currentSong.cloudId || "-"}</strong></div>
          <div><span>文件名</span><strong>{currentSong.fileName || "-"}</strong></div>
          <div><span>文件大小</span><strong>{formatBytes(currentSong.fileSize)}</strong></div>
          <div><span>比特率</span><strong>{currentSong.bitrate ? `${Math.round(currentSong.bitrate / 1000)} kbps` : "未知"}</strong></div>
          <div><span>匹配歌曲</span><strong>{currentSong.matchedSongId || "未匹配"}</strong></div>
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}

type ImportValues = {
  md5: string;
  id: string;
  bitrate: string;
  fileSize: string;
  song: string;
  artist: string;
  album: string;
  fileType: string;
};

const emptyImport: ImportValues = {
  md5: "",
  id: "",
  bitrate: "320000",
  fileSize: "",
  song: "",
  artist: "",
  album: "",
  fileType: "mp3",
};

function CloudImportDialog({
  open,
  importing,
  onClose,
  onSubmit,
}: {
  open: boolean;
  importing: boolean;
  onClose: () => void;
  onSubmit: (input: ImportValues) => Promise<boolean>;
}) {
  const [values, setValues] = useState<ImportValues>(emptyImport);
  const transition = useOriginTransition<HTMLDivElement>(open, "cloud-import", 220);
  useEffect(() => {
    if (open) setValues(emptyImport);
  }, [open]);
  if (!transition.rendered) return null;
  const update = (key: keyof ImportValues, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));
  const submit = async () => {
    if (!values.md5.trim() || !values.song.trim() || !values.artist.trim()) return;
    if (await onSubmit(values)) onClose();
  };
  return (
    <div className={`modal-backdrop ${transition.backdropClassName}`} onClick={onClose}>
      <div ref={transition.surfaceRef} className={`modal entity-editor ${transition.surfaceClassName}`} onClick={(event) => event.stopPropagation()}>
        <h2>导入已有歌曲</h2>
        <p className="sub">使用歌曲文件的 MD5 和元数据，将已存在的资源加入云盘。</p>
        <label className="field-label">
          MD5（必填）
          <input value={values.md5} onChange={(event) => update("md5", event.target.value.trim())} />
        </label>
        <label className="field-label">
          歌曲 ID（可选）
          <input inputMode="numeric" value={values.id} onChange={(event) => update("id", event.target.value.replace(/\D/g, ""))} />
        </label>
        <label className="field-label">
          歌曲名
          <input value={values.song} onChange={(event) => update("song", event.target.value)} />
        </label>
        <label className="field-label">
          歌手
          <input value={values.artist} onChange={(event) => update("artist", event.target.value)} />
        </label>
        <label className="field-label">
          专辑
          <input value={values.album} onChange={(event) => update("album", event.target.value)} />
        </label>
        <div className="cloud-import-grid">
          <label className="field-label">
            比特率
            <input inputMode="numeric" value={values.bitrate} onChange={(event) => update("bitrate", event.target.value.replace(/\D/g, ""))} />
          </label>
          <label className="field-label">
            文件大小
            <input inputMode="numeric" value={values.fileSize} onChange={(event) => update("fileSize", event.target.value.replace(/\D/g, ""))} />
          </label>
          <label className="field-label">
            文件类型
            <input value={values.fileType} onChange={(event) => update("fileType", event.target.value)} />
          </label>
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose} disabled={importing}>取消</button>
          <button className="btn primary" onClick={() => void submit()} disabled={importing || !values.md5.trim() || !values.song.trim() || !values.artist.trim()}>
            {importing ? "导入中…" : "导入云盘"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CloudPage() {
  const songs = useCloudStore((state) => state.songs);
  const total = useCloudStore((state) => state.total);
  const loading = useCloudStore((state) => state.loading);
  const loadingMore = useCloudStore((state) => state.loadingMore);
  const hasMore = useCloudStore((state) => state.hasMore);
  const uploadPhase = useCloudStore((state) => state.uploadPhase);
  const uploadName = useCloudStore((state) => state.uploadName);
  const uploadError = useCloudStore((state) => state.uploadError);
  const load = useCloudStore((state) => state.load);
  const loadMore = useCloudStore((state) => state.loadMore);
  const upload = useCloudStore((state) => state.upload);
  const importing = useCloudStore((state) => state.importing);
  const importSong = useCloudStore((state) => state.importSong);
  const detail = useCloudStore((state) => state.detail);
  const detailLoading = useCloudStore((state) => state.detailLoading);
  const closeDetail = useCloudStore((state) => state.closeDetail);
  const resetUpload = useCloudStore((state) => state.resetUpload);
  const [importOpen, setImportOpen] = useState(false);
  const loadMoreRef = useInfiniteScroll(
    () => void loadMore(),
    loadingMore || !hasMore,
  );

  useEffect(() => {
    void load(true);
  }, [load]);

  return (
    <Page>
      <PageHeader
        title="云盘"
        subtitle={`${total} 首歌曲`}
        actions={
          <div className="cloud-header-actions">
            <button
              className="btn"
              title="刷新云盘"
              onClick={() => void load(true)}
              disabled={loading}
            >
              <RefreshCw size={15} className={loading ? "spin" : ""} /> 刷新
            </button>
            <label className="btn primary cloud-upload-button">
              <Upload size={15} /> 上传歌曲
              <input
                type="file"
                accept="audio/*,.mp3,.flac,.m4a,.wav,.ogg"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.currentTarget.value = "";
                  if (file) void upload(file);
                }}
              />
            </label>
            <button className="btn" data-origin-key="cloud-import" title="导入已有歌曲" onClick={() => setImportOpen(true)}>
              <Download size={15} /> 导入已有歌曲
            </button>
          </div>
        }
      />
      {uploadPhase !== "idle" && (
        <div className={`cloud-upload-status ${uploadPhase}`} role="status">
          <Cloud size={17} />
          <span>
            {uploadPhase === "uploading" && `正在上传 ${uploadName}…`}
            {uploadPhase === "success" && `${uploadName} 已上传`}
            {uploadPhase === "error" && (uploadError || "上传失败")}
          </span>
          {uploadPhase !== "uploading" && (
            <button title="关闭上传状态" onClick={resetUpload}>
              <X size={15} />
            </button>
          )}
        </div>
      )}
      {loading && !songs.length ? (
        <LoadingState label="正在加载云盘…" />
      ) : !songs.length ? (
        <div className="empty cloud-empty">
          <Cloud size={28} />
          <strong>云盘暂无歌曲</strong>
          <span>上传本地音乐后，它会出现在这里。</span>
        </div>
      ) : (
        <>
          <div className="cloud-song-list">
            {songs.map((song) => (
              <SongRow
                key={`${song.cloudId}-${song.id}`}
                song={song}
                songs={songs}
              />
            ))}
          </div>
          {hasMore && <div ref={loadMoreRef} className="load-more-sentinel" />}
        </>
      )}
      <CloudImportDialog
        open={importOpen}
        importing={importing}
        onClose={() => setImportOpen(false)}
        onSubmit={async (values) =>
          importSong({
            md5: values.md5.trim(),
            id: values.id ? Number(values.id) : undefined,
            bitrate: Number(values.bitrate) || 0,
            fileSize: Number(values.fileSize) || 0,
            song: values.song.trim(),
            artist: values.artist.trim(),
            album: values.album.trim(),
            fileType: values.fileType.trim() || "mp3",
          })
        }
      />
      <CloudDetailDialog
        song={detail}
        loading={detailLoading}
        onClose={closeDetail}
      />
    </Page>
  );
}
