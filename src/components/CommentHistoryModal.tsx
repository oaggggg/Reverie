import { useEffect } from "react";
import { MessageCircle, X } from "lucide-react";
import { useCommentHistoryStore } from "../store/commentHistoryStore.ts";
import { usePlayerStore } from "../store/playerStore";
import { useOriginTransition } from "../utils/originTransition";
import { useModalBehavior } from "../utils/modalBehavior";
import { LoadingState } from "./Page";

function formatTime(value: number) {
  return value
    ? new Date(value < 1e12 ? value * 1000 : value).toLocaleString("zh-CN")
    : "时间未知";
}

export default function CommentHistoryModal() {
  const showCommentHistory = usePlayerStore((s) => s.showCommentHistory);
  const setShowCommentHistory = usePlayerStore((s) => s.setShowCommentHistory);
  const items = useCommentHistoryStore((state) => state.items);
  const loading = useCommentHistoryStore((state) => state.loading);
  const load = useCommentHistoryStore((state) => state.load);

  const transition = useOriginTransition(
    showCommentHistory,
    "comment-history-modal",
    220,
  );
  useModalBehavior(
    showCommentHistory,
    transition.surfaceRef,
    () => setShowCommentHistory(false),
  );

  useEffect(() => {
    if (!showCommentHistory) return;
    void load();
  }, [showCommentHistory, load]);

  if (!transition.rendered) return null;

  return (
    <div
      className={`modal-backdrop ${transition.backdropClassName}`}
      onClick={() => setShowCommentHistory(false)}
    >
      <div
        ref={transition.surfaceRef}
        className={`modal comment-history-modal ${transition.surfaceClassName}`}
        role="dialog"
        aria-modal="true"
        aria-label="我的评论"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="notification-modal-head">
          <h2>我的评论</h2>
          <span className="notification-modal-sub">
            {items.length} 条历史评论
          </span>
          <div className="notification-modal-actions">
            <button
              className="topnav-icon-btn"
              title="关闭"
              onClick={() => setShowCommentHistory(false)}
            >
              <X size={16} />
            </button>
          </div>
        </header>
        {loading ? (
          <LoadingState label="正在加载评论历史…" />
        ) : items.length ? (
          <div className="comment-history-list in-modal">
            {items.map((item) => (
              <article key={`${item.id}-${item.time}`}>
                <span className="comment-history-icon">
                  <MessageCircle size={16} />
                </span>
                <div>
                  <p>{item.content}</p>
                  <strong>{item.resourceTitle}</strong>
                  <time>{formatTime(item.time)}</time>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">暂无评论历史</div>
        )}
      </div>
    </div>
  );
}
