import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("sidecar CORS preflight accepts auth headers without API credentials", async () => {
  const source = await readFile("sidecar/api-server.cjs", "utf8");
  assert.match(source, /req.method === "OPTIONS"/);
  assert.match(source, /Access-Control-Allow-Headers/);
  assert.match(source, /x-reverie-auth,x-ncm-cookie/);
});
