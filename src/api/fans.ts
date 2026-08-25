import { request } from "./client.ts";
import type { CreatorAuthInfo, FansOverview, FansTrendPoint } from "./types.ts";
type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value && typeof value === "object" ? (value as Obj) : {};
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export interface InfluencerThreshold {
  eligible: boolean;
  level: number;
  fanCount: number;
  requiredFans: number;
  playCount: number;
  requiredPlayCount: number;
  description: string;
}
export async function getCreatorAuthInfo(): Promise<CreatorAuthInfo> {
  const response = await request<Obj>("/creator/authinfo/get", {}, false);
  const value = obj(response.data ?? response.result ?? response);
  return {
    authenticated: Boolean(value.authenticated ?? value.isAuth ?? value.status),
    name: String(value.name ?? value.nickname ?? ""),
    description: String(value.description ?? value.desc ?? ""),
    level: Number(value.level ?? 0),
  };
}

export async function getInfluencerThreshold(): Promise<InfluencerThreshold> {
  const response = await request<Obj>("/threshold/detail/get", {}, false);
  const value = obj(response.data ?? response.result ?? response);
  return {
    eligible: Boolean(
      value.eligible ?? value.qualified ?? value.canApply ?? value.status,
    ),
    level: Number(value.level ?? value.creatorLevel ?? 0),
    fanCount: Number(value.fanCount ?? value.fans ?? value.currentFans ?? 0),
    requiredFans: Number(
      value.requiredFans ?? value.fansThreshold ?? value.needFans ?? 0,
    ),
    playCount: Number(value.playCount ?? value.currentPlayCount ?? 0),
    requiredPlayCount: Number(
      value.requiredPlayCount ??
        value.playThreshold ??
        value.needPlayCount ??
        0,
    ),
    description: String(value.description ?? value.desc ?? value.message ?? ""),
  };
}
export async function getFansOverview(): Promise<FansOverview> {
  const response = await request<Obj>("/fanscenter/overview/get", {}, false);
  const value = obj(response.data ?? response.result ?? response);
  return {
    total: Number(value.total ?? value.fansCount ?? value.fanCount ?? 0),
    todayAdded: Number(value.todayAdded ?? value.newFans ?? 0),
    todayLost: Number(value.todayLost ?? value.unfollowCount ?? 0),
    growth: Number(value.growth ?? 0),
  };
}
export async function getFansTrend(
  type: 0 | 1 = 0,
  startTime?: number,
  endTime?: number,
): Promise<FansTrendPoint[]> {
  const response = await request<Obj>(
    "/fanscenter/trend/list",
    { type, startTime, endTime },
    false,
  );
  const value = obj(response.data ?? response.result ?? response);
  return arr(value.list ?? value.records ?? response.data ?? response).map(
    (item) => {
      const row = obj(item);
      return {
        date: String(row.date ?? row.time ?? ""),
        count: Number(row.count ?? row.value ?? row.num ?? 0),
      };
    },
  );
}
export async function getFansDemographics(
  kind: "age" | "gender" | "province",
): Promise<Array<{ label: string; value: number }>> {
  const response = await request<Obj>(
    `/fanscenter/basicinfo/${kind}/get`,
    {},
    false,
  );
  const value = obj(response.data ?? response.result ?? response);
  return arr(value.list ?? value.records ?? response.data ?? response)
    .map((item) => {
      const row = obj(item);
      return {
        label: String(row.name ?? row.label ?? row.key ?? ""),
        value: Number(row.value ?? row.count ?? row.num ?? 0),
      };
    })
    .filter((item) => item.label);
}
