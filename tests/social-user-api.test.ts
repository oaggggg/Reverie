import assert from "node:assert/strict";
import test from "node:test";
import {
  getEvents,
  getFollowers,
  getFollows,
  getMixedFollows,
  getMutualFollow,
  getSocialStatusRecommendations,
  getSupportedSocialStatuses,
  getUserCollectedPlaylists,
  getUserCreatedPlaylists,
  getUserSocialStatus,
  deleteEvent,
  getUserEvents,
} from "../src/api/extended.ts";

test("follow lists normalize nested and wrapped user records", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname === "/user/follows") {
        return Response.json({
          data: {
            list: [
              { user: { userId: 8, nickname: "关注用户", avatarUrl: "a" } },
            ],
          },
        });
      }
      assert.equal(url.pathname, "/user/followeds");
      return Response.json({
        result: { users: [{ id: 9, nickname: "粉丝用户", signature: "简介" }] },
      });
    };
    const follows = await getFollows(42);
    const followers = await getFollowers(42);
    assert.equal(follows[0]?.userId, 8);
    assert.equal(follows[0]?.nickname, "关注用户");
    assert.equal(followers[0]?.userId, 9);
    assert.equal(followers[0]?.signature, "简介");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getEvents normalizes activity resources and interaction counts", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/event");
      return Response.json({
        event: [
          {
            id: 9,
            eventTime: 123,
            user: { userId: 42, nickname: "测试用户", avatarUrl: "avatar" },
            json: JSON.stringify({ msg: "分享歌曲", song: { id: 7, name: "歌曲" } }),
            info: { commentCount: 2, likedCount: 3, liked: true, threadId: "t-1" },
            forwardCount: 4,
          },
        ],
      });
    };
    const [event] = await getEvents();
    assert.equal(event?.text, "分享歌曲");
    assert.equal(event?.resourceType, "song");
    assert.equal(event?.resourceId, 7);
    assert.equal(event?.likedCount, 3);
    assert.equal(event?.threadId, "t-1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getUserEvents requests the selected user activity feed", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/user/event");
      assert.equal(url.searchParams.get("uid"), "42");
      assert.equal(url.searchParams.get("lasttime"), "100");
      assert.equal(url.searchParams.get("limit"), "12");
      return Response.json({ events: [{ id: 1, user: { userId: 42 }, json: "{}" }] });
    };
    const events = await getUserEvents(42, 100, 12);
    assert.equal(events.length, 1);
    assert.equal(events[0]?.id, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getMixedFollows normalizes the selected follow scene and cursor", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/user/follow/mixed");
      assert.equal(url.searchParams.get("scene"), "2");
      assert.equal(url.searchParams.get("size"), "20");
      assert.equal(url.searchParams.get("cursor"), "5");
      return Response.json({ data: { users: [{ userId: 8, nickname: "关注用户" }], cursor: 9, more: true } });
    };
    const result = await getMixedFollows(2, 20, 5);
    assert.equal(result.users[0]?.userId, 8);
    assert.equal(result.cursor, 9);
    assert.equal(result.more, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getMutualFollow reads the relationship flag", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/user/mutualfollow/get");
      assert.equal(url.searchParams.get("uid"), "8");
      return Response.json({ data: { mutual: true } });
    };
    assert.equal(await getMutualFollow(8), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("user playlist and social status routes normalize account data", async () => {
  const originalFetch = globalThis.fetch;
  const paths: string[] = [];
  try {
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));
      paths.push(url.pathname);
      // 创建/收藏歌单统一复用 /user/playlist 全量拉取后按创建者拆分
      if (url.pathname === "/user/playlist")
        return Response.json({
          playlist: [
            { id: 1, name: "我创建的", creator: { userId: 42, nickname: "我" } },
            { id: 2, name: "我收藏的", creator: { userId: 99, nickname: "别人" } },
          ],
        });
      if (url.pathname === "/user/social/status") return Response.json({ data: { statusName: "听歌中" } });
      if (url.pathname === "/user/social/status/rcmd") return Response.json({ data: [{ name: "专注" }] });
      if (url.pathname === "/user/social/status/support") return Response.json({ data: [{ name: "听歌中" }] });
      assert.equal(url.pathname, "/event/del");
      assert.equal(url.searchParams.get("evId"), "8");
      assert.equal(init?.method, "POST");
      return Response.json({ code: 200 });
    };
    const created = await getUserCreatedPlaylists(42);
    assert.equal(created.length, 1);
    assert.equal(created[0]?.name, "我创建的");
    const collected = await getUserCollectedPlaylists(42);
    assert.equal(collected.length, 1);
    assert.equal(collected[0]?.id, 2);
    assert.equal(await getUserSocialStatus(42), "听歌中");
    assert.deepEqual(await getSocialStatusRecommendations(), ["专注"]);
    assert.deepEqual(await getSupportedSocialStatuses(), ["听歌中"]);
    await deleteEvent(8);
    // 第二次调用命中 cachedRequest 内存缓存，故只发一次 /user/playlist
    assert.deepEqual(paths, ["/user/playlist", "/user/social/status", "/user/social/status/rcmd", "/user/social/status/support", "/event/del"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
