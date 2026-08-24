import { request } from "./client.ts";
import type {
  VipGrowthEntry,
  VipGrowthInfo,
  VipTask,
  VipTimeMachineInfo,
  VipTimeMachineItem,
} from "./types.ts";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value && typeof value === "object" ? (value as Obj) : {};
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export async function getVipGrowth(): Promise<VipGrowthInfo> {
  const response = await request<Obj>("/vip/growthpoint", {}, false);
  const value = obj(response.data ?? response);
  const growth = Number(
    value.growth ?? value.growthPoint ?? value.current ?? 0,
  );
  const next = Number(
    value.nextLevelGrowth ?? value.next ?? value.levelUpGrowth ?? 0,
  );
  return {
    level: Number(value.level ?? value.vipLevel ?? 0),
    growth,
    nextLevelGrowth: next,
    progress: next > 0 ? Math.min(1, growth / next) : 0,
    expireTime: Number(value.expireTime ?? value.endTime ?? 0),
  };
}

export async function getVipTasks(): Promise<VipTask[]> {
  const response = await request<Obj>("/vip/tasks", {}, false);
  return arr(response.data ?? response.list ?? response.tasks)
    .map((raw) => {
      const value = obj(raw);
      return {
        id: String(value.id ?? value.taskId ?? ""),
        name: String(value.name ?? value.taskName ?? "会员任务"),
        description: String(value.description ?? value.desc ?? ""),
        reward: Number(value.reward ?? value.growth ?? value.growthPoint ?? 0),
        completed: Boolean(
          value.completed ??
          value.finish ??
          value.done ??
          (value.status === "done" || value.status === "claimed"),
        ),
        claimed: Boolean(
          value.claimed ??
          value.received ??
          value.rewardClaimed ??
          value.status === "claimed",
        ),
      } satisfies VipTask;
    })
    .filter((task) => task.id);
}

export async function getVipGrowthDetails(
  limit = 20,
  offset = 0,
): Promise<VipGrowthEntry[]> {
  const response = await request<Obj>(
    "/vip/growthpoint/details",
    { limit, offset },
    false,
  );
  return arr(response.data ?? response.list ?? response.records).map(
    (raw, index) => {
      const value = obj(raw);
      return {
        id: String(value.id ?? value.recordId ?? `${offset + index}`),
        title: String(
          value.reason ?? value.description ?? value.name ?? "成长值记录",
        ),
        amount: Number(value.amount ?? value.growth ?? value.growthPoint ?? 0),
        time: Number(value.time ?? value.createTime ?? 0),
      } satisfies VipGrowthEntry;
    },
  );
}

export async function getVipTimeMachine(
  startTime?: number,
  endTime?: number,
): Promise<VipTimeMachineInfo> {
  const params =
    startTime && endTime ? { startTime, endTime, type: 1, limit: 60 } : {};
  const response = await request<Obj>("/vip/timemachine", params, false);
  const value = obj(response.data ?? response.result ?? response);
  const items = arr(value.detail ?? value.list ?? value.records)
    .map((raw, index) => normalizeTimeMachineItem(raw, index))
    .filter((item): item is VipTimeMachineItem => Boolean(item));
  return {
    recordTime: Number(value.recordTime ?? value.time ?? 0),
    limitedCount: Number(value.notVipLimitNum ?? value.limit ?? 0),
    hasMore: Boolean(value.hasnext ?? value.hasMore ?? false),
    items,
  };
}

function normalizeTimeMachineItem(
  raw: unknown,
  index: number,
): VipTimeMachineItem | null {
  const row = obj(raw);
  let payload = obj(row.data ?? row.content ?? row);
  if (typeof row.data === "string") {
    try {
      payload = obj(JSON.parse(row.data));
    } catch {
      payload = {};
    }
  }
  const title = String(
    payload.title ??
      payload.keyword ??
      payload.name ??
      payload.songName ??
      row.title ??
      "",
  ).trim();
  const description = String(
    payload.description ??
      payload.desc ??
      payload.subtitle ??
      payload.content ??
      payload.artistName ??
      "",
  ).trim();
  if (!title && !description) return null;
  return {
    id: String(row.id ?? payload.id ?? `${row.type ?? "record"}-${index}`),
    type: Number(row.type ?? payload.type ?? 0),
    title: title || "听歌回忆",
    description,
    coverUrl: String(
      payload.coverUrl ?? payload.picUrl ?? payload.imageUrl ?? "",
    ),
  };
}

export async function getVipGrowthpointInfo(): Promise<Obj> {
  return request<Obj>("/vip/growthpoint", {}, false);
}

export async function claimVipTaskRewards(taskIds: string[]): Promise<void> {
  if (!taskIds.length) return;
  await request(
    "/vip/growthpoint/get",
    { ids: taskIds.join(",") },
    false,
    { method: "POST" },
  );
}
