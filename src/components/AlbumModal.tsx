import { X } from "lucide-react";
import { usePlayerStore } from "../store/playerStore";
import { useOriginTransition } from "../utils/originTransition";
import { useModalBehavior } from "../utils/modalBehavior";
import AlbumPage from "./AlbumPage";

/** 专辑详情弹窗：复用专辑页面组件，仅在外层套弹窗壳（隐藏返回按钮）。 */
export default function AlbumModal() {
  const show = usePlayerStore((s) => s.showAlbumModal);
  const setShow = usePlayerStore((s) => s.setShowAlbumModal);

  const transition = useOriginTransition(show, "album-detail-modal", 220);
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
        aria-label="专辑详情"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="topnav-icon-btn detail-modal-close"
          title="关闭"
          onClick={() => setShow(false)}
        >
          <X size={16} />
        </button>
        <AlbumPage />
      </div>
    </div>
  );
}
