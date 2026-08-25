import { request } from "./client.ts";
import type { TopicEvent, TopicInfo } from "./types.ts";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value && typeof value === "object" ? (value as Obj) : {};

function list(response: Obj, ...keys: string[]): unknown[] {
  const candidates = [
    response,
    obj(response.data),
    obj(response.result),
    obj(response.topic),
  ];
  for (const candidate of candidates) {
    for (const key of keys) {
      if (Array.isArray(candidate[key])) return candidate[key] as unknown[];
    }
  }
  return Array.isArray(response.data) ? response.data : [];
}

function normalizeTopic(raw: unknown): TopicInfo | null {
  const value = obj(raw);
  const id = Number(
    value.actId ?? value.actid ?? value.id ?? value.topicId ?? 0,
  );
  const title = String(
    value.title ?? value.name ?? value.topicName ?? "",
  ).trim();
  if (!Number.isSafeInteger(id) || id <= 0 || !title) return null;
  return {
    id,
    title,
    description: String(value.description ?? value.desc ?? value.content ?? ""),
    coverUrl: String(value.coverUrl ?? value.cover ?? value.picUrl ?? ""),
    participateCount: Number(
      value.participateCount ?? value.participantCount ?? 0,
    ),
    shareCount: Number(value.shareCount ?? value.shareCnt ?? 0),
  };
}

function normalizeEvent(raw: unknown, index: number): TopicEvent {
  const value = obj(raw);
  const user = obj(value.user ?? value.creator ?? value.userInfo);
  return {
    id: String(value.id ?? value.eventId ?? `${index}-${value.time ?? 0}`),
    text: String(value.content ?? value.text ?? value.msg ?? "分享了一条动态"),
    creatorName: String(
      user.nickname ?? user.name ?? value.nickname ?? "网易云用户",
    ),
    creatorAvatar: String(
      user.avatarUrl ?? user.avatar ?? value.avatarUrl ?? "",
    ),
    time: Number(value.time ?? value.createTime ?? value.eventTime ?? 0),
    likedCount: Number(value.likedCount ?? value.likeCount ?? 0),
    commentCount: Number(value.commentCount ?? value.commentCountAll ?? 0),
  };
}

function uniqueTopics(items: TopicInfo[]): TopicInfo[] {
  const seen = new Set<number>();
  return items.filter((item) =>
    seen.has(item.id) ? false : (seen.add(item.id), true),
  );
}

export async function getHotTopics(
  limit = 20,
  offset = 0,
): Promise<TopicInfo[]> {
  const response = await request<Obj>("/hot/topic", { limit, offset }, false);
  return uniqueTopics(
    list(response, "data", "topics", "list")
      .map(normalizeTopic)
      .filter((item): item is TopicInfo => item !== null),
  );
}

export async function getSubscribedTopics(
  limit = 50,
  offset = 0,
): Promise<TopicInfo[]> {
  const response = await request<Obj>(
    "/topic/sublist",
    { limit, offset, total: true },
    false,
  );
  return uniqueTopics(
    list(response, "data", "topics", "list")
      .map(normalizeTopic)
      .filter((item): item is TopicInfo => item !== null),
  );
}

export async function getTopicDetail(id: number): Promise<TopicInfo> {
  const response = await request<Obj>("/topic/detail", { actid: id }, false);
  return (
    normalizeTopic(response.topic ?? response.data ?? response) ?? {
      id,
      title: "话题",
      description: "",
      coverUrl: "",
      participateCount: 0,
      shareCount: 0,
    }
  );
}

export async function getTopicHotEvents(id: number): Promise<TopicEvent[]> {
  const response = await request<Obj>(
    "/topic/detail/event/hot",
    { actid: id },
    false,
  );
  return list(response, "events", "event", "data", "list").map(normalizeEvent);
}
