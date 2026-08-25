import { request } from "./client.ts";
import type {
  MessageUser,
  NotificationCategory,
  NotificationItem,
  PrivateAttachment,
  PrivateConversation,
  PrivateMessage,
} from "./types.ts";

type Obj = Record<string, unknown>;

const obj = (value: unknown): Obj =>
  value && typeof value === "object" ? (value as Obj) : {};
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export interface NotificationCounts {
  private: number;
  comments: number;
  forwards: number;
  notices: number;
  total: number;
}

/** Read the account-wide unread counters exposed by `/pl/count`. */
export async function getNotificationCounts(): Promise<NotificationCounts> {
  const response = await request<Obj>("/pl/count", {}, false);
  const value = obj(response.data ?? response.result ?? response);
  const counts = {
    private: Number(
      value.private ??
        value.privateMsgCount ??
        value.privateCount ??
        value.msg ??
        0,
    ),
    comments: Number(
      value.comment ?? value.comments ?? value.commentCount ?? 0,
    ),
    forwards: Number(
      value.forward ?? value.forwards ?? value.forwardCount ?? 0,
    ),
    notices: Number(value.notice ?? value.notices ?? value.noticeCount ?? 0),
    total: 0,
  };
  counts.total = Number(
    value.total ??
      counts.private + counts.comments + counts.forwards + counts.notices,
  );
  return counts;
}

function ensureSuccess(response: Obj, path: string): Obj {
  const code = Number(response.code ?? 200);
  if (code !== 200) throw new Error(`${path} 返回业务码 ${code}`);
  return response;
}

function parseJson(value: unknown): Obj {
  if (typeof value !== "string") return obj(value);
  try {
    return obj(JSON.parse(value));
  } catch {
    return {};
  }
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value))
      return String(value);
  }
  return "";
}

function normalizeUser(raw: unknown): MessageUser {
  const value = obj(raw);
  return {
    userId: Number(value.userId ?? value.id ?? 0),
    nickname:
      firstText(value.nickname, value.userName, value.name) || "网易云用户",
    avatarUrl: firstText(value.avatarUrl, value.avatar),
  };
}

function parsePayload(raw: unknown): {
  content: string;
  resourceTitle?: string;
  resourceType?: PrivateAttachment["type"];
  resourceId?: number;
} {
  const parsed = parseJson(raw);
  const general = parseJson(parsed.generalMsg);
  const value = Object.keys(general).length
    ? { ...parsed, ...general }
    : parsed;
  const nested = parseJson(value.msg);
  const source = Object.keys(nested).length ? { ...value, ...nested } : value;
  let content = firstText(
    source.msg,
    source.message,
    source.content,
    source.text,
    source.notice,
    typeof raw === "string" && !Object.keys(parsed).length ? raw : "",
  );
  const candidates: Array<[string, PrivateAttachment["type"]]> = [
    ["song", "song"],
    ["playlist", "playlist"],
    ["album", "album"],
  ];
  for (const [key, type] of candidates) {
    const resource = obj(source[key]);
    const id = Number(resource.id ?? 0);
    const title = firstText(resource.name, resource.title);
    if (id > 0 || title) {
      if (!content)
        content = `分享了${type === "song" ? "歌曲" : type === "playlist" ? "歌单" : "专辑"}`;
      return {
        content,
        resourceTitle: title || "分享内容",
        resourceType: type,
        resourceId: id || undefined,
      };
    }
  }
  return { content: content || "收到一条新消息" };
}

function conversationFromMessage(
  raw: unknown,
  currentUid: number,
): PrivateConversation {
  const value = obj(raw);
  const from = normalizeUser(value.fromUser);
  const to = normalizeUser(value.toUser);
  const user = from.userId === currentUid && to.userId ? to : from;
  const payload = parsePayload(value.lastMsg ?? value.msg);
  return {
    user,
    preview: payload.resourceTitle
      ? `${payload.content} · ${payload.resourceTitle}`
      : payload.content,
    time: Number(value.lastMsgTime ?? value.time ?? 0),
    unreadCount: Number(value.newMsgCount ?? value.unreadCount ?? 0),
  };
}

export async function getPrivateConversations(
  currentUid: number,
  limit = 30,
  offset = 0,
): Promise<{
  conversations: PrivateConversation[];
  total: number;
  hasMore: boolean;
}> {
  const [messages, contacts] = await Promise.all([
    request<Obj>("/msg/private", { limit, offset }).then((response) =>
      ensureSuccess(response, "/msg/private"),
    ),
    offset === 0
      ? request<Obj>("/msg/recentcontact", {})
          .then((response) => ensureSuccess(response, "/msg/recentcontact"))
          .catch(() => ({}) as Obj)
      : Promise.resolve({} as Obj),
  ]);
  const conversations = arr(messages.msgs)
    .map((item) => conversationFromMessage(item, currentUid))
    .filter((item) => item.user.userId > 0);
  const known = new Set(conversations.map((item) => item.user.userId));
  for (const raw of arr(obj(contacts.data).follow)) {
    const user = normalizeUser(raw);
    if (!user.userId || known.has(user.userId)) continue;
    known.add(user.userId);
    conversations.push({
      user,
      preview: "最近联系人",
      time: 0,
      unreadCount: 0,
    });
  }
  return {
    conversations,
    total: Number(messages.total ?? conversations.length),
    hasMore: Boolean(messages.more ?? messages.hasMore),
  };
}

