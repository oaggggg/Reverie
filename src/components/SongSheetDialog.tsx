import { useEffect, useState } from "react";
import { Music2, X } from "lucide-react";
import { getSongSheetPreview, getSongSheets } from "../api/sheet";
import type { Song, SongSheet } from "../api/types";
import { sizedImage } from "../utils/image";
import { LoadingState } from "./Page";
import { useOriginTransition } from "../utils/originTransition";
import { useModalBehavior } from "../utils/modalBehavior";
import SongBadges from "./SongBadges";

export default function SongSheetDialog({
  song,
  open,
  onClose,
}: {
  song: Song | null;
  open: boolean;
  onClose: () => void;
}) {
  const [sheets, setSheets] = useState<SongSheet[]>([]);
  const [preview, setPreview] = useState<SongSheet | null>(null);
  const [loading, setLoading] = useState(false);
  const transition = useOriginTransition<HTMLElement>(open, "song-sheet", 220);
  useModalBehavior(open, transition.surfaceRef, onClose);

  useEffect(() => {
    let alive = true;
    if (!open || !song) return;
    setLoading(true);
    setSheets([]);
    setPreview(null);
    void Promise.all([
      getSongSheets(song.id),
      getSongSheetPreview(song.id).catch(() => null),
    ])
      .then(([nextSheets, nextPreview]) => {
        if (!alive) return;
        setSheets(nextSheets);
        setPreview(nextPreview);
      })
      .catch(() => {
        if (alive) setSheets([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, song]);

  if (!transition.rendered || !song) return null;
  const selected = preview ?? sheets[0];
  return (
    <div
      className={`modal-backdrop ${transition.backdropClassName}`}
      onClick={onClose}
    >
      <section
        ref={transition.surfaceRef}
        className={`modal song-sheet-dialog ${transition.surfaceClassName}`}
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-head">
          <div>
            <h2>歌曲乐谱</h2>
            <p>
              {song.name}
              <SongBadges song={song} /> · {song.artists}
            </p>
          </div>
          <button className="icon-btn" onClick={onClose} title="关闭">
            <X size={18} />
          </button>
        </header>
        {loading ? (
          <LoadingState label="正在加载乐谱…" />
        ) : !sheets.length && !selected ? (
          <div className="empty">暂无可用乐谱</div>
        ) : (
          <>
            <div className="song-sheet-list">
              {sheets.map((sheet) => (
                <button
                  key={sheet.id}
                  className={selected?.id === sheet.id ? "active" : ""}
                  onClick={() => setPreview(sheet)}
                >
                  <Music2 size={15} />
                  <span>
                    <strong>{sheet.name}</strong>
                    <small>{sheet.type}</small>
                  </span>
                </button>
              ))}
            </div>
            {selected && (
              <div className="song-sheet-preview">
                {selected.previewUrl ? (
                  <img
                    src={sizedImage(selected.previewUrl, 1200)}
                    alt={`${selected.name}预览`}
                  />
                ) : (
                  <div className="song-sheet-placeholder">
                    <Music2 size={34} />
                    <span>{selected.description || "暂无预览图"}</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
