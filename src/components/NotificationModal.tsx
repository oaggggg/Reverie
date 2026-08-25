import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AtSign,
  Bell,
  CircleUserRound,
  Mail,
  MessageCircle,
  Send,
  X,
} from "lucide-react";
import type {
  MessageUser,
  NotificationCategory,
  PrivateAttachment,
  PrivateAttachmentType,
} from "../api/types";
import { useNotificationStore } from "../store/notificationStore";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { usePlayerStore } from "../store/playerStore";
import { sizedImage } from "../utils/image";
import { useOriginTransition } from "../utils/originTransition";
import { useModalBehavior } from "../utils/modalBehavior";
import { LoadingState } from "./Page";

const TABS: Array<{
  id: NotificationCategory;
  label: string;
  icon: ReactNode;
}> = [
  { id: "private", label: "私信", icon: <Mail size={15} /> },
  { id: "comments", label: "评论", icon: <MessageCircle size={15} /> },
  { id: "mentions", label: "@我", icon: <AtSign size={15} /> },
  { id: "notices", label: "通知", icon: <Bell size={15} /> },
];

function formatTime(timestamp: number) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Avatar({
  user,
  large = false,
}: {
  user: MessageUser;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return user.avatarUrl && !failed ? (
    <img
      className={large ? "message-avatar large" : "message-avatar"}
      src={sizedImage(user.avatarUrl, large ? 120 : 80)}
      alt=""
      onError={() => setFailed(true)}
    />
  ) : (
    <span
      className={
        large
          ? "message-avatar large placeholder"
          : "message-avatar placeholder"
      }
    >
      <CircleUserRound size={large ? 24 : 18} />
    </span>
  );
}

function PrivateMessages() {
  const conversations = useNotificationStore((state) => state.conversations);
  const active = useNotificationStore((state) => state.activeConversation);
  const messages = useNotificationStore((state) => state.messages);
  const loading = useNotificationStore((state) => state.loading);
  const loadingMore = useNotificationStore((state) => state.loadingMore);
  const conversationHasMore = useNotificationStore(
    (state) => state.conversationHasMore,
  );
  const historyLoading = useNotificationStore((state) => state.historyLoading);
  const historyLoadingMore = useNotificationStore(
    (state) => state.historyLoadingMore,
  );
  const historyHasMore = useNotificationStore((state) => state.historyHasMore);
  const openConversation = useNotificationStore(
    (state) => state.openConversation,
  );
  const loadMore = useNotificationStore((state) => state.loadMore);
  const conversationMoreRef = useInfiniteScroll(
    () => void loadMore(),
    loadingMore || !conversationHasMore,
  );
  const historyMoreRef = useInfiniteScroll(
    () => void loadEarlier(),
    historyLoadingMore || !historyHasMore,
  );
  const loadMoreHistory = useNotificationStore(
    (state) => state.loadMoreHistory,
  );
  const sendMessage = useNotificationStore((state) => state.sendMessage);
  const currentUid = usePlayerStore((state) => state.profile?.userId ?? 0);
  const currentSong = usePlayerStore((state) => state.currentSong);
  const playlistId = usePlayerStore((state) => state.playlistId);
  const playlistName = usePlayerStore((state) => state.playlistName);
  const [draft, setDraft] = useState("");
  const [attachmentType, setAttachmentType] = useState<
    "" | PrivateAttachmentType
  >("");
  const [sending, setSending] = useState(false);
  const messageListRef = useRef<HTMLDivElement>(null);
  const historyScrollRef = useRef<{ height: number; top: number } | null>(null);

  useEffect(() => {
    setDraft("");
    setAttachmentType("");
  }, [active?.user.userId]);

  useLayoutEffect(() => {
    const node = messageListRef.current;
    if (!node) return;
    const saved = historyScrollRef.current;
    if (saved) {
      node.scrollTop = saved.top + node.scrollHeight - saved.height;
      historyScrollRef.current = null;
      return;
    }
    node.scrollTop = node.scrollHeight;
  }, [messages.length, active?.user.userId]);

  const loadEarlier = async () => {
    const node = messageListRef.current;
    const state = useNotificationStore.getState();
    const conversationId = state.activeConversation?.user.userId;
    const messageCount = state.messages.length;
    if (node) {
      historyScrollRef.current = {
        height: node.scrollHeight,
        top: node.scrollTop,
      };
    }
    await loadMoreHistory();
    const nextState = useNotificationStore.getState();
    if (
      nextState.activeConversation?.user.userId !== conversationId ||
      nextState.messages.length <= messageCount
    ) {
      historyScrollRef.current = null;
    }
  };

  const attachments = useMemo(() => {
    const result: PrivateAttachment[] = [];
    if (currentSong) {
      result.push({
        type: "song",
        id: currentSong.id,
        title: currentSong.name,
      });
      if (currentSong.albumId) {
        result.push({
          type: "album",
          id: currentSong.albumId,
          title: currentSong.album,
        });
      }
    }
    if (playlistId) {
      result.push({
        type: "playlist",
        id: playlistId,
        title: playlistName || "当前歌单",
      });
    }
    return result;
  }, [currentSong, playlistId, playlistName]);
  const attachment = attachments.find((item) => item.type === attachmentType);

  const submit = async () => {
    if (sending || (!draft.trim() && !attachment)) return;
    setSending(true);
    const sent = await sendMessage(draft, attachment);
    setSending(false);
    if (sent) {
      setDraft("");
      setAttachmentType("");
    }
  };

  return (
    <div className="message-layout in-modal">
      <aside className="conversation-panel">
        <div className="conversation-heading">
          <strong>会话</strong>
          <span>{conversations.length}</span>
        </div>
        <div className="conversation-list">
          {conversations.map((conversation) => (
            <button
              key={conversation.user.userId}
              className={
                active?.user.userId === conversation.user.userId ? "active" : ""
              }
              onClick={() => void openConversation(conversation)}
            >
              <Avatar user={conversation.user} />
              <span className="conversation-copy">
                <strong>{conversation.user.nickname}</strong>
                <small>{conversation.preview}</small>
              </span>
              <span className="conversation-meta">
                <time>{formatTime(conversation.time)}</time>
                {conversation.unreadCount > 0 && (
                  <b>{Math.min(99, conversation.unreadCount)}</b>
                )}
              </span>
            </button>
          ))}
          {!conversations.length &&
            (loading ? (
              <LoadingState label="正在加载私信…" />
            ) : (
              <div className="empty">暂无私信会话</div>
            ))}
        </div>
        {conversationHasMore && (
          <div ref={conversationMoreRef} className="load-more-sentinel" />
        )}
      </aside>

      <section className="message-thread">
        {active ? (
          <>
            <header className="message-thread-header">
              <Avatar user={active.user} />
              <div>
                <strong>{active.user.nickname}</strong>
                <span>网易云私信</span>
              </div>
            </header>
            <div className="message-thread-list" ref={messageListRef}>
              {historyHasMore && (
                <div ref={historyMoreRef} className="load-more-sentinel" />
              )}
              {historyLoading ? (
                <LoadingState label="正在加载会话…" />
              ) : messages.length ? (
                messages.map((message) => {
                  const mine = message.fromUserId === currentUid;
                  return (
                    <div
                      className={`message-bubble-row ${mine ? "mine" : ""}`}
                      key={message.id}
                    >
                      <div className="message-bubble">
                        <p>{message.content}</p>
                        {message.resourceTitle && (
                          <span>{message.resourceTitle}</span>
                        )}
                        <time>{formatTime(message.time)}</time>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="empty">暂无历史消息</div>
              )}
            </div>
            <div className="message-composer">
              <div className="message-composer-tools">
                <select
                  value={attachmentType}
                  onChange={(event) =>
                    setAttachmentType(
                      event.target.value as "" | PrivateAttachmentType,
                    )
                  }
                  title="附加当前播放内容"
                >
                  <option value="">纯文字</option>
                  {attachments.map((item) => (
                    <option key={`${item.type}-${item.id}`} value={item.type}>
                      {item.type === "song"
                        ? "分享当前歌曲"
                        : item.type === "playlist"
                          ? "分享当前歌单"
                          : "分享当前专辑"}
                    </option>
                  ))}
                </select>
                {attachment && <span>{attachment.title}</span>}
              </div>
              <div className="message-composer-input">
                <textarea
                  value={draft}
                  maxLength={500}
                  placeholder="输入私信内容"
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    // IME 组词期间的 Enter 是确认候选词，不能触发发送。
                    if (event.nativeEvent.isComposing) return;
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void submit();
                    }
                  }}
                />
                <button
                  className="btn primary"
                  title="发送"
                  disabled={sending || (!draft.trim() && !attachment)}
                  onClick={() => void submit()}
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="message-thread-empty">
            <Mail size={30} />
            <span>选择一个会话查看私信</span>
          </div>
        )}
      </section>
    </div>
  );
}

function NotificationFeed() {
  const items = useNotificationStore((state) => state.items);
  const loading = useNotificationStore((state) => state.loading);
  const loadingMore = useNotificationStore((state) => state.loadingMore);
  const hasMore = useNotificationStore((state) => state.hasMore);
  const loadMore = useNotificationStore((state) => state.loadMore);
  const feedMoreRef = useInfiniteScroll(
    () => void loadMore(),
    loadingMore || !hasMore,
  );
  if (!items.length) {
    return loading ? (
      <LoadingState label="正在加载通知…" />
    ) : (
      <div className="empty">暂无通知</div>
    );
  }
  return (
    <div className="notification-feed in-modal">
      {items.map((item) => (
        <article key={item.id}>
          {item.user ? (
            <Avatar user={item.user} large />
          ) : (
            <span className="message-avatar large placeholder">
              <Bell size={22} />
            </span>
          )}
          <div>
            <div className="notification-heading">
              <strong>{item.title}</strong>
              <time>{formatTime(item.time)}</time>
            </div>
            <p>{item.content}</p>
            {item.resourceTitle && (
              <span className="notification-resource">
                {item.resourceTitle}
              </span>
            )}
          </div>
        </article>
      ))}
      {hasMore && <div ref={feedMoreRef} className="load-more-sentinel" />}
    </div>
  );
}

export default function NotificationModal() {
  const showNotifications = usePlayerStore((s) => s.showNotifications);
  const setShowNotifications = usePlayerStore((s) => s.setShowNotifications);
  const category = useNotificationStore((state) => state.category);
  const unreadTotal = useNotificationStore((state) => state.unreadTotal);
  const total = useNotificationStore((state) => state.total);
  const conversationTotal = useNotificationStore(
    (state) => state.conversationTotal,
  );
  const setCategory = useNotificationStore((state) => state.setCategory);

  const transition = useOriginTransition(
    showNotifications,
    "notifications-modal",
    220,
  );
  useModalBehavior(
    showNotifications,
    transition.surfaceRef,
    () => setShowNotifications(false),
  );

  if (!transition.rendered) return null;

  // 从弹窗跳转「我的评论」页面：先收起弹窗再切换视图。
  const openCommentHistory = () => {
    setShowNotifications(false);
    const player = usePlayerStore.getState();
    const previous = player.activeView;
    player.setPage("browse");
    usePlayerStore.setState({
      activeView: "commentHistory",
      prevView: previous === "commentHistory" ? "home" : previous,
    });
  };

  return (
    <div
      className={`modal-backdrop ${transition.backdropClassName}`}
      onClick={() => setShowNotifications(false)}
    >
      <div
        ref={transition.surfaceRef}
        className={`modal notification-modal ${transition.surfaceClassName}`}
        role="dialog"
        aria-modal="true"
        aria-label="消息中心"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="notification-modal-head">
          <h2>{unreadTotal > 0 ? `消息中心 · ${unreadTotal} 条未读` : "消息中心"}</h2>
          <span className="notification-modal-sub">
            {category === "private"
              ? `${conversationTotal} 个私信会话`
              : `${total} 条消息`}
          </span>
          <div className="notification-modal-actions">
            <button className="btn" onClick={openCommentHistory}>
              我的评论
            </button>
            <button
              className="topnav-icon-btn"
              title="关闭"
              onClick={() => setShowNotifications(false)}
            >
              <X size={16} />
            </button>
          </div>
        </header>
        <div className="notification-tabs" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={category === tab.id}
              className={category === tab.id ? "active" : ""}
              onClick={() => void setCategory(tab.id)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
        <div className="notification-modal-body">
          {category === "private" ? <PrivateMessages /> : <NotificationFeed />}
        </div>
      </div>
    </div>
  );
}
