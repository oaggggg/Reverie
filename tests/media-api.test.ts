import test from "node:test";
import assert from "node:assert/strict";
import {
  getMediaDetail,
  getMediaUrl,
  getMediaStats,
  normalizeMediaDetail,
  setMediaLiked,
  setMediaSubscribed,
} from "../src/api/media.ts";
import type { SearchMediaInfo } from "../src/api/types.ts";

const fallback: SearchMediaInfo = {
  id: "mv-1",
  name: "搜索标题",
  coverUrl: "cover",
  creatorName: "作者",
  duration: 1000,
  playCount: 3,
  kind: "mv",
};

test("media detail normalizes metadata and preserves search fallback", () => {
  const detail = normalizeMediaDetail(
    {
      id: 1,
      name: "详情标题",
      cover: "detail-cover",
      artistName: "详情作者",
      duration: 12000,
      playCount: 88,
      desc: "介绍",
      tags: [{ name: "现场" }],
      commentCount: 7,
    },
    fallback,
  );
  assert.equal(detail.name, "详情标题");
  assert.equal(detail.coverUrl, "detail-cover");
  assert.equal(detail.description, "介绍");
  assert.deepEqual(detail.tags, ["现场"]);
  assert.equal(detail.commentCount, 7);
});

test("media detail and url routes use media kind-specific parameters", async () => {
  const originalFetch = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    urls.push(url);
    if (url.includes("/mv/detail"))
      return Response.json({ data: { name: "MV详情" } });
    if (url.includes("/mv/url"))
      return Response.json({ data: { url: "https://media" } });
    return Response.json({ code: 200 });
  };
  try {
    const detail = await getMediaDetail(fallback);
    const url = await getMediaUrl(fallback, 720);
    assert.equal(detail.name, "MV详情");
    assert.equal(url, "https://media");
    assert.match(urls[0]!, /mvid=mv-1/);
    assert.match(urls[1]!, /r=720/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("media advanced stats normalizes like, share, comment and subscription counts", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    assert.match(String(input), /mv\/detail\/info/);
    return Response.json({
      data: {
        likedCount: 3,
        shareCount: 4,
        commentCount: 5,
        subCount: 6,
        liked: true,
        subed: true,
      },
    });
  };
  try {
    const stats = await getMediaStats({
      id: "mv-1",
      name: "MV",
      coverUrl: "",
      creatorName: "",
      duration: 0,
      playCount: 0,
      kind: "mv",
    });
    assert.deepEqual(stats, {
      likedCount: 3,
      shareCount: 4,
      commentCount: 5,
      subCount: 6,
      liked: true,
      subscribed: true,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("media like and subscription mutations use kind-specific routes", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ path: string; url: URL; method?: string }> = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    calls.push({ path: url.pathname, url, method: init?.method });
    return Response.json({ code: 200 });
  };
  try {
    await setMediaLiked(
      {
        id: "mv-1",
        name: "",
        coverUrl: "",
        creatorName: "",
        duration: 0,
        playCount: 0,
        kind: "mv",
      },
      true,
    );
    await setMediaSubscribed(
      {
        id: "mv-1",
        name: "",
        coverUrl: "",
        creatorName: "",
        duration: 0,
        playCount: 0,
        kind: "mv",
      },
      false,
    );
    await setMediaLiked(
      {
        id: "video-1",
        name: "",
        coverUrl: "",
        creatorName: "",
        duration: 0,
        playCount: 0,
        kind: "video",
      },
      false,
    );
    await setMediaSubscribed(
      {
        id: "video-1",
        name: "",
        coverUrl: "",
        creatorName: "",
        duration: 0,
        playCount: 0,
        kind: "video",
      },
      true,
    );
    assert.deepEqual(
      calls.map((call) => call.path),
      ["/resource/like", "/mv/sub", "/resource/like", "/video/sub"],
    );
    assert.equal(calls[0]!.url.searchParams.get("type"), "1");
    assert.equal(calls[2]!.url.searchParams.get("type"), "5");
    assert.equal(calls[3]!.url.searchParams.get("id"), "video-1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
