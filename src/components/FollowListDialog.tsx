import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { UserMinus, UserPlus, Users, X } from "lucide-react";
import { useExploreStore } from "../store/exploreStore";
import { sizedImage } from "../utils/image";
import { useModalBehavior } from "../utils/modalBehavior";

type FollowListType = "follows" | "followers";

export default function FollowListDialog({
  type,
  onClose,
}: {
  type: FollowListType;
  onClose: () => void;
}) {
  const users = useExploreStore((state) =>
    type === "follows" ? state.follows : state.followers,
  );
  const loading = useExploreStore((state) => state.loading);
  const loadSocial = useExploreStore((state) => state.loadSocial);
  const toggleFollow = useExploreStore((state) => state.toggleFollow);
  const surfaceRef = useRef<HTMLElement>(null);
  useModalBehavior(true, surfaceRef, onClose);

  useEffect(() => {
    void loadSocial(false);
  }, [loadSocial]);

  return createPortal(
    <div className="modal-backdrop follow-list-backdrop" onMouseDown={onClose}>
      <section
        ref={surfaceRef}
        className="modal follow-list-modal"
        role="dialog"
        aria-modal="true"
        aria-label={type === "follows" ? "关注" : "粉丝"}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-head">
          <div>
            <h2>
              <Users size={18} /> {type === "follows" ? "关注" : "粉丝"}
            </h2>
            <p>{type === "follows" ? "你关注的用户" : "关注你的用户"}</p>
          </div>
          <button className="modal-close" title="关闭" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="follow-list">
          {loading && !users.length ? (
            <div className="empty">正在加载…</div>
          ) : users.length ? (
            users.map((user) => (
              <article className="follow-list-row" key={user.userId}>
                <img src={sizedImage(user.avatarUrl, 80)} alt="" />
                <div>
                  <strong>{user.nickname}</strong>
                  <span>
                    {user.signature || "这个人很安静，还没有留下简介"}
                  </span>
                </div>
                <button
                  className={`btn ${user.followed ? "" : "primary"}`}
                  onClick={() => void toggleFollow(user)}
                >
                  {user.followed ? (
                    <UserMinus size={14} />
                  ) : (
                    <UserPlus size={14} />
                  )}
                  {user.followed ? "取消关注" : "关注"}
                </button>
              </article>
            ))
          ) : (
            <div className="empty">暂无用户</div>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}
