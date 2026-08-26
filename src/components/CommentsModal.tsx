import { X } from "lucide-react";
import { usePlayerStore } from "../store/playerStore";
import { useOriginTransition } from "../utils/originTransition";
import { useModalBehavior } from "../utils/modalBehavior";
import CommentPage from "./CommentPage";

/** 资源评论弹窗：在详情弹窗（如专辑弹窗）之上继续打开的评论区，
 *  复用评论页面内容，仅在外层套弹窗壳。 */
export default function CommentsModal() {
  const show = usePlayerStore((s) => s.showCommentsModal);
  const setShow = usePlayerStore((s) => s.setShowCommentsModal);

  const transition = useOriginTransition(show, "comments-modal", 220);
  useModalBehavior(show, transition.surfaceRef, () => setShow(false));

  if (!transition.rendered) return null;

  return (
    <div
      className={`modal-backdrop ${transition.backdropClassName}`}
      onClick={() => setShow(false)}
    >
      <div
        ref={transition.surfaceRef}
        className={`modal detail-modal ${transition.surfaceClassName}`}
        role="dialog"
        aria-modal="true"
        aria-label="评论"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="topnav-icon-btn detail-modal-close"
          title="关闭"
          onClick={() => setShow(false)}
        >
          <X size={16} />
        </button>
        <CommentPage />
      </div>
    </div>
  );
}