export async function getPrivateHistory(
  uid: number,
  limit = 30,
  before = 0,
): Promise<{ messages: PrivateMessage[]; hasMore: boolean }> {
  const response = ensureSuccess(
    await request<Obj>("/msg/private/history", {
      uid,
      limit,
      before: before || undefined,
    }),
    "/msg/private/history",
  );
  const messages = arr(response.msgs)
    .map((raw) => {
      const value = obj(raw);
      const from = normalizeUser(value.fromUser);
      const to = normalizeUser(value.toUser);
      const payload = parsePayload(value.msg ?? value.lastMsg);
      const time = Number(value.time ?? value.lastMsgTime ?? 0);
      return {
        id: String(value.id ?? value.msgId ?? `${from.userId}-${time}`),
        fromUserId: from.userId,
        toUserId: to.userId,
        content: payload.content,
        time,
        resourceTitle: payload.resourceTitle,
        resourceType: payload.resourceType,
        resourceId: payload.resourceId,
      } satisfies PrivateMessage;
    })
    .sort((left, right) => left.time - right.time);
  return {
    messages,
    hasMore: Boolean(response.more ?? response.hasMore),
  };
}

export async function sendPrivateMessage(
  uid: number,
  content: string,
  attachment?: PrivateAttachment,
): Promise<void> {
  if (!attachment) {
    ensureSuccess(
      await request<Obj>("/send/text", { user_ids: uid, msg: content }, false),
      "/send/text",
    );
    return;
  }
  if (attachment.type === "playlist") {
    ensureSuccess(
      await request<Obj>(
        "/send/playlist",
        { user_ids: uid, playlist: attachment.id, msg: content },
        false,
      ),
      "/send/playlist",
    );
    return;
  }
  const path = attachment.type === "song" ? "/send/song" : "/send/album";
  ensureSuccess(
    await request<Obj>(
      path,
      { user_ids: uid, id: attachment.id, msg: content },
      false,
    ),
    path,
  );
}

function normalizeNotification(
  raw: unknown,
  category: Exclude<NotificationCategory, "private">,
): NotificationItem {
  const value = obj(raw);
  const comment = obj(value.comment);
  const rawPayload = category === "notices" ? value.notice : value.json;
  const payload = parseJson(rawPayload);
  const user = normalizeUser(
    value.user ?? comment.user ?? payload.user ?? obj(payload.event).user,
  );
  const parsed = parsePayload(rawPayload ?? value.content ?? comment.content);
  const resource = obj(value.resourceInfo ?? payload.resource);
  const content =
    category === "comments"
      ? firstText(comment.content, value.content, value.beRepliedContent)
      : parsed.content;
  const title =
    category === "comments"
      ? `${user.nickname} 回复了你的评论`
      : category === "mentions"
        ? `${user.nickname} 提到了你`
        : firstText(value.title, payload.title) || "系统通知";
  const time = Number(value.time ?? comment.time ?? payload.time ?? 0);
  return {
    id: String(
      value.id ?? value.commentId ?? value.noticeId ?? `${category}-${time}`,
    ),
    user: user.userId ? user : null,
    title,
    content: content || "暂无消息内容",
    time,
    resourceTitle:
      firstText(resource.name, resource.title, parsed.resourceTitle) ||
      undefined,
  };
}

export async function getNotifications(
  category: Exclude<NotificationCategory, "private">,
  uid: number,
  limit = 30,
  cursor = 0,
): Promise<{
  items: NotificationItem[];
  total: number;
  hasMore: boolean;
  nextCursor: number;
}> {
  const path =
    category === "comments"
      ? "/msg/comments"
      : category === "mentions"
        ? "/msg/forwards"
        : "/msg/notices";
  const params =
    category === "comments"
      ? { uid, limit, before: cursor || undefined }
      : category === "mentions"
        ? { limit, offset: cursor }
        : { limit, lasttime: cursor || -1 };
  const response = ensureSuccess(await request<Obj>(path, params), path);
  const rawItems =
    category === "comments"
      ? arr(response.comments)
      : category === "mentions"
        ? arr(response.forwards)
        : arr(response.notices);
  const items = rawItems.map((item) => normalizeNotification(item, category));
  const nextCursor =
    category === "mentions"
      ? cursor + items.length
      : items.length
        ? items[items.length - 1].time
        : cursor;
  return {
    items,
    total: Number(response.total ?? response.count ?? items.length),
    hasMore: Boolean(response.more ?? response.hasMore),
    nextCursor,
  };
}
