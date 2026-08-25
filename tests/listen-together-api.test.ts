import test from "node:test";
import assert from "node:assert/strict";
import {
  acceptListenTogetherInvitation,
  checkListenTogetherRoom,
  createListenTogetherRoom,
  endListenTogetherRoom,
  getListenTogetherPlaylist,
  getListenTogetherStatus,
  sendListenTogetherCommand,
  sendListenTogetherHeartbeat,
  syncListenTogetherPlaylist,
} from "../src/api/listenTogether.ts";

test("listen together wrappers normalize room, status and playlist responses", async () => {
  const originalFetch = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    urls.push(url);
    if (url.includes("room/create")) {
      return Response.json({
        data: { roomId: "room-1", ownerId: 8, memberNum: 1 },
      });
    }
    if (url.includes("status")) {
      return Response.json({
        data: {
          room: { roomId: "room-1", memberCount: 2 },
          songId: 12,
          playStatus: true,
          progress: 1234,
          playlist: [
            {
              id: 12,
              name: "同步歌曲",
              ar: [{ name: "歌手" }],
              al: { name: "专辑" },
            },
          ],
        },
      });
    }
    return Response.json({
      data: { songs: [{ id: 13, name: "歌单歌曲", ar: [{ name: "歌手" }] }] },
    });
  };
  try {
    const room = await createListenTogetherRoom();
    assert.equal(room.roomId, "room-1");
    assert.equal(room.memberCount, 1);
    const status = await getListenTogetherStatus();
    assert.equal(status.currentSongId, 12);
    assert.equal(status.playing, true);
    assert.equal(status.playlist[0]?.name, "同步歌曲");
    const playlist = await getListenTogetherPlaylist("room-1");
    assert.equal(playlist[0]?.id, 13);
    assert.match(urls[0]!, /\/listentogether\/room\/create/);
    assert.match(urls[1]!, /\/listentogether\/status/);
    assert.match(urls[2]!, /roomId=room-1/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("listen together mutations use expected routes, methods and parameters", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{
    url: string;
    method?: string;
    body?: unknown;
  }> = [];
  globalThis.fetch = async (input, init) => {
    calls.push({
      url: String(input),
      method: init?.method,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    });
    if (String(input).includes("room/check")) {
      return Response.json({
        data: { roomId: "r-2", ownerId: 7, memberCount: 1 },
      });
    }
    return Response.json({ code: 200, data: {} });
  };
  try {
    await checkListenTogetherRoom("r-2");
    await endListenTogetherRoom("r-2");
    await acceptListenTogetherInvitation("r-2", 7);
    await sendListenTogetherHeartbeat({
      roomId: "r-2",
      songId: 12,
      playStatus: true,
      progress: 400,
    });
    await sendListenTogetherCommand({
      roomId: "r-2",
      commandType: "play",
      progress: 400,
      playStatus: true,
      clientSeq: 3,
    });
    assert.equal(new URL(calls[0]!.url).pathname, "/listentogether/room/check");
    assert.equal(new URL(calls[0]!.url).searchParams.get("roomId"), "r-2");
    assert.equal(calls[0]!.method, "GET");
    assert.equal(new URL(calls[1]!.url).pathname, "/listentogether/end");
    assert.equal(calls[1]!.method, "POST");
    assert.equal(new URL(calls[2]!.url).pathname, "/listentogether/accept");
    assert.equal(new URL(calls[2]!.url).searchParams.get("inviterId"), "7");
    assert.equal(calls[2]!.method, "POST");
    // 心跳与播放指令必须走 JSON body：布尔/数字类型不能被 query 序列化破坏。
    assert.equal(new URL(calls[3]!.url).pathname, "/listentogether/heatbeat");
    assert.equal(calls[3]!.method, "POST");
    assert.equal(calls[3]!.body?.progress, 400);
    assert.equal(calls[3]!.body?.playStatus, true);
    assert.equal(
      new URL(calls[4]!.url).pathname,
      "/listentogether/play/command",
    );
    assert.equal(calls[4]!.method, "POST");
    assert.equal(calls[4]!.body?.clientSeq, 3);
    assert.equal(calls[4]!.body?.playStatus, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("listen together playlist sync posts a replace command with both lists", async () => {
  const originalFetch = globalThis.fetch;
  let payload: Record<string, unknown> | undefined;
  globalThis.fetch = async (input, init) => {
    assert.equal(
      new URL(String(input)).pathname,
      "/listentogether/sync/list/command",
    );
    assert.equal(init?.method, "POST");
    payload = JSON.parse(String(init?.body));
    return Response.json({ code: 200 });
  };
  try {
    await syncListenTogetherPlaylist({
      roomId: "r-2",
      userId: 7,
      version: 4,
      songIds: [12, 13],
    });
    assert.equal(payload?.commandType, "REPLACE");
    assert.equal(payload?.displayList, "12,13");
    assert.equal(payload?.randomList, "12,13");
    assert.equal(payload?.version, 4);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("listen together normalizes the service display list and remote playback state", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/listentogether/status")) {
      return Response.json({
        data: {
          inRoom: true,
          roomInfo: { roomId: "r-3", roomUsers: [{ userId: 1 }] },
          playingInfo: { trackId: 12, status: "PLAY", progress: 3210 },
          playlist: { displayList: { result: ["12"] } },
        },
      });
    }
    if (url.includes("/song/detail")) {
      return Response.json({
        songs: [{ id: 12, name: "远端歌曲", ar: [{ name: "歌手" }] }],
      });
    }
    return Response.json({ code: 200, data: {} });
  };
  try {
    const status = await getListenTogetherStatus();
    assert.equal(status.inRoom, true);
    assert.equal(status.room?.roomId, "r-3");
    assert.equal(status.currentSongId, 12);
    assert.equal(status.playing, true);
    assert.equal(status.progress, 3210);
    assert.equal(status.playlist[0]?.name, "远端歌曲");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
