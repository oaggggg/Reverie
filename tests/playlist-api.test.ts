import test from "node:test";
import assert from "node:assert/strict";
import {
  addPlaylistTracks,
  deletePlaylistTracks,
  getPlaylistDynamicStats,
  getPlaylistAllTracks,
  markPlaylistPlayed,
  getPlaylistSubscribers,
  manipulatePlaylistTracks,
  updatePlaylistOrder,
} from "../src/api/playlist.ts";
import { publishPlaylist, updatePlaylistBatch } from "../src/api/extended.ts";

test("playlist track mutations forward ids and operation parameters", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; method?: string }> = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), method: init?.method });
    return Response.json({ code: 200 });
  };
  try {
    await addPlaylistTracks(10, [1, 2]);
    await deletePlaylistTracks(10, [3]);
    await manipulatePlaylistTracks(10, "del", [4, 5]);
    await updatePlaylistOrder(10, [5, 4, 3]);
    const first = new URL(calls[0]!.url);
    assert.equal(first.pathname, "/playlist/track/add");
    assert.equal(first.searchParams.get("pid"), "10");
    assert.equal(first.searchParams.get("ids"), "1,2");
    assert.equal(calls[0]!.method, "POST");
    const second = new URL(calls[1]!.url);
    assert.equal(second.pathname, "/playlist/track/delete");
    assert.equal(second.searchParams.get("id"), "10");
    assert.equal(second.searchParams.get("ids"), "3");
    const third = new URL(calls[2]!.url);
    assert.equal(third.pathname, "/playlist/tracks");
    assert.equal(third.searchParams.get("op"), "del");
    assert.equal(third.searchParams.get("tracks"), "4,5");
    const fourth = new URL(calls[3]!.url);
    assert.equal(fourth.pathname, "/playlist/order/update");
    assert.equal(fourth.searchParams.get("ids"), "5,4,3");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("playlist order falls back to the legacy song order endpoint", async () => {
  const originalFetch = globalThis.fetch;
  const paths: string[] = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    paths.push(url.pathname);
    if (url.pathname === "/playlist/order/update") {
      return new Response("upstream failure", { status: 502 });
    }
    assert.equal(url.pathname, "/song/order/update");
    assert.equal(url.searchParams.get("pid"), "10");
    assert.equal(url.searchParams.get("ids"), "3,2,1");
    return Response.json({ code: 200 });
  };
  try {
    await updatePlaylistOrder(10, [3, 2, 1]);
    assert.deepEqual(paths, ["/playlist/order/update", "/song/order/update"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("playlist full-track loader normalizes song records and paging", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/playlist/track/all");
      assert.equal(url.searchParams.get("id"), "10");
      assert.equal(url.searchParams.get("limit"), "2");
      assert.equal(url.searchParams.get("offset"), "4");
      return Response.json({ songs: [
        { id: 1, name: "歌曲一", ar: [{ name: "歌手" }], al: { name: "专辑" } },
        { song: { id: 2, name: "歌曲二", ar: [{ name: "歌手" }], al: { name: "专辑" } } },
      ], privileges: [
        { id: 1, maxBrLevel: "lossless" },
        { id: 2, maxBrLevel: "hires" },
      ] });
    };
    const songs = await getPlaylistAllTracks(10, 2, 4);
    assert.deepEqual(songs.map((song) => song.id), [1, 2]);
    // 平级 privileges 数组按 id 合并，补全列表的最好音质标识
    assert.deepEqual(songs.map((song) => song.maxLevel), ["lossless", "hires"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("playlist dynamic stats normalize count fields", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, "/playlist/detail/dynamic");
    assert.equal(url.searchParams.get("id"), "10");
    return Response.json({
      playCount: 120,
      subscribedCount: 30,
      commentCount: 4,
      shareCount: 2,
      followed: true,
    });
  };
  try {
    const stats = await getPlaylistDynamicStats(10);
    assert.deepEqual(stats, {
      playCount: 120,
      subscribedCount: 30,
      commentCount: 4,
      shareCount: 2,
      followed: true,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("playlist subscribers normalize user records and pagination", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, "/playlist/subscribers");
    assert.equal(url.searchParams.get("id"), "10");
    assert.equal(url.searchParams.get("limit"), "5");
    assert.equal(url.searchParams.get("offset"), "5");
    return Response.json({ subscribers: [{ userId: 3, nickname: "收藏者", avatarUrl: "avatar" }] });
  };
  try {
    const users = await getPlaylistSubscribers(10, 5, 5);
    assert.equal(users[0]?.userId, 3);
    assert.equal(users[0]?.nickname, "收藏者");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("publishPlaylist opens a private playlist through the privacy endpoint", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/playlist/privacy");
      assert.equal(url.searchParams.get("id"), "10");
      assert.equal(url.searchParams.get("privacy"), "0");
      return Response.json({ code: 200 });
    };
    await publishPlaylist(10);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("markPlaylistPlayed posts the playlist check-in id", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/playlist/update/playcount");
      assert.equal(url.searchParams.get("id"), "10");
      assert.equal(init?.method, "GET");
      return Response.json({ code: 200 });
    };
    await markPlaylistPlayed(10);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("updatePlaylistBatch sends the complete playlist edit payload", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/playlist/update");
      assert.equal(url.searchParams.get("id"), "10");
      assert.equal(url.searchParams.get("name"), "新名称");
      assert.equal(url.searchParams.get("desc"), "新描述");
      assert.equal(url.searchParams.get("tags"), "华语,流行");
      return Response.json({ code: 200 });
    };
    await updatePlaylistBatch(10, "新名称", "新描述", "华语,流行");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
