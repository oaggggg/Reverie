import { request } from "./client.ts";
import type {
  CommentInfo,
  CommentResource,
  CommentResourceType,
  CommentSort,
} from "./types.ts";

type Obj = Record<string, unknown>;

const obj = (value: unknown): Obj =>
  value && typeof value === "object" ? (value as Obj) : {};
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const RESOURCE_TYPES: Record<CommentResourceType, number> = {
  song: 0,
  mv: 1,
  playlist: 2,
  album: 3,
  program: 4,
  video: 5,
  event: 6,
};

const SORT_TYPES: Record<CommentSort, 99 | 2 | 3> = {
  recommended: 99,
  hot: 2,
  new: 3,
};

const LEGACY_COMMENT_ROUTES: Partial<Record<CommentResourceType, string>> = {
  song: "/comment/music",
  mv: "/comment/mv",
  playlist: "/comment/playlist",
  album: "/comment/album",
  program: "/comment/dj",
  video: "/comment/video",
};

const hugRequests = new Map<string, Promise<void>>();

function ensureSuccess(response: Obj, path: string): Obj {
  const code = Number(response.code ?? 200);
  if (code !== 200) throw new Error(`${path} 返回业务码 ${code}`);
  return response;
}

export function normalizeResourceComment(raw: unknown): CommentInfo {
  const value = obj(raw);
  const user = obj(value.user);
  const replied = obj(arr(value.beReplied)[0]);
  const repliedUser = obj(replied.user);
  const replyCount = Number(
    value.replyCount ?? obj(value.showFloorComment).replyCount ?? 0,
  );
  return {
    id: Number(value.commentId ?? value.id ?? 0),
    content: String(value.content ?? ""),
    time: Number(value.time ?? 0),
    liked: Boolean(value.liked),
    likedCount: Number(value.likedCount ?? 0),
    replyCount,
    owner: Boolean(value.owner),
    userId: Number(user.userId ?? 0),
    nickname: String(user.nickname ?? "网易云用户"),
    avatarUrl: String(user.avatarUrl ?? ""),
    repliedTo: replied.content
      ? {
          userId: Number(repliedUser.userId ?? 0),
          nickname: String(repliedUser.nickname ?? "网易云用户"),
          content: String(replied.content ?? ""),
        }
      : undefined,
  };
}

function resourceParams(resource: CommentResource) {
  return {
    id: resource.id,
    type: RESOURCE_TYPES[resource.type],
    threadId: resource.threadId,
  };
}

export interface CommentResultPage {
  comments: CommentInfo[];
  total: number;
  hasMore: boolean;
  cursor: string;
}

/** Read the authoritative comment total without loading a comment page. */
export async function getResourceCommentCount(
  resource: CommentResource,
): Promise<number> {
  try {
    const response = ensureSuccess(
      await request<Obj>("/comment/count", {
        id: resource.id,
        type: RESOURCE_TYPES[resource.type],
      }),
      "/comment/count",
    );
    const data = obj(response.data);
    const rawCount =
      response.commentCount ??
        response.total ??
        response.count ??
        data.commentCount ??
        data.totalCount ??
        data.total;
    const count = Number(rawCount);
    if (rawCount !== undefined && Number.isFinite(count))
      return Math.max(0, count);
  } catch {
    // Older sidecars do not expose /comment/count; use the compatible list API.
  }
  const fallback = await getResourceComments(resource, 1, "hot", "", 1);
  return Math.max(0, Number(fallback.total) || 0);
}

