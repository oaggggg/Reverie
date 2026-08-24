import test from "node:test";
import assert from "node:assert/strict";
import { getDownloadHistory } from "../src/api/downloadHistory.ts";

test("download history selects category-specific routes and normalizes songs", async () => {
  const originalFetch = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = async (input) => {
    urls.push(String(input));
    const url = String(input);
    if (url.includes("song/downlist") || url.includes("song/monthdownlist"))
      return Response.json({
        info: [
          {
            songId: 1,
            songName: "下载歌曲",
            artistName: "歌手",
            albumName: "专辑",
          },
        ],
      });
    return Response.json({
      data: {
        list: [
          {
            song: {
              id: 2,
              name: "已购歌曲",
              ar: [{ name: "歌手" }],
              al: { name: "专辑" },
            },
          },
        ],
      },
    });
  };
  try {
    const all = await getDownloadHistory("all");
    const month = await getDownloadHistory("month");
    const purchased = await getDownloadHistory("purchased");
    assert.equal(all[0]?.name, "下载歌曲");
    assert.equal(month[0]?.artists, "歌手");
    assert.equal(purchased[0]?.name, "已购歌曲");
    assert.match(urls[0]!, /song\/downlist/);
    assert.match(urls[1]!, /song\/monthdownlist/);
    assert.match(urls[2]!, /song\/purchased/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("single purchased history uses the member single-download endpoint", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/song/singledownlist");
      return Response.json({
        info: [
          {
            songId: 11,
            songName: "已购单曲",
            artistName: "歌手",
            albumName: "专辑",
          },
        ],
      });
    };
    const songs = await getDownloadHistory("singlePurchased");
    assert.equal(songs[0]?.name, "已购单曲");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
