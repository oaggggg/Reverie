import { request } from "./client.ts";
import type {
  BroadcastCategory,
  PodcastProgramRank,
  PodcastSubscriber,
  PodcastProgramDetail,
  RadioInfo,
} from "./types.ts";
import { normalizeSong } from "./client.ts";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value && typeof value === "object" ? (value as Obj) : {};
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export async function getPodcastToplist(
  type: "new" | "hot" = "new",
  limit = 30,
  offset = 0,
): Promise<RadioInfo[]> {
  const response = await request<Obj>("/dj/toplist", {
    type,
    limit,
    offset,
  });
  const value = obj(response.data ?? response.result ?? response);
  return arr(value.list ?? value.djRadios ?? response.data ?? response)
    .map((raw) => {
      const item = obj(raw);
      const dj = obj(item.dj);
      return {
        id: Number(item.id ?? item.rid ?? 0),
        name: String(item.name ?? item.radioName ?? "播客电台"),
        picUrl: String(
          item.picUrl ?? item.intervenePicUrl ?? item.coverUrl ?? "",
        ),
        description: String(item.desc ?? item.description ?? ""),
        programCount: Number(item.programCount ?? 0),
        subscriberCount: Number(item.subCount ?? item.subscriberCount ?? 0),
        subscribed: Boolean(item.subscribed ?? false),
        category: String(item.category ?? item.categoryName ?? ""),
        djName: String(dj.nickname ?? item.djName ?? ""),
      } satisfies RadioInfo;
    })
    .filter((item) => item.id > 0);
}
function normalizeRadioList(response: Obj): RadioInfo[] {
  const value = obj(response.data ?? response.result ?? response);
  return arr(value.list ?? value.djRadios ?? response.data ?? response)
    .map((raw) => {
      const item = obj(raw);
      const dj = obj(item.dj);
      return {
        id: Number(item.id ?? item.rid ?? 0),
        name: String(item.name ?? item.radioName ?? "播客电台"),
        picUrl: String(
          item.picUrl ?? item.intervenePicUrl ?? item.coverUrl ?? "",
        ),
        description: String(item.desc ?? item.description ?? ""),
        programCount: Number(item.programCount ?? 0),
        subscriberCount: Number(item.subCount ?? item.subscriberCount ?? 0),
        subscribed: Boolean(item.subscribed ?? false),
        category: String(item.category ?? item.categoryName ?? ""),
        djName: String(dj.nickname ?? item.djName ?? ""),
      } satisfies RadioInfo;
    })
    .filter((item) => item.id > 0);
}

export async function getPodcastCategories(): Promise<BroadcastCategory[]> {
  const response = await request<Obj>("/dj/catelist", {}, false);
  const value = obj(response.data ?? response.result ?? response);
  return arr(
    value.categories ?? value.list ?? response.categories ?? response.data,
  )
    .map((raw) => {
      const item = obj(raw);
      return {
        id: Number(item.id ?? item.categoryId ?? 0),
        name: String(item.name ?? item.categoryName ?? ""),
      };
    })
    .filter((item) => item.id > 0 && item.name);
}

export async function getPodcastExcludeHotCategories(): Promise<
  BroadcastCategory[]
> {
  const response = await request<Obj>("/dj/category/excludehot", {}, false);
  const value = obj(response.data ?? response.result ?? response);
  return arr(
    value.categories ?? value.list ?? response.categories ?? response.data,
  )
    .map((raw) => {
      const item = obj(raw);
      return {
        id: Number(item.id ?? item.categoryId ?? 0),
        name: String(item.name ?? item.categoryName ?? ""),
      };
    })
    .filter((item) => item.id > 0 && item.name);
}

export async function getPodcastHomeCategoryRecommendations(): Promise<
  RadioInfo[]
> {
  return normalizeRadioList(
    await request<Obj>("/dj/category/recommend", {}, false),
  );
}

