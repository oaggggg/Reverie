import { useEffect, useState } from "react";
import { Check, LoaderCircle, Search, X } from "lucide-react";
import { searchSongs } from "../api/client.ts";
import type { Song } from "../api/types.ts";
import { useOriginTransition } from "../utils/originTransition";

interface Props {
  open: boolean;
  existingIds: Set<number>;
  onClose: () => void;
  onSubmit: (songs: Song[]) => Promise<boolean>;
}

export default function PlaylistTrackPicker({
  open,
  existingIds,
  onClose,
  onSubmit,
}: Props) {
  const [keyword, setKeyword] = useState("");
  const [songs, setSongs] = useState<Song[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const transition = useOriginTransition<HTMLDivElement>(open, "playlist-picker", 220);

  useEffect(() => {
    if (!open) {
      setKeyword("");
      setSongs([]);
      setSelected(new Set());
    }
  }, [open]);

  if (!transition.rendered) return null;

  const search = async () => {
    const value = keyword.trim();
    if (!value || loading) return;
    setLoading(true);
    try {
      setSongs(await searchSongs(value, 20));
      setSelected(new Set());
    } catch {
      setSongs([]);
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    const picked = songs.filter((song) => selected.has(song.id));
    if (!picked.length || submitting) return;
    setSubmitting(true);
    try {
      if (await onSubmit(picked)) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={`modal-backdrop ${transition.backdropClassName}`}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={transition.surfaceRef}
        className={`modal playlist-track-picker ${transition.surfaceClassName}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="playlist-picker-title"
      >
        <div className="modal-header">
          <div>
            <h2 id="playlist-picker-title">添加歌曲</h2>
            <p>搜索歌曲后勾选要加入歌单的内容</p>
          </div>
          <button className="modal-close" title="关闭" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <form
          className="playlist-picker-search"
          onSubmit={(event) => {
            event.preventDefault();
            void search();
          }}
        >
          <Search size={16} />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索歌曲"
            autoFocus
          />
          <button
            className="btn primary"
            type="submit"
            disabled={!keyword.trim() || loading}
          >
            {loading ? <LoaderCircle size={15} className="spin" /> : "搜索"}
          </button>
        </form>
        <div className="playlist-picker-results">
          {songs.map((song) => {
            const exists = existingIds.has(song.id);
            const checked = selected.has(song.id);
            return (
              <button
                type="button"
                key={song.id}
                className={`playlist-picker-row ${checked ? "selected" : ""} ${exists ? "exists" : ""}`}
                disabled={exists}
                onClick={() =>
                  setSelected((current) => {
                    const next = new Set(current);
                    if (next.has(song.id)) next.delete(song.id);
                    else next.add(song.id);
                    return next;
                  })
                }
              >
                <span className="playlist-picker-check">
                  {exists ? "已在歌单" : checked ? <Check size={15} /> : null}
                </span>
                <span className="playlist-picker-meta">
                  <strong>{song.name}</strong>
                  <small>
                    {song.artists} · {song.album}
                  </small>
                </span>
              </button>
            );
          })}
          {!loading && keyword && !songs.length && (
            <div className="empty">没有找到歌曲</div>
          )}
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            取消
          </button>
          <button
            className="btn primary"
            disabled={!selected.size || submitting}
            onClick={() => void submit()}
          >
            {submitting ? "添加中…" : `添加 ${selected.size || ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