export async function getResourceComments(
  resource: CommentResource,
  pageNo = 1,
  sort: CommentSort = "recommended",
  cursor = "",
  pageSize = 30,
): Promise<CommentResultPage> {
  if (resource.type === "event" && resource.threadId) {
    const response = ensureSuccess(
      await request<Obj>("/comment/event", {
        threadId: resource.threadId,
        limit: pageSize,
        offset: (pageNo - 1) * pageSize,
      }),
      "/comment/event",
    );
    return {
      comments: arr(response.comments).map(normalizeResourceComment),
      total: Number(response.total ?? response.count ?? 0),
      hasMore: Boolean(response.more ?? response.hasMore),
      cursor: "",
    };
  }

  let response: Obj;
  try {
    response = ensureSuccess(
      await request<Obj>("/comment/new", {
        ...resourceParams(resource),
        pageNo,
        pageSize,
        sortType: SORT_TYPES[sort],
        cursor: sort === "new" ? cursor || "0" : undefined,
      }),
      "/comment/new",
    );
  } catch (error) {
    const legacy = LEGACY_COMMENT_ROUTES[resource.type];
    if (!legacy) throw error;
    response = ensureSuccess(
      await request<Obj>(legacy, {
        id: resource.id,
        limit: pageSize,
        offset: (pageNo - 1) * pageSize,
        before: cursor || undefined,
      }),
      legacy,
    );
  }
  const data = obj(response.data);
  const legacyComments = arr(
    response.comments ?? data.comments ?? response.hotComments,
  );
  return {
    comments: legacyComments.map(normalizeResourceComment),
    total: Number(
      data.totalCount ??
        data.total ??
        response.total ??
        response.cnum ??
        data.cnum ??
        legacyComments.length,
    ),
    hasMore: Boolean(data.hasMore ?? response.more),
    cursor: String(data.cursor ?? response.cursor ?? ""),
  };
}

export async function getHotResourceComments(
  resource: CommentResource,
  limit = 20,
  offset = 0,
): Promise<CommentInfo[]> {
  const response = ensureSuccess(
    await request<Obj>("/comment/hot", {
      id: resource.id,
      type: RESOURCE_TYPES[resource.type],
      limit,
      offset,
    }),
    "/comment/hot",
  );
  return arr(
    response.hotComments ?? response.comments ?? obj(response.data).comments,
  ).map(normalizeResourceComment);
}

export async function hugComment(
  resource: CommentResource,
  comment: CommentInfo,
): Promise<void> {
  const key = `${resource.type}:${resource.id}:${comment.id}:${comment.userId}`;
  const running = hugRequests.get(key);
  if (running) return running;
  const run = request(
    "/hug/comment",
    {
      uid: comment.userId,
      cid: comment.id,
      sid: resource.id,
      type: RESOURCE_TYPES[resource.type],
    },
    false,
    { retry: true, timeoutMs: 12_000 },
  )
    .then((response) => {
      ensureSuccess(response as Obj, "/hug/comment");
    })
    .finally(() => {
      if (hugRequests.get(key) === run) hugRequests.delete(key);
    });
  hugRequests.set(key, run);
  return run;
}

export async function getCommentHugList(
  resource: CommentResource,
  comment: CommentInfo,
  page = 1,
): Promise<CommentInfo[]> {
  const response = ensureSuccess(
    await request<Obj>("/comment/hug/list", {
      uid: comment.userId,
      cid: comment.id,
      sid: resource.id,
      type: RESOURCE_TYPES[resource.type],
      page,
    }),
    "/comment/hug/list",
  );
  return arr(response.data ?? response.list ?? response.users).map(
    normalizeResourceComment,
  );
}

export async function getCommentReplies(
  resource: CommentResource,
  parentCommentId: string | number,
  time = -1,
  limit = 20,
): Promise<{
  comments: CommentInfo[];
  hasMore: boolean;
  time: number;
}> {
  const response = ensureSuccess(
    await request<Obj>("/comment/floor", {
      ...resourceParams(resource),
      parentCommentId,
      time,
      limit,
    }),
    "/comment/floor",
  );
  const data = obj(response.data);
  return {
    comments: arr(data.comments).map(normalizeResourceComment),
    hasMore: Boolean(data.hasMore),
    time: Number(data.time ?? -1),
  };
}

export async function sendResourceComment(
  resource: CommentResource,
  content: string,
  replyTo?: string | number,
): Promise<void> {
  ensureSuccess(
    await request<Obj>(
      "/comment",
      {
        ...resourceParams(resource),
        t: replyTo ? 2 : 1,
        content,
        commentId: replyTo,
      },
      false,
    ),
    "/comment",
  );
}

export async function deleteResourceComment(
  resource: CommentResource,
  commentId: string | number,
): Promise<void> {
  ensureSuccess(
    await request<Obj>(
      "/comment",
      {
        ...resourceParams(resource),
        t: 0,
        commentId,
      },
      false,
    ),
    "/comment",
  );
}

export async function likeResourceComment(
  resource: CommentResource,
  commentId: string | number,
  like: boolean,
): Promise<void> {
  ensureSuccess(
    await request<Obj>(
      "/comment/like",
      {
        ...resourceParams(resource),
        cid: commentId,
        t: like ? 1 : 0,
      },
      false,
    ),
    "/comment/like",
  );
}
