import { MessageCircle, X } from "lucide-react";
import { useCommentStore } from "../store/commentStore";
import { usePlayerStore } from "../store/playerStore";
import { sizedImage } from "../utils/image";
import { useOriginTransition } from "../utils/originTransition";
import { useModalBehavior } from "../utils/modalBehavior";
import CommentPanel from "./CommentPanel";

const RESOURCE_LABELS = {
  song: "歌曲",
  mv: "MV",
  playlist: "歌单",
  album: "专辑",
  program: "播客节目",
  video: "视频",
  event: "动态",
} as const;

/** 资源评论弹窗：在详情弹窗（如专辑弹窗）之上继续打开的评论区。
 *  头部只保留资源类型与标题，不展示歌单创建者/收藏者等信息。 */
export default function CommentsModal() {
  const show = usePlayerStore((s) => s.showCommentsModal);
  const setShow = usePlayerStore((s) => s.setShowCommentsModal);
  const resource = useCommentStore((s) => s.resource);

  const transition = useOriginTransition(show, "comments-modal", 220);
  useModalBehavior(show, transition.surfaceRef, () => setShow(false));

  if (!transition.rendered) return null;

  const label =
    resource && resource.type in RESOURCE_LABELS
      ? RESOURCE_LABELS[resource.type as keyof typeof RESOURCE_LABELS]
      : "评论";

  return (
    <div
      className={`modal-backdrop ${transition.backdropClassName}`}
      onClick={() => setShow(false)}
    >
      <section
        ref={transition.surfaceRef}
        className={`modal comments-modal ${transition.surfaceClassName}`}
        role="dialog"
        aria-modal="true"
        aria-label="评论"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="comments-modal-header">
          {resource?.coverUrl ? (
            <img
              className="playlist-comments-cover"
              src={sizedImage(resource.coverUrl, 120)}
              alt=""
            />
          ) : (
            <span className="playlist-comments-cover comments-modal-cover-placeholder">
              <MessageCircle size={18} />
            </span>
          )}
          <div className="comments-modal-title-block">
            <span>{label}评论</span>
            <strong id="resource-comments-title">
              {resource?.title || "未选择评论资源"}
            </strong>
          </div>
          <button
            className="icon-btn"
            title="关闭"
            onClick={() => setShow(false)}
          >
            <X size={18} />
          </button>
        </header>
        <CommentPanel compact />
      </section>
    </div>
  );
}