export async function getPodcastCategoryRecommendations(
  categoryId: number,
): Promise<RadioInfo[]> {
  const response = await request<Obj>(
    "/dj/recommend/type",
    { type: categoryId },
    false,
  );
  return normalizeRadioList(response);
}

export async function getPodcastHotRadios(
  categoryId?: number,
  limit = 30,
  offset = 0,
): Promise<RadioInfo[]> {
  const response = await request<Obj>(
    "/dj/radio/hot",
    { cateId: categoryId, limit, offset },
    false,
  );
  return normalizeRadioList(response);
}

export async function getPodcastLegacyHotRadios(
  limit = 30,
  offset = 0,
): Promise<RadioInfo[]> {
  return normalizeRadioList(
    await request<Obj>("/dj/hot", { limit, offset }, false),
  );
}

export async function getDjRadioTop(
  djRadioId?: number,
  sortIndex = 1,
  dataGapDays = 7,
): Promise<RadioInfo[]> {
  return normalizeRadioList(
    await request<Obj>(
      "/djRadio/top",
      { djRadioId, sortIndex, dataGapDays, dataType: 3 },
      false,
    ),
  );
}

export async function getPodcastBanners(): Promise<
  Array<{ imageUrl: string; title: string; url: string }>
> {
  const response = await request<Obj>("/dj/banner", {}, false);
  const value = obj(response.data ?? response.result ?? response);
  return arr(value.banners ?? value.list ?? response.data ?? response)
    .map((raw) => {
      const item = obj(raw);
      return {
        imageUrl: String(item.pic ?? item.picUrl ?? item.imageUrl ?? ""),
        title: String(item.typeTitle ?? item.title ?? "播客"),
        url: String(item.url ?? item.targetUrl ?? ""),
      };
    })
    .filter((item) => item.imageUrl);
}

export type PodcastAdvancedRank = "hours" | "popular" | "newcomer" | "pay";

export async function getPodcastAdvancedToplist(
  type: PodcastAdvancedRank,
  limit = 30,
  offset = 0,
): Promise<RadioInfo[]> {
  const route = {
    hours: "/dj/toplist/hours",
    popular: "/dj/toplist/popular",
    newcomer: "/dj/toplist/newcomer",
    pay: "/dj/toplist/pay",
  }[type];
  const response = await request<Obj>(route, { limit, offset }, false);
  return normalizeRadioList(response);
}

export async function getPodcastProgramDetail(
  id: number,
): Promise<PodcastProgramDetail> {
  const response = await request<Obj>("/dj/program/detail", { id }, false);
  const value = obj(response.program ?? response.data ?? response);
  const radio = obj(value.radio);
  const dj = obj(value.dj);
  return {
    id: Number(value.id ?? id),
    name: String(value.name ?? value.programName ?? "播客节目"),
    description: String(value.description ?? value.desc ?? value.reason ?? ""),
    coverUrl: String(value.coverUrl ?? value.picUrl ?? value.cover ?? ""),
    radioName: String(value.radioName ?? radio.name ?? ""),
    djName: String(value.djName ?? dj.nickname ?? ""),
    publishTime: Number(
      value.createTime ?? value.publishTime ?? value.pubTime ?? 0,
    ),
    duration: Number(value.duration ?? value.durationms ?? 0),
    commentCount: Number(value.commentCount ?? value.commentCountAll ?? 0),
    song: normalizeSong(value.mainSong ?? value.song),
  };
}

function normalizeProgramRank(raw: unknown): PodcastProgramRank | null {
  const value = obj(raw);
  const program = obj(value.program ?? value.djProgram);
  const radio = obj(value.radio ?? program.radio);
  const dj = obj(value.dj ?? program.dj);
  const song = normalizeSong(
    value.mainSong ?? value.song ?? program.mainSong ?? program.song,
  );
  const id = Number(
    value.id ?? value.programId ?? program.id ?? song?.programId ?? 0,
  );
  if (!id) return null;
  return {
    id,
    name: String(
      value.name ?? value.title ?? program.name ?? song?.name ?? "播客节目",
    ),
    description: String(
      value.description ?? value.desc ?? program.description ?? "",
    ),
    coverUrl: String(
      value.coverUrl ?? value.picUrl ?? program.coverUrl ?? song?.picUrl ?? "",
    ),
    radioName: String(value.radioName ?? radio.name ?? ""),
    djName: String(value.djName ?? dj.nickname ?? ""),
    score: Number(value.score ?? value.hotScore ?? value.playCount ?? 0),
    song,
  };
}

