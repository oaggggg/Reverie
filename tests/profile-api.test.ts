import assert from "node:assert/strict";
import test from "node:test";
import { getProfileCenter, getUserMedals, getUserCreatedRadios, getUserDjPrograms } from "../src/api/profile.ts";

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

test("getProfileCenter combines detail, level and subcount", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (input) => {
      const path = new URL(String(input)).pathname;
      if (path === "/user/detail") {
        return json({
          level: 7,
          listenSongs: 1234,
          createTime: 1000,
          profile: {
            userId: 42,
            nickname: "测试用户",
            avatarUrl: "avatar.jpg",
            backgroundUrl: "background.jpg",
            signature: "签名",
            follows: 8,
            followeds: 9,
            playlistCount: 10,
            eventCount: 11,
          },
        });
      }
      if (path === "/user/level") {
        return json({
          data: {
            level: 7,
            progress: 0.5,
            nowPlayCount: 100,
            nextPlayCount: 200,
            nowLoginCount: 20,
            nextLoginCount: 30,
          },
        });
      }
      if (path === "/user/subcount") {
        return json({
          artistCount: 3,
          albumCount: 4,
          mvCount: 5,
          djRadioCount: 6,
          createdPlaylistCount: 7,
          subPlaylistCount: 8,
        });
      }
      return json({});
    }) as typeof fetch;

    const result = await getProfileCenter(42);
    assert.equal(result.detail.nickname, "测试用户");
    assert.equal(result.detail.listenSongs, 1234);
    assert.equal(result.level.progress, 0.5);
    assert.equal(result.subcount.albumCount, 4);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getUserMedals normalizes obtained user badges", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, "/user/medal");
    assert.equal(url.searchParams.get("uid"), "42");
    return Response.json({ data: { medals: [
      { id: 1, medalName: "连续听歌", picUrl: "badge", level: 3, has: true },
      { id: 2, medalName: "未获得", has: false },
    ] } });
  };
  try {
    const medals = await getUserMedals(42);
    assert.equal(medals.length, 1);
    assert.equal(medals[0]?.name, "连续听歌");
    assert.equal(medals[0]?.level, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getUserCreatedRadios normalizes user-owned radio records", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, "/user/audio");
    assert.equal(url.searchParams.get("uid"), "42");
    return Response.json({ data: { djRadios: [{ id: 7, name: "我的节目", picUrl: "cover", programCount: 3, dj: { nickname: "我" } }] } });
  };
  try {
    const radios = await getUserCreatedRadios(42);
    assert.equal(radios[0]?.name, "我的节目");
    assert.equal(radios[0]?.programCount, 3);
    assert.equal(radios[0]?.djName, "我");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getUserDjPrograms normalizes published radio programs", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/user/dj");
      assert.equal(url.searchParams.get("uid"), "42");
      assert.equal(url.searchParams.get("limit"), "5");
      return Response.json({ data: { programs: [{ id: 7, name: "我的节目", coverUrl: "cover", mainSong: { id: 8, name: "节目音频", ar: [{ name: "我" }], al: { name: "电台" } } }] } });
    };
    const programs = await getUserDjPrograms(42, 5);
    assert.equal(programs[0]?.programId, 7);
    assert.equal(programs[0]?.name, "我的节目");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
