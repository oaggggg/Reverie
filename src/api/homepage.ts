import { request } from "./client.ts";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value && typeof value === "object" ? (value as Obj) : {};
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export interface HomepageBlock {
  code: string;
  title: string;
  data: Obj;
}

export interface HomepageBlockPage {
  cursor: string;
  hasMore: boolean;
  blocks: HomepageBlock[];
}

export interface HomepageEntry {
  id: string;
  name: string;
  iconUrl: string;
  target: string;
}

export async function getHomepageBlockPage(
  refresh = false,
  cursor = "",
): Promise<HomepageBlockPage> {
  const response = await request<Obj>(
    "/homepage/block/page",
    { refresh, cursor: cursor || undefined },
    false,
  );
  const value = obj(response.data ?? response.result ?? response);
  const blocks = arr(value.blocks ?? response.blocks ?? value.list)
    .map((raw) => {
      const block = obj(raw);
      return {
        code: String(block.blockCode ?? block.code ?? ""),
        title: String(block.title ?? block.blockTitle ?? block.name ?? ""),
        data: block,
      } satisfies HomepageBlock;
    })
    .filter((block) => block.code || block.title);
  return {
    cursor: String(value.cursor ?? response.cursor ?? ""),
    hasMore: Boolean(value.hasMore ?? response.hasMore),
    blocks,
  };
}

export async function getHomepageDragonBall(): Promise<HomepageEntry[]> {
  const response = await request<Obj>("/homepage/dragon/ball", {}, false);
  const value = obj(response.data ?? response.result ?? response);
  return arr(
    value.data ?? value.list ?? response.data ?? response.list ?? response,
  )
    .map((raw, index) => {
      const item = obj(raw);
      return {
        id: String(item.id ?? item.resourceId ?? item.name ?? index),
        name: String(item.name ?? item.title ?? item.resourceName ?? "入口"),
        iconUrl: String(item.iconUrl ?? item.icon ?? item.picUrl ?? ""),
        target: String(item.url ?? item.resourceUrl ?? item.action ?? ""),
      } satisfies HomepageEntry;
    })
    .filter((item) => item.name);
}
