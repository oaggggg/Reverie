import assert from "node:assert/strict";
import test from "node:test";
import { loginStatus, sanitizeNcmCookie } from "../src/api/client.ts";

/** 用桩替换全局 fetch，驱动 loginStatus 走真实解析路径。 */
async function withFetch(
  payload: unknown,
  run: () => Promise<void>,
): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
  try {
    await run();
  } finally {
    globalThis.fetch = original;
  }
}

test("loginStatus parses the wrapped logged-in /login/status shape", async () => {
  await withFetch(
    {
      data: {
        code: 200,
        account: { id: 123, type: 11, status: 0, vipType: 11 },
        profile: {
          userId: 123,
          nickname: "测试用户",
          avatarUrl: "https://p1.music.126.net/x.jpg",
          vipType: 11,
        },
      },
    },
    async () => {
      const profile = await loginStatus();
      assert.ok(profile);
      assert.equal(profile.userId, 123);
      assert.equal(profile.nickname, "测试用户");
    },
  );
});

test("loginStatus rejects the anonymous fallback account", async () => {
  await withFetch(
    {
      data: {
        code: 200,
        account: {
          id: 17859111519,
          type: 1000,
          status: -10,
          anonimousUser: true,
        },
      },
    },
    async () => {
      const profile = await loginStatus();
      assert.equal(profile, null);
    },
  );
});

test("loginStatus handles transient not-logged-in codes as null", async () => {
  await withFetch({ data: { code: 301 } }, async () => {
    const profile = await loginStatus();
    assert.equal(profile, null);
  });
});

test("sanitizeNcmCookie strips Set-Cookie attribute noise", () => {
  const raw =
    "MUSIC_U=abc123; Path=/; Max-Age=15552000; Expires=Tue, 23 Feb 2027 08:00:00 GMT, " +
    "MUSIC_A=def456; Path=/; Domain=music.163.com, __csrf_token=xyz; Path=/";
  assert.equal(
    sanitizeNcmCookie(raw),
    "MUSIC_U=abc123; MUSIC_A=def456; __csrf_token=xyz",
  );
});

test("sanitizeNcmCookie falls back to trimmed input when nothing matches", () => {
  assert.equal(sanitizeNcmCookie(""), "");
  assert.equal(sanitizeNcmCookie("whatever"), "whatever");
});
