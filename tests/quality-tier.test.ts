import test from "node:test";
import assert from "node:assert/strict";
import {
  PLAYBACK_QUALITY_TIER,
  qualityAllowedFor,
  userQualityTier,
} from "../src/store/playerStore.ts";
import type { VipInfo } from "../src/api/client.ts";

const NOW = Date.now();
const base = { loggedIn: true, profile: null };

const vipInfo = (over: Partial<VipInfo>): VipInfo => ({
  vipType: 11,
  vipLevel: 7,
  expireTime: NOW + 30 * 24 * 3600 * 1000,
  ...over,
});

test("userQualityTier maps membership state to free/vip/svip", () => {
  assert.equal(userQualityTier({ ...base, loggedIn: false, vipInfo: null }), "free");
  // 未登录即使带残留 vipInfo 也按非会员
  assert.equal(
    userQualityTier({ loggedIn: false, profile: null, vipInfo: vipInfo({ svip: true }) }),
    "free",
  );
  // 无会员信息 + 无 profile → 非会员
  assert.equal(userQualityTier({ ...base, vipInfo: null }), "free");
  // 普通黑胶 VIP
  assert.equal(userQualityTier({ ...base, vipInfo: vipInfo({}) }), "vip");
  // SVIP：双包生效
  assert.equal(
    userQualityTier({ ...base, vipInfo: vipInfo({ vipType: 110, svip: true }) }),
    "svip",
  );
  // 会员过期（login/status 的 vipType 可能仍 >0）→ 非会员口径
  assert.equal(
    userQualityTier({
      loggedIn: true,
      profile: { userId: 1, vipType: 11 } as never,
      vipInfo: vipInfo({ expireTime: NOW - 1000 }),
    }),
    "free",
  );
  // 过期但缺 vipInfo 时回退 profile.vipType（无过期数据可依）
  assert.equal(
    userQualityTier({
      loggedIn: true,
      profile: { userId: 1, vipType: 11 } as never,
      vipInfo: null,
    }),
    "vip",
  );
});

test("qualityAllowedFor enforces free<vip<svip with downward compatibility", () => {
  for (const [quality, need] of Object.entries(PLAYBACK_QUALITY_TIER)) {
    assert.equal(qualityAllowedFor(quality as never, "free"), need === "free", quality);
    assert.equal(qualityAllowedFor(quality as never, "vip"), need !== "svip", quality);
    assert.equal(qualityAllowedFor(quality as never, "svip"), true, quality);
  }
});
