import { useEffect, useRef } from "react";
import { Disc3, X } from "lucide-react";
import { useCommentStore } from "../store/commentStore";
import { usePlayerStore } from "../store/playerStore";
import { sizedImage } from "../utils/image";
import CommentPanel from "./CommentPanel";
import { useOriginTransition } from "../utils/originTransition";
import { useModalBehavior } from "../utils/modalBehavior";

export default function PlayerCommentsDrawer() {
  const currentSong = usePlayerStore((state) => state.currentSong);
  const setOpen = usePlayerStore((state) => state.setShowPlayerComments);
  const resource = useCommentStore((state) => state.resource);
  const openSongComments = useCommentStore((state) => state.openSongComments);
  const loadedSongId = useRef(0);
  const open = usePlayerStore((state) => state.showPlayerComments);
  const transition = useOriginTransition<HTMLElement>(
    open,
    "player-comments",
    260,
  );
  useModalBehavior(open, transition.surfaceRef, () => setOpen(false));

  useEffect(() => {
    if (!open || !currentSong || loadedSongId.current === currentSong.id)
      return;
    loadedSongId.current = currentSong.id;
    void openSongComments(currentSong);
  }, [currentSong, open, openSongComments]);

  if (!currentSong || !transition.rendered) return null;
  return (
    <>
      <button
        className={`player-comments-scrim ${transition.backdropClassName}`}
        onClick={() => setOpen(false)}
        aria-label="关闭评论"
      />
      <section
        ref={transition.surfaceRef}
        className={`player-comments-drawer ${transition.surfaceClassName}`}
        role="dialog"
        aria-modal="true"
        aria-label="歌曲评论"
      >
        <header className="player-comments-header">
          <div className="player-comments-title">
            {currentSong.picUrl ? (
              <img src={sizedImage(currentSong.picUrl, 96)} alt="" />
            ) : (
              <span className="player-comments-cover-ph">
                <Disc3 size={18} />
              </span>
            )}
            <div>
              <span>{currentSong.programId ? "节目评论" : "歌曲评论"}</span>
              <strong>{currentSong.name}</strong>
              <small>
                {resource?.id ===
                String(currentSong.programId ?? currentSong.id)
                  ? resource.subtitle
                  : "加载中"}
              </small>
            </div>
          </div>
          <button
            className="icon-btn"
            onClick={() => setOpen(false)}
            title="关闭评论"
          >
            <X size={18} />
          </button>
        </header>
        <CommentPanel compact />
      </section>
    </>
  );
}
