import { useEffect } from "react";
import { X } from "lucide-react";
import { usePlayerStore } from "../store/playerStore";
import { useOriginTransition } from "../utils/originTransition";
import { useModalBehavior } from "../utils/modalBehavior";
import SongList from "./SongList";
import BackToTop from "./BackToTop";

export default function LikesModal() {
  const showLikes = usePlayerStore((s) => s.showLikes);
  const setShowLikes = usePlayerStore((s) => s.setShowLikes);
  const likedSongs = usePlayerStore((s) => s.likedSongs);
  const loadLikedSongs = usePlayerStore((s) => s.loadLikedSongs);
  const likedSongsLoading = usePlayerStore((s) => s.likedSongsLoading);

  const transition = useOriginTransition(showLikes, "likes-modal", 220);
  useModalBehavior(
    showLikes,
    transition.surfaceRef,
    () => setShowLikes(false),
  );

  // 打开弹窗时自动刷新完整红心列表。
  useEffect(() => {
    if (!showLikes) return;
    void loadLikedSongs();
  }, [showLikes, loadLikedSongs]);

  if (!transition.rendered) return null;

  return (
    <div
      className={`modal-backdrop ${transition.backdropClassName}`}
      onClick={() => setShowLikes(false)}
    >
      <div
        ref={transition.surfaceRef}
        className={`modal likes-modal ${transition.surfaceClassName}`}
        role="dialog"
        aria-modal="true"
        aria-label="我的喜欢"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="notification-modal-head">
          <h2>我的喜欢</h2>
          <span className="notification-modal-sub">
            {likedSongs.length} 首红心歌曲
          </span>
          <div className="notification-modal-actions">
            <button
              className="topnav-icon-btn"
              title="关闭"
              onClick={() => setShowLikes(false)}
            >
              <X size={16} />
            </button>
          </div>
        </header>
        <div className="likes-modal-body">
          <SongList
            songs={likedSongs}
            loading={likedSongsLoading}
            emptyText="还没有喜欢的歌曲，点播放栏的红心收藏吧"
          />
          <BackToTop />
        </div>
      </div>
    </div>
  );
}
