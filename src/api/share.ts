import { request } from "./client.ts";

export type ShareResourceType =
  "song" | "playlist" | "mv" | "djprogram" | "djradio" | "noresource";

export async function shareResource(
  type: ShareResourceType,
  id: number | string,
  message = "",
): Promise<void> {
  if (type !== "noresource" && !id) throw new Error("分享内容不存在");
  await request(
    "/share/resource",
    { type, id: String(id ?? ""), msg: message.trim() },
    false,
  );
}
