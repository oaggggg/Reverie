import test from "node:test";
import assert from "node:assert/strict";
import {
  getPodcastProgramDetail,
  getPodcastExcludeHotCategories,
  getPodcastHomeCategoryRecommendations,
  getPodcastLegacyHotRadios,
  getDjRadioTop,
  getPersonalizedDjPrograms,
  getProgramRecommendations,
  getPodcastProgramHoursToplist,
  getPodcastProgramToplist,
  getPodcastAdvancedToplist,
  getPodcastPaidRadios,
  getPodcastSubscribers,
  getPodcastTodayPreferred,
} from "../src/api/broadcast.ts";
import { getPodcastToplist } from "../src/api/broadcast.ts";

test("podcast toplist normalizes new and hot radio records", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, "/dj/toplist");
    assert.equal(url.searchParams.get("type"), "hot");
    return Response.json({ data: { list: [{ id: 8, name: "热门电台", dj: { nickname: "主播" } }] } });
  };
  try {
    const radios = await getPodcastToplist("hot", 10, 0);
    assert.equal(radios[0]?.name, "热门电台");
    assert.equal(radios[0]?.djName, "主播");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("podcast program detail normalizes metadata and main song", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    assert.equal(new URL(String(input)).pathname, "/dj/program/detail");
    return Response.json({
      program: {
        id: 11,
        name: "节目详情",
        description: "节目介绍",
        coverUrl: "cover",
        radio: { name: "电台" },
        dj: { nickname: "主播" },
        createTime: 1700000000000,
        duration: 180000,
        commentCount: 4,
        mainSong: { id: 22, name: "节目歌曲", ar: [{ name: "歌手" }] },
      },
    });
  };
  try {
    const detail = await getPodcastProgramDetail(11);
    assert.equal(detail.name, "节目详情");
    assert.equal(detail.radioName, "电台");
    assert.equal(detail.djName, "主播");
    assert.equal(detail.song?.id, 22);
    assert.equal(detail.commentCount, 4);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("podcast program rankings forward routes and normalize program records", async () => {
  const originalFetch = globalThis.fetch;
  const paths: string[] = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    paths.push(url.pathname);
    return Response.json({ data: [{ id: 9, name: "节目榜", radio: { name: "电台" }, score: 88, mainSong: { id: 90, name: "榜单歌曲", ar: [{ name: "歌手" }] } }] });
  };
  try {
    assert.equal((await getPodcastProgramToplist(10, 20))[0]?.name, "节目榜");
    assert.equal((await getPodcastProgramHoursToplist(10))[0]?.song?.id, 90);
    assert.equal((await getPodcastTodayPreferred(1))[0]?.radioName, "电台");
    assert.deepEqual(paths, ["/dj/program/toplist", "/dj/program/toplist/hours", "/dj/today/perfered"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("advanced podcast rankings select the documented toplist routes", async () => {
  const originalFetch = globalThis.fetch;
  const paths: string[] = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    paths.push(url.pathname);
    return Response.json({ data: { list: [{ id: 5, name: "榜单电台" }] } });
  };
  try {
    for (const type of ["hours", "popular", "newcomer", "pay"] as const) {
      assert.equal((await getPodcastAdvancedToplist(type, 5))[0]?.name, "榜单电台");
    }
    assert.deepEqual(paths, [
      "/dj/toplist/hours",
      "/dj/toplist/popular",
      "/dj/toplist/newcomer",
      "/dj/toplist/pay",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("podcast subscriber and paid radio APIs normalize their responses", async () => {
  const originalFetch = globalThis.fetch;
  const paths: string[] = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    paths.push(url.pathname);
    if (url.pathname === "/dj/subscriber") {
      return Response.json({ data: { total: 12, more: true, time: 123, list: [{ userId: 4, nickname: "订阅者", avatarUrl: "avatar" }] } });
    }
    return Response.json({ data: { list: [{ id: 8, name: "付费电台", dj: { nickname: "主播" } }] } });
  };
  try {
    const subscribers = await getPodcastSubscribers(99, -1, 20);
    const paid = await getPodcastPaidRadios(10, 0);
    assert.equal(subscribers.subscribers[0]?.nickname, "订阅者");
    assert.equal(subscribers.total, 12);
    assert.equal(subscribers.hasMore, true);
    assert.equal(paid[0]?.name, "付费电台");
    assert.deepEqual(paths, ["/dj/subscriber", "/dj/paygift"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("legacy podcast discovery routes normalize categories, radios and programs", async () => {
  const originalFetch = globalThis.fetch;
  const paths: string[] = [];
  try {
    globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      paths.push(url.pathname);
      if (url.pathname === "/dj/category/excludehot") return Response.json({ data: [{ id: 1, name: "知识" }] });
      if (url.pathname === "/dj/category/recommend" || url.pathname === "/dj/hot" || url.pathname === "/djRadio/top") return Response.json({ data: { list: [{ id: 2, name: "推荐电台" }] } });
      return Response.json({ data: [{ id: 3, name: "推荐节目", mainSong: { id: 4, name: "节目歌曲", ar: [{ name: "主播" }] } }] });
    };
    assert.equal((await getPodcastExcludeHotCategories())[0]?.name, "知识");
    assert.equal((await getPodcastHomeCategoryRecommendations())[0]?.name, "推荐电台");
    assert.equal((await getPodcastLegacyHotRadios())[0]?.name, "推荐电台");
    assert.equal((await getDjRadioTop())[0]?.name, "推荐电台");
    assert.equal((await getPersonalizedDjPrograms())[0]?.name, "推荐节目");
    assert.equal((await getProgramRecommendations())[0]?.song?.name, "节目歌曲");
    assert.deepEqual(paths, [
      "/dj/category/excludehot",
      "/dj/category/recommend",
      "/dj/hot",
      "/djRadio/top",
      "/personalized/djprogram",
      "/program/recommend",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
