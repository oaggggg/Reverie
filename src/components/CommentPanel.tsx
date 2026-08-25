import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  CircleUserRound,
  Heart,
  MessageCircle,
  Send,
  Trash2,
  HandHeart,
  X,
} from "lucide-react";
import type { CommentInfo, CommentSort } from "../api/types";
import { useCommentStore } from "../store/commentStore";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { usePlayerStore } from "../store/playerStore";
import { sizedImage } from "../utils/image";
import { hugComment } from "../api/comment";
import { LoadingState } from "./Page";
import ConfirmModal from "./ConfirmModal";

const SORTS: Array<{ id: CommentSort; label: string }> = [
  { id: "recommended", label: "推荐" },
  { id: "hot", label: "热门" },
  { id: "new", label: "最新" },
];

/* 展开的回复列表尾部的自动加载哨兵（renderComment 是普通函数，不能挂 Hook） */
function RepliesMore({ comment }: { comment: CommentInfo }) {
  const thread = useCommentStore((state) => state.replies[comment.id]);
  const loadMoreReplies = useCommentStore((state) => state.loadMoreReplies);
  const enabled = !!thread?.expanded && thread.hasMore && !thread.loading;
  const sentinelRef = useInfiniteScroll(
    () => void loadMoreReplies(comment),
    !enabled,
  );
  if (!enabled) return null;
  return <div ref={sentinelRef} className="load-more-sentinel" />;
}

function CommentAvatar({ comment }: { comment: CommentInfo }) {
  const [failed, setFailed] = useState(false);
  return comment.avatarUrl && !failed ? (
    <img
      className="comment-avatar"
      src={sizedImage(comment.avatarUrl, 80)}
      alt=""
      onError={() => setFailed(true)}
    />
  ) : (
    <span className="comment-avatar placeholder">
      <CircleUserRound size={18} />
    </span>
  );
}

