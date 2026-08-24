import test from "node:test";
import assert from "node:assert/strict";
import {
  getDigitalAlbumDetail,
  getDigitalAlbumSalesBoard,
  getDigitalAlbumSales,
  getDigitalAlbumStyleLibrary,
  getPurchasedDigitalAlbums,
  orderDigitalAlbum,
} from "../src/api/digitalAlbum.ts";

test("digital album APIs normalize detail, sales and purchased records", async () => {
  const originalFetch = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    urls.push(url);
    if (url.includes("sales"))
      return Response.json({
        data: { list: [{ albumId: 2, salesCount: 99 }] },
      });
    if (url.includes("purchased"))
      return Response.json({
        paidAlbums: [
          {
            productId: 3,
            productName: "已购",
            artists: [{ name: "歌手" }],
            coverUrl: "cover",
          },
        ],
      });
    return Response.json({
      data: {
        id: 2,
        name: "专辑",
        artistName: "歌手",
        price: 12.5,
        songs: [{ id: 8, name: "歌曲", ar: [{ name: "歌手" }] }],
      },
    });
  };
  try {
    const detail = await getDigitalAlbumDetail(2);
    assert.equal(detail?.name, "专辑");
    assert.equal(detail?.songs[0]?.id, 8);
    assert.equal((await getDigitalAlbumSales([2]))[2], 99);
    const purchased = await getPurchasedDigitalAlbums();
    assert.equal(purchased[0]?.name, "已购");
    assert.equal(purchased[0]?.artistName, "歌手");
    assert.match(urls[0]!, /digitalAlbum\/detail\?id=2/);
    assert.match(urls[1]!, /digitalAlbum\/sales\?ids=2/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("digital album ordering uses payment and quantity parameters", async () => {
  const originalFetch = globalThis.fetch;
  let call: { url: string; init?: RequestInit } | undefined;
  globalThis.fetch = async (input, init) => {
    call = { url: String(input), init };
    return Response.json({ code: 200 });
  };
  try {
    await orderDigitalAlbum({ id: 7, payment: "alipay", quantity: 2 });
    assert.equal(new URL(call!.url).pathname, "/digitalAlbum/ordering");
    assert.equal(new URL(call!.url).searchParams.get("payment"), "alipay");
    assert.equal(new URL(call!.url).searchParams.get("quantity"), "2");
    assert.equal(call!.init?.method, "POST");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("digital album sales board forwards period and normalizes rank entries", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, "/album/songsaleboard");
    assert.equal(url.searchParams.get("type"), "year");
    assert.equal(url.searchParams.get("year"), "2026");
    return Response.json({ data: { list: [{ id: 6, name: "年度专辑", artistName: "歌手", sales: 123, position: 2 }] } });
  };
  try {
    const board = await getDigitalAlbumSalesBoard("year", 2026);
    assert.equal(board[0]?.name, "年度专辑");
    assert.equal(board[0]?.rank, 2);
    assert.equal(board[0]?.score, 123);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("digital album style library forwards area and normalizes albums", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, "/album/list/style");
    assert.equal(url.searchParams.get("area"), "KR");
    assert.equal(url.searchParams.get("limit"), "10");
    assert.equal(url.searchParams.get("offset"), "20");
    return Response.json({ data: { albums: [{ albumId: 12, albumName: "韩国数字专辑", artistName: "歌手", picUrl: "cover" }] } });
  };
  try {
    const albums = await getDigitalAlbumStyleLibrary("KR", 10, 20);
    assert.equal(albums[0]?.id, 12);
    assert.equal(albums[0]?.name, "韩国数字专辑");
    assert.equal(albums[0]?.artistName, "歌手");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
