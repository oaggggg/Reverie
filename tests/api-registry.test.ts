import assert from "node:assert/strict";
import test from "node:test";
import {
  API_ENDPOINT_COUNT,
  API_ENDPOINTS,
  API_MODULE_COUNT,
  EXCLUDED_API_COUNT,
  EXCLUDED_API_NAMES,
  callApi,
} from "../src/api/generated.ts";

test("generated registry covers every allowed NeteaseCloudMusicApi module", () => {
  assert.equal(API_MODULE_COUNT, 377);
  assert.equal(API_ENDPOINT_COUNT, 286);
  assert.equal(EXCLUDED_API_COUNT, 91);
  assert.equal(Object.keys(API_ENDPOINTS).length, API_ENDPOINT_COUNT);
  assert.equal(EXCLUDED_API_NAMES.length, EXCLUDED_API_COUNT);
});

test("routes follow the NeteaseCloudMusicApi underscore-to-slash convention", () => {
  assert.equal(API_ENDPOINTS.album_detail, "/album/detail");
  assert.equal(API_ENDPOINTS.song_url_v1, "/song/url/v1");
  assert.equal(API_ENDPOINTS.djRadio_top, "/djRadio/top");
  assert.equal(API_ENDPOINTS.user_playlist, "/user/playlist");
  assert.equal(API_ENDPOINTS.daily_signin, "/daily_signin");
  assert.equal(API_ENDPOINTS.fm_trash, "/fm_trash");
  assert.equal(API_ENDPOINTS.personal_fm, "/personal_fm");
  assert.equal("login_cellphone" in API_ENDPOINTS, false);
  assert.equal("register_cellphone" in API_ENDPOINTS, false);
  assert.equal("user_replacephone" in API_ENDPOINTS, false);
});

test("callApi forwards the generated route and query parameters", async () => {
  const originalFetch = globalThis.fetch;
  let called = "";
  try {
    globalThis.fetch = (async (input) => {
      called = String(input);
      return new Response(JSON.stringify({ code: 200, ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    const response = await callApi<{ code: number; ok: boolean }>("album", {
      id: 42,
      cookie: null,
    });
    assert.deepEqual(response, { code: 200, ok: true });
    assert.match(called, /\/album\?/);
    assert.match(called, /id=42/);
    assert.doesNotMatch(called, /cookie=null/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("callApi supports POST bodies for upload and mutation endpoints", async () => {
  const originalFetch = globalThis.fetch;
  let method = "";
  let body: BodyInit | null | undefined;
  try {
    globalThis.fetch = (async (_input, init) => {
      method = String(init?.method);
      body = init?.body;
      return new Response(JSON.stringify({ code: 200 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    await callApi("playlist_update", {}, true, {
      method: "POST",
      body: new URLSearchParams({ name: "demo" }),
    });
    assert.equal(method, "POST");
    assert.ok(body instanceof URLSearchParams);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
