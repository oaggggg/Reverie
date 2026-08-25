import { request } from "./client.ts";
import { normalizeResourceComment } from "./comment.ts";
import type { CommentInfo } from "./types.ts";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Obj)
    : {};

function collectComments(
  value: unknown,
  depth = 0,
  output: CommentInfo[] = [],
): CommentInfo[] {
  if (depth > 6 || value === null || value === undefined) return output;
  if (Array.isArray(value)) {
    for (const item of value) collectComments(item, depth + 1, output);
    return output;
  }
  const item = obj(value);
  if (
    typeof item.content === "string" &&
    (item.user || item.userInfo || item.nickname)
  ) {
    const normalized = normalizeResourceComment(item);
    if (normalized.id || normalized.content) output.push(normalized);
  }
  for (const nested of Object.values(item)) {
    if (nested && typeof nested === "object")
      collectComments(nested, depth + 1, output);
  }
  return output;
}

export async function getStarpickCommentsSummary(): Promise<CommentInfo[]> {
  const response = await request<Obj>("/starpick/comments/summary", {}, true);
  return collectComments(response).filter(
    (item, index, items) =>
      items.findIndex(
        (entry) => entry.id === item.id && entry.content === item.content,
      ) === index,
  );
}
