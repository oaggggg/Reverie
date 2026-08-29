import assert from "node:assert/strict";
import test from "node:test";
import { mergeSongPrivileges, normalizeSong } from "../src/api/client.ts";
import { sizedImage } from "../src/utils/image.ts";

test("normalizeSong accepts the common Netease song shapes", () => {
  assert.deepEqual(
    normalizeSong({
      id: "42",
      name: "  测试歌曲  ",
      ar: [{ id: 7, name: "歌手" }],
      al: { id: 8, name: "专辑", picUrl: "http://p1.music.126.net/a.jpg" },
      dt: 1234,
      fee: 1,
      mv: 99,
    }),
    {
      id: 42,
      name: "  测试歌曲  ",
      artists: "歌手",
      artistNames: ["歌手"],
      artistIds: [7],
      album: "专辑",
      albumId: 8,
      picUrl: "http://p1.music.126.net/a.jpg",
      duration: 1234,
      fee: 1,
      mvId: 99,
      alias: undefined,
    },
  );
  // 官方别名（alias/alia 双形态）用于原唱/翻唱等版本标识
  assert.deepEqual(normalizeSong({ id: 7, name: "x", alias: [" 翻自 某人 "] })?.alias, [
    "翻自 某人",
  ]);
  assert.deepEqual(normalizeSong({ id: 8, name: "y", alia: ["Live"] })?.alias, [
    "Live",
  ]);
  assert.equal(normalizeSong({ name: "缺少 id" }), null);
});

test("mergeSongPrivileges fills max level from sibling privileges by id", () => {
  const songs = [
    normalizeSong({ id: 1, name: "无损歌" }),
    normalizeSong({ id: 2, name: "母带歌" }),
    normalizeSong({ id: 3, name: "行内已有", privilege: { maxBrLevel: "lossless" } }),
  ].filter((song) => song !== null);
  const merged = mergeSongPrivileges(songs, [
    { id: 1, maxBrLevel: "hires" },
    { id: 2, playMaxBrLevel: "jymaster" },
    { id: 3, maxBrLevel: "standard" },
    { id: 999, maxBrLevel: "lossless" },
  ]);
  assert.equal(merged[0]?.maxLevel, "hires");
  assert.equal(merged[1]?.maxLevel, "jymaster");
  // 行内已有更高档时不被低档覆盖
  assert.equal(merged[2]?.maxLevel, "lossless");
  // 非法输入原样返回
  assert.equal(mergeSongPrivileges(songs, null), songs);
  assert.equal(mergeSongPrivileges(songs, []), songs);
});

test("sizedImage upgrades insecure CDN URLs and preserves existing params", () => {
  assert.equal(
    sizedImage("http://p1.music.126.net/cover.jpg", 160),
    "https://p1.music.126.net/cover.jpg?param=160y160",
  );
  assert.equal(
    sizedImage("https://example.com/avatar.jpg?param=80y80", 160),
    "https://example.com/avatar.jpg?param=80y80",
  );
  assert.equal(
    sizedImage("data:image/png;base64,abc", 160),
    "data:image/png;base64,abc",
  );
});
