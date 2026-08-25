import { request } from "./client.ts";
import type {
  BroadcastChannel,
  BroadcastCategory,
  DifmChannel,
  PodcastProgramRank,
  PodcastSubscriber,
  PodcastProgramDetail,
  RadioInfo,
  Song,
} from "./types.ts";
import { normalizeSong } from "./client.ts";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value && typeof value === "object" ? (value as Obj) : {};
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function normalizeChannel(raw: unknown): BroadcastChannel | null {
  const value = obj(raw);
  const id = Number(value.id ?? value.channelId ?? 0);
  if (!id) return null;
  return {
    id,
    name: String(value.name ?? value.channelName ?? "广播电台"),
    description: String(value.description ?? value.desc ?? ""),
    coverUrl: String(value.picUrl ?? value.coverUrl ?? value.coverImgUrl ?? ""),
    subscribed: Boolean(value.subscribed ?? value.collected ?? false),
    categoryName: String(value.categoryName ?? value.category ?? ""),
    regionName: String(value.regionName ?? value.region ?? ""),
    currentSong: normalizeSong(value.song ?? value.currentSong) ?? undefined,
  };
}
export async function getBroadcastCategories(): Promise<BroadcastCategory[]> {
  const response = await request<Obj>(
    "/broadcast/category/region/get",
    {},
    false,
  );
  const value = obj(response.data ?? response.result ?? response);
  return arr(value.category ?? value.categories ?? value.list)
    .map((item) => {
      const row = obj(item);
      return {
        id: Number(row.id ?? row.categoryId ?? 0),
        name: String(row.name ?? row.categoryName ?? ""),
      };
    })
    .filter((item) => item.id > 0 && item.name);
}
export async function getBroadcastChannels(
  input: {
    categoryId?: number;
    regionId?: number;
    limit?: number;
    lastId?: number;
  } = {},
): Promise<BroadcastChannel[]> {
  const response = await request<Obj>("/broadcast/channel/list", {
    categoryId: input.categoryId,
    regionId: input.regionId,
    limit: input.limit ?? 20,
    lastId: input.lastId ?? 0,
  });
  const value = obj(response.data ?? response.result ?? response);
  return arr(value.list ?? value.channels ?? response.data ?? response)
    .map(normalizeChannel)
    .filter((item): item is BroadcastChannel => item !== null);
}

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

function normalizeDifmChannel(
  raw: unknown,
  source: number,
): DifmChannel | null {
  const value = obj(raw);
  const id = Number(value.id ?? value.channelId ?? 0);
  if (!id) return null;
  return {
    id,
    name: String(value.name ?? value.channelName ?? "DIFM 电台"),
    description: String(value.description ?? value.desc ?? ""),
    coverUrl: String(value.picUrl ?? value.coverUrl ?? value.cover ?? ""),
    source: Number(value.source ?? value.sourceId ?? source),
    subscribed: Boolean(value.subscribed ?? value.isSubscribe ?? value.sub),
  };
}

function difmList(response: Obj): unknown[] {
  const value = obj(response.data ?? response.result ?? response);
  return arr(
    value.list ?? value.channels ?? value.data ?? response.data ?? response,
  );
}

export async function getDifmChannels(source = 0): Promise<DifmChannel[]> {
  const response = await request<Obj>(
    "/dj/difm/all/style/channel",
    { sources: JSON.stringify([source]) },
    false,
  );
  return difmList(response)
    .map((item) => normalizeDifmChannel(item, source))
    .filter((item): item is DifmChannel => item !== null);
}

export async function getDifmSubscribedChannels(
  source = 0,
): Promise<DifmChannel[]> {
  const response = await request<Obj>(
    "/dj/difm/subscribe/channels/get",
    { sources: JSON.stringify([source]) },
    false,
  );
  return difmList(response)
    .map((item) => normalizeDifmChannel(item, source))
    .filter((item): item is DifmChannel => item !== null)
    .map((item) => ({ ...item, subscribed: true }));
}

export async function toggleDifmChannel(
  id: number,
  subscribed: boolean,
): Promise<void> {
  await request(
    subscribed ? "/dj/difm/channel/subscribe" : "/dj/difm/channel/unsubscribe",
    { id },
    false,
    { method: "POST" },
  );
}

export async function getDifmTracks(
  source: number,
  channelId?: number,
  limit = 10,
): Promise<Song[]> {
  const response = await request<Obj>(
    "/dj/difm/playing/tracks/list",
    { source, channelId, limit },
    false,
  );
  const value = obj(response.data ?? response.result ?? response);
  return arr(
    value.list ?? value.tracks ?? value.data ?? response.data ?? response,
  )
    .map((item) => normalizeSong(obj(item).song ?? item))
    .filter((item): item is Song => item !== null);
}
export async function getBroadcastCurrentInfo(
  id: number,
): Promise<BroadcastChannel | null> {
  const response = await request<Obj>(
    "/broadcast/channel/currentinfo",
    { id },
    false,
  );
  return normalizeChannel(response.data ?? response.result ?? response);
}
export async function getBroadcastCollected(): Promise<BroadcastChannel[]> {
  const response = await request<Obj>(
    "/broadcast/channel/collect/list",
    {},
    false,
  );
  const value = obj(response.data ?? response.result ?? response);
  return arr(value.list ?? value.channels ?? response.data ?? response)
    .map(normalizeChannel)
    .filter((item): item is BroadcastChannel => item !== null);
}
export async function toggleBroadcastSubscription(
  id: number,
  subscribed: boolean,
): Promise<void> {
  await request("/broadcast/sub", { id, t: subscribed ? 1 : 0 }, false, {
    method: "POST",
  });
}
export async function getSportRadio(bpm = 50): Promise<Song[]> {
  const response = await request<Obj>("/radio/sport/get", { bpm });
  const value = obj(response.data ?? response.result ?? response);
  return arr(value.data ?? value.list ?? response.data ?? response)
    .map(normalizeSong)
    .filter((item): item is Song => item !== null);
}
