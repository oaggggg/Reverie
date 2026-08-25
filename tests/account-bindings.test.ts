import assert from "node:assert/strict";
import test from "node:test";
import { bindingsObjFromArray } from "../src/api/account.ts";

test("bindingsObjFromArray treats presence as bound even when url is empty", () => {
  // 实测 /user/binding 返回的绑定项 url 常为空字符串（非 null/undefined），
  // 旧的 `url ?? token ?? true` 判定会把真实存在的绑定误判为未绑定。
  const result = bindingsObjFromArray([
    { type: 0, url: "", expired: false },
    { type: 2, url: "mailto:user@example.com" },
    { type: 4, url: "", token: null },
  ]);
  assert.deepEqual(result, { phone: true, email: true, qq: true });
});

test("bindingsObjFromArray keeps unknown type codes as string keys", () => {
  const result = bindingsObjFromArray([{ type: 9, url: "x" }]);
  assert.deepEqual(result, { "9": true });
});
