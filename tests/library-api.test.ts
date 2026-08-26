import test from "node:test";
import assert from "node:assert/strict";
import { getAlbumDirectory, getAlbumPrivileges, getArtistDirectory, getNewestAlbums, getTopAlbums, getTopArtists } from "../src/api/library.ts";

test("library APIs normalize album and artist directories", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const path = new URL(String(input)).pathname;
    if (path === "/album/new") return Response.json({ albums: [{ id: 1, name: "新专辑", artist: { id: 3, name: "歌手" } }], more: true });
    if (path === "/album/newest") return Response.json({ albums: [{ id: 2, name: "最新" }] });
    if (path === "/top/album") return Response.json({ albums: [{ id: 1, name: "重复" }] });
    if (path === "/artist/list") return Response.json({ artists: [{ id: 4, name: "男歌手" }], more: false });
    return Response.json({ artists: [{ id: 5, name: "热门歌手" }] });
  };
  try {
    assert.equal((await getAlbumDirectory()).albums[0]?.artistNames, "歌手");
    assert.equal((await getNewestAlbums())[0]?.name, "最新");
    assert.equal((await getTopAlbums())[0]?.id, 1);
    assert.equal((await getArtistDirectory()).artists[0]?.name, "男歌手");
    assert.equal((await getTopArtists())[0]?.name, "热门歌手");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("album privilege API normalizes available quality flags", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, "/album/privilege");
    assert.equal(url.searchParams.get("id"), "99");
    // 真实响应形态：等级字符串 + 权限位图（实测热歌榜专辑）
    return Response.json({
      data: [{
        id: 8,
        maxbr: 999000,
        maxBrLevel: "jymaster",
        playMaxBrLevel: "jymaster",
        plLevel: "jyeffect",
        flag: 1544196,
        pl: 999000,
        fl: 320000,
      }],
    });
  };
  try {
    const privileges = await getAlbumPrivileges(99);
    assert.deepEqual(privileges[0], {
      songId: 8,
      maxBitrate: 999000,
      maxLevel: "jymaster",
      standard: true,
      lossless: true,
      highRes: true,
      dolby: false,
      spatialAudio: false,
      surroundEffect: true,
      immersive: true,
      jymaster: true,
      vivid: false,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
