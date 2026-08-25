import assert from "node:assert/strict";
import test from "node:test";
import { cachedRequest, request } from "../src/api/client.ts";

test("GET retries transient upstream failures", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return calls === 1
      ? new Response("temporary", { status: 503 })
      : Response.json({ ok: true });
  };
  try {
    assert.deepEqual(await request<{ ok: boolean }>("/stability/retry"), {
      ok: true,
    });
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GET timeout remains retryable", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (_input, init) =>
    new Promise((resolve, reject) => {
      calls += 1;
      const signal = init?.signal;
      if (signal?.aborted) {
        reject(new DOMException("aborted", "AbortError"));
        return;
      }
      signal?.addEventListener("abort", () => {
        if (calls === 1) reject(new DOMException("aborted", "AbortError"));
        else resolve(Response.json({ ok: true }));
      }, { once: true });
    });
  try {
    assert.deepEqual(
      await request<{ ok: boolean }>("/stability/timeout", {}, false, { timeoutMs: 1000 }),
      { ok: true },
    );
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("POST does not retry unless explicitly enabled", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response("temporary", { status: 503 });
  };
  try {
    await assert.rejects(
      request("/stability/mutation", {}, false, {
        method: "POST",
        body: "payload",
      }),
      /HTTP 503/,
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("request accepts an empty 204 response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 204 });
  try {
    assert.deepEqual(await request("/stability/empty"), {});
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("cached read falls back to a recent value during an outage", async () => {
  const originalFetch = globalThis.fetch;
  let available = true;
  const unique = Date.now();
  globalThis.fetch = async () => {
    if (!available) throw new TypeError("network unavailable");
    return Response.json({ value: 42 });
  };
  try {
    assert.deepEqual(
      await cachedRequest<{ value: number }>("/stability/stale", { unique }, 1),
      { value: 42 },
    );
    available = false;
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.deepEqual(
      await cachedRequest<{ value: number }>("/stability/stale", { unique }, 1),
      { value: 42 },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
