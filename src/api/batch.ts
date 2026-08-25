import { request } from "./client.ts";

export type BatchPayload = Record<string, string>;

/** Execute multiple Netease API sub-requests through the batch endpoint. */
export async function executeBatch<T = unknown>(
  payload: BatchPayload,
): Promise<T> {
  if (!Object.keys(payload).length) return {} as T;
  return request<T>("/batch", payload, false, { method: "POST" });
}