function formatCommentTime(time: number) {
  if (!time) return "";
  return new Date(time).toLocaleString("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CommentPanel({
  compact = false,
}: {
  compact?: boolean;
}) {
  const resource = useCommentStore((state) => state.resource);
  const comments = useCommentStore((state) => state.comments);
  const total = useCommentStore((state) => state.total);
  const sort = useCommentStore((state) => state.sort);
  const hasMore = useCommentStore((state) => state.hasMore);
  const loading = useCommentStore((state) => state.loading);
  const loadingMore = useCommentStore((state) => state.loadingMore);
  const submitting = useCommentStore((state) => state.submitting);
  const replies = useCommentStore((state) => state.replies);
  const setSort = useCommentStore((state) => state.setSort);
  const loadMore = useCommentStore((state) => state.loadMore);
  const submit = useCommentStore((state) => state.submit);
  const toggleLike = useCommentStore((state) => state.toggleLike);
  const remove = useCommentStore((state) => state.remove);
  const toggleReplies = useCommentStore((state) => state.toggleReplies);
  const uid = usePlayerStore((state) => state.profile?.userId ?? 0);
  const setShowLogin = usePlayerStore((state) => state.setShowLogin);
  const [draft, setDraft] = useState("");
  const commentMoreRef = useInfiniteScroll(
    () => void loadMore(),
    loadingMore || !hasMore,
  );
  const [replying, setReplying] = useState<{
    comment: CommentInfo;
    parentId?: number;
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    comment: CommentInfo;
    parentId?: number;
  } | null>(null);

  useEffect(() => {
    setDraft("");
    setReplying(null);
  }, [resource?.type, resource?.id, resource?.threadId]);

  const requireLogin = () => {
    if (uid) return true;
    setShowLogin(true);
    return false;
  };

  const publish = async () => {
    if (!draft.trim() || submitting || !requireLogin()) return;
    const sent = await submit(draft, replying?.comment, replying?.parentId);
    if (sent) {
      setDraft("");
      setReplying(null);
    }
  };

  const renderComment = (
    comment: CommentInfo,
    parentId?: number,
    nested = false,
  ) => {
    const thread = !nested ? replies[comment.id] : undefined;
    const canDelete = comment.owner || comment.userId === uid;
    return (
      <article
        className={`comment-item ${nested ? "nested" : ""}`}
        key={comment.id}
      >
        <CommentAvatar comment={comment} />
        <div className="comment-item-body">
          <div className="comment-item-head">
            <strong>{comment.nickname}</strong>
            <time>{formatCommentTime(comment.time)}</time>
          </div>
          <p>{comment.content}</p>
          {comment.repliedTo && (
            <blockquote>
              <strong>@{comment.repliedTo.nickname}</strong>
              {comment.repliedTo.content}
            </blockquote>
          )}
          <div className="comment-item-actions">
            <button
              title="抱一抱"
              onClick={() => {
                if (!requireLogin() || !resource) return;
                void hugComment(resource, comment)
                  .then(() => usePlayerStore.getState().toast("已抱一抱评论", "success"))
                  .catch(() => usePlayerStore.getState().toast("抱一抱失败", "error"));
              }}
            >
              <HandHeart size={14} /> 抱一抱
            </button>
            <button
              className={comment.liked ? "active" : ""}
              title={comment.liked ? "取消点赞" : "点赞"}
              onClick={() =>
                requireLogin() && void toggleLike(comment, parentId)
              }
            >
              <Heart size={14} fill={comment.liked ? "currentColor" : "none"} />
              {comment.likedCount || "赞"}
            </button>
            <button
              title="回复"
              onClick={() => {
                if (!requireLogin()) return;
                setReplying({ comment, parentId });
              }}
            >
              <MessageCircle size={14} /> 回复
            </button>
            {!nested && comment.replyCount > 0 && (
              <button onClick={() => void toggleReplies(comment)}>
                {thread?.expanded ? (
                  <ChevronUp size={14} />
                ) : (
                  <ChevronDown size={14} />
                )}
                {comment.replyCount} 条回复
              </button>
            )}
            {canDelete && (
              <button
                title="删除"
                onClick={() =>
                  requireLogin() && setPendingDelete({ comment, parentId })
                }
              >
                <Trash2 size={14} /> 删除
              </button>
            )}
          </div>
          {thread?.expanded && (
            <div className="comment-replies">
              {thread.comments.map((reply) =>
                renderComment(reply, comment.id, true),
              )}
              {thread.loading && <LoadingState label="正在加载回复…" />}
              <RepliesMore comment={comment} />
            </div>
          )}
        </div>
      </article>
    );
  };

  return (
    <section className={`comment-panel ${compact ? "compact" : ""}`}>
      <div className="comment-toolbar">
        <div className="segmented" role="tablist">
          {SORTS.map((item) => (
            <button
              key={item.id}
              role="tab"
              aria-selected={sort === item.id}
              className={sort === item.id ? "active" : ""}
              onClick={() => void setSort(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <span>{total} 条评论</span>
      </div>

      <div className="comment-list">
        {comments.map((comment) => renderComment(comment))}
        {!comments.length &&
          (loading ? (
            <LoadingState label="正在加载评论…" />
          ) : (
            <div className="empty">还没有评论</div>
          ))}
        {hasMore && <div ref={commentMoreRef} className="load-more-sentinel" />}
      </div>

      <div className="comment-composer">
        {replying && (
          <div className="comment-reply-target">
            <span>回复 @{replying.comment.nickname}</span>
            <button title="取消回复" onClick={() => setReplying(null)}>
              <X size={14} />
            </button>
          </div>
        )}
        <div className="comment-composer-row">
          <textarea
            rows={compact ? 2 : 3}
            maxLength={140}
            placeholder={replying ? "输入回复内容" : "写下此刻的感受"}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // IME 组词期间的 Enter 是确认候选词，不能触发发送。
              if (event.nativeEvent.isComposing) return;
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void publish();
              }
            }}
          />
          <button
            className="btn primary"
            title={replying ? "发送回复" : "发布评论"}
            disabled={!draft.trim() || submitting}
            onClick={() => void publish()}
          >
            <Send size={15} />
          </button>
        </div>
        <span>{draft.length}/140</span>
      </div>

      <ConfirmModal
        open={!!pendingDelete}
        title="删除评论"
        message="确定要删除这条评论吗？删除后无法恢复。"
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          void remove(pendingDelete.comment, pendingDelete.parentId);
        }}
      />
    </section>
  );
}
