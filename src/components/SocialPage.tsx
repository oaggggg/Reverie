import { useEffect, useState } from "react";
import {
  Heart,
  MessageCircle,
  Repeat2,
  Trash2,
} from "lucide-react";
import { useCommentStore } from "../store/commentStore";
import { useExploreStore } from "../store/exploreStore";
import { usePlayerStore } from "../store/playerStore";
import type { SocialEvent } from "../api/types";
import { sizedImage } from "../utils/image";
import { LoadingState, Page, PageHeader } from "./Page";
import ConfirmModal from "./ConfirmModal";

export default function SocialPage() {
  const [pendingDelete, setPendingDelete] = useState<SocialEvent | null>(null);
  const tab = useExploreStore((s) => s.socialTab);
  const events = useExploreStore((s) => s.events);
  const myEvents = useExploreStore((s) => s.myEvents);
  const loading = useExploreStore((s) => s.loading);
  const setTab = useExploreStore((s) => s.setSocialTab);
  const loadSocial = useExploreStore((s) => s.loadSocial);
  const openAlbum = useExploreStore((s) => s.openAlbum);
  const openComments = useCommentStore((s) => s.openResourceComments);
  const toggleEventLike = useExploreStore((s) => s.toggleEventLike);
  const forwardEvent = useExploreStore((s) => s.forwardEvent);
  const deleteEvent = useExploreStore((s) => s.deleteEvent);
  const uid = usePlayerStore((s) => s.profile?.userId ?? 0);
  const displayEvents = tab === "myEvents" ? myEvents : events;

  useEffect(() => {
    void loadSocial();
  }, [loadSocial]);

  return (
    <Page>
      <PageHeader
        title="动态"
        subtitle="查看关注用户和自己的动态"
      />
      <div className="segmented social-tabs">
        <button
          className={tab === "events" ? "active" : ""}
          onClick={() => setTab("events")}
        >
          动态
        </button>
        <button
          className={tab === "myEvents" ? "active" : ""}
          onClick={() => setTab("myEvents")}
        >
          我的动态 {myEvents.length}
        </button>
      </div>
      <div className="event-list">
          {displayEvents.map((event) => (
            <article className="event-row" key={event.id}>
              <img src={sizedImage(event.user.avatarUrl, 100)} alt="" />
              <div className="event-body">
                <div className="event-head">
                  <strong>{event.user.nickname}</strong>
                  <time>{new Date(event.time).toLocaleString()}</time>
                </div>
                <p>{event.text || "分享了一条动态"}</p>
                {event.resourceTitle && (
                  <button
                    className="event-resource"
                    disabled={
                      event.resourceType !== "album" || !event.resourceId
                    }
                    onClick={() =>
                      event.resourceId &&
                      event.resourceType === "album" &&
                      void openAlbum(event.resourceId)
                    }
                  >
                    {event.resourceTitle}
                  </button>
                )}
                <div className="event-stats">
                  <button
                    className={`event-like-button ${event.liked ? "active" : ""}`}
                    onClick={() => void toggleEventLike(event)}
                  >
                    <Heart size={13} /> {event.likedCount}
                  </button>
                  <button
                    className="event-comment-button"
                    disabled={!event.threadId}
                    onClick={() =>
                      event.threadId &&
                      void openComments(
                        {
                          type: "event",
                          id: String(event.id),
                          threadId: event.threadId,
                          title: `${event.user.nickname} 的动态`,
                          subtitle: event.resourceTitle,
                        },
                        true,
                      )
                    }
                  >
                    <MessageCircle size={13} /> 评论 {event.commentCount}
                  </button>
                  <button
                    className="event-forward-button"
                    onClick={() => {
                      const forwards = window.prompt("转发说明（可选）", "");
                      if (forwards !== null) void forwardEvent(event, forwards);
                    }}
                  >
                    <Repeat2 size={13} /> 转发 {event.forwardCount}
                  </button>
                  {uid > 0 && event.user.userId === uid && (
                    <button
                      className="event-delete-button"
                      title="删除动态"
                      onClick={() => {
                        setPendingDelete(event);
                      }}
                    >
                      <Trash2 size={13} /> 删除
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
          {!displayEvents.length &&
            (loading ? (
              <LoadingState label="正在加载动态…" />
            ) : (
              <div className="empty">暂无动态</div>
            ))}
      </div>
      <ConfirmModal
        open={pendingDelete !== null}
        title="删除动态"
        message="确定删除这条动态吗？"
        onClose={() => setPendingDelete(null)}
        onConfirm={() => (pendingDelete ? deleteEvent(pendingDelete) : false)}
      />
    </Page>
  );
}
