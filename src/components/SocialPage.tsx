import { useEffect } from "react";
import {
  Heart,
  MessageCircle,
  Repeat2,
  UserMinus,
  UserPlus,
  Trash2,
} from "lucide-react";
import type { SocialUser } from "../api/types";
import { useCommentStore } from "../store/commentStore";
import { useExploreStore } from "../store/exploreStore";
import { usePlayerStore } from "../store/playerStore";
import { sizedImage } from "../utils/image";
import { LoadingState, Page, PageHeader } from "./Page";

function UserList({ users }: { users: SocialUser[] }) {
  const toggleFollow = useExploreStore((s) => s.toggleFollow);
  return (
    <div className="social-user-list">
      {users.map((user) => (
        <article className="social-user" key={user.userId}>
          <img src={sizedImage(user.avatarUrl, 100)} alt="" />
          <div>
            <strong>{user.nickname}</strong>
            <p>{user.signature || "这个人很安静，还没有留下简介"}</p>
          </div>
          <button
            className={`btn ${user.followed ? "" : "primary"}`}
            onClick={() => void toggleFollow(user)}
          >
            {user.followed ? <UserMinus size={14} /> : <UserPlus size={14} />}
            {user.followed ? "取消关注" : "关注"}
          </button>
        </article>
      ))}
      {!users.length && <div className="empty">暂无用户</div>}
    </div>
  );
}

export default function SocialPage() {
  const tab = useExploreStore((s) => s.socialTab);
  const events = useExploreStore((s) => s.events);
  const myEvents = useExploreStore((s) => s.myEvents);
  const followScene = useExploreStore((s) => s.followScene);
  const follows = useExploreStore((s) => s.follows);
  const followers = useExploreStore((s) => s.followers);
  const loading = useExploreStore((s) => s.loading);
  const setTab = useExploreStore((s) => s.setSocialTab);
  const setFollowScene = useExploreStore((s) => s.setFollowScene);
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
        title="动态与关注"
        subtitle="查看关注用户的动态"
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
      {tab === "follows" ? (
        <>
          <label className="social-follow-filter">
            关注范围
            <select
              value={followScene}
              onChange={(event) => void setFollowScene(Number(event.target.value) as 0 | 1 | 2)}
            >
              <option value={0}>全部</option>
              <option value={1}>歌手</option>
              <option value={2}>用户</option>
            </select>
          </label>
          <UserList users={follows} />
        </>
      ) : tab === "followers" ? (
        <UserList users={followers} />
      ) : (
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
                        if (window.confirm("确定删除这条动态吗？")) void deleteEvent(event);
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
      )}
    </Page>
  );
}
