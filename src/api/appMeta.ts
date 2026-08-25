import { request } from "./client.ts";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value && typeof value === "object" ? (value as Obj) : {};

export async function getNeteaseSettings(): Promise<Obj> {
  const response = await request<Obj>("/setting", {}, false);
  return obj(response.data ?? response.result ?? response.setting ?? response);
}

export async function getNeteaseApiVersion(): Promise<string> {
  const response = await request<Obj>("/inner/version", {}, false);
  const value = obj(response.data ?? response.result ?? response);
  return String(value.version ?? response.version ?? "");
}

/** Decode an EAPI payload through the sidecar's internal compatibility route. */
export async function decryptEapi(
  hexString: string,
  responsePayload = false,
): Promise<unknown> {
  const value = hexString.replace(/\s/g, "");
  if (!value) throw new Error("hexString 不能为空");
  const result = await request<Obj>(
    "/eapi/decrypt",
    { hexString: value, isReq: responsePayload ? "false" : "true" },
    false,
  );
  return result.data ?? result.result ?? result;
}