function normalizeProgramList(response: Obj): PodcastProgramRank[] {
  const value = obj(response.data ?? response.result ?? response);
  return arr(
    value.list ?? value.programs ?? value.data ?? response.data ?? response,
  )
    .map(normalizeProgramRank)
    .filter((item): item is PodcastProgramRank => item !== null);
}

export async function getPodcastProgramToplist(
  limit = 30,
  offset = 0,
): Promise<PodcastProgramRank[]> {
  const response = await request<Obj>(
    "/dj/program/toplist",
    { limit, offset },
    false,
  );
  return normalizeProgramList(response);
}

export async function getPodcastProgramHoursToplist(
  limit = 30,
): Promise<PodcastProgramRank[]> {
  const response = await request<Obj>(
    "/dj/program/toplist/hours",
    { limit },
    false,
  );
  return normalizeProgramList(response);
}

export async function getPodcastTodayPreferred(
  page = 0,
): Promise<PodcastProgramRank[]> {
  const response = await request<Obj>("/dj/today/perfered", { page }, false);
  return normalizeProgramList(response);
}

function normalizeSubscriber(raw: unknown): PodcastSubscriber | null {
  const value = obj(raw);
  const user = obj(value.user ?? value.profile);
  const userId = Number(
    value.userId ?? value.uid ?? user.userId ?? user.id ?? 0,
  );
  if (!userId) return null;
  return {
    userId,
    nickname: String(value.nickname ?? user.nickname ?? "网易云用户"),
    avatarUrl: String(value.avatarUrl ?? value.avatar ?? user.avatarUrl ?? ""),
    signature: String(value.signature ?? user.signature ?? ""),
    time: Number(value.time ?? value.subscribeTime ?? value.createTime ?? 0),
  };
}

export async function getPodcastSubscribers(
  radioId: number,
  time = -1,
  limit = 20,
): Promise<{
  subscribers: PodcastSubscriber[];
  total: number;
  hasMore: boolean;
  nextTime: number;
}> {
  const response = await request<Obj>(
    "/dj/subscriber",
    { id: radioId, time, limit },
    false,
  );
  const value = obj(response.data ?? response.result ?? response);
  const subscribers = arr(
    value.list ?? value.subscribers ?? value.data ?? response.data ?? response,
  )
    .map(normalizeSubscriber)
    .filter((item): item is PodcastSubscriber => item !== null);
  const nextTime = Number(
    value.time ?? value.lastTime ?? subscribers.at(-1)?.time ?? time,
  );
  const total = Number(value.total ?? value.totalCount ?? subscribers.length);
  return {
    subscribers,
    total,
    hasMore: Boolean(value.more ?? value.hasMore),
    nextTime,
  };
}

export async function getPodcastPaidRadios(
  limit = 30,
  offset = 0,
): Promise<RadioInfo[]> {
  const response = await request<Obj>("/dj/paygift", { limit, offset }, false);
  return normalizeRadioList(response);
}

export async function getPersonalizedDjPrograms(): Promise<
  PodcastProgramRank[]
> {
  return normalizeProgramList(
    await request<Obj>("/personalized/djprogram", {}, false),
  );
}

export async function getProgramRecommendations(
  categoryId?: number,
  limit = 10,
  offset = 0,
): Promise<PodcastProgramRank[]> {
  return normalizeProgramList(
    await request<Obj>(
      "/program/recommend",
      { type: categoryId, limit, offset },
      false,
    ),
  );
}

