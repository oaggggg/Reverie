import test from "node:test";
import assert from "node:assert/strict";
import {
  findVipRights,
  pickActiveDynamicBadge,
  pickOfficialBrandIcon,
} from "../src/api/client.ts";

const L7_ASSET =
  "https://p5.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/31289847457/5230/7279/6543/ee2a0c6b2941a9647669e3ca522c350a.png";

test("pickActiveDynamicBadge 按官方优先级取在期包的动态铭牌", () => {
  const NOW = Date.now();
  // 黑胶优先于畅听包
  assert.equal(
    pickActiveDynamicBadge({
      associator: {
        dynamicIconUrl: "https://x/vinyl.webp",
        expireTime: NOW + 86_400_000,
      },
      musicPackage: {
        dynamicIconUrl: "https://x/pkg.webp",
        expireTime: NOW + 86_400_000,
      },
    }),
    "https://x/vinyl.webp",
  );
  // 黑胶过期不借用：跳过失效包取在期畅听包（旧图残留防护）
  assert.equal(
    pickActiveDynamicBadge({
      associator: {
        dynamicIconUrl: "https://x/stale.webp",
        expireTime: NOW - 1000,
      },
      musicPackage: {
        dynamicIconUrl: "https://x/live.webp",
        expireTime: NOW + 60_000,
      },
    }),
    "https://x/live.webp",
  );
  // 秒级时间戳按 parseEpoch 归一后同样判为在期
  assert.equal(
    pickActiveDynamicBadge({
      associator: {
        dynamicIconUrl: "https://x/sec.webp",
        expireTime: Math.floor((NOW + 60_000) / 1000),
      },
    }),
    "https://x/sec.webp",
  );
  // 全部过期 → 空串，交由后续来源接管
  assert.equal(
    pickActiveDynamicBadge({
      associator: { dynamicIconUrl: "https://x/gone.webp", expireTime: 1 },
    }),
    "",
  );
});

test("pickOfficialBrandIcon 以 redplus(vipCode=300) 为 SVIP 权威证据", () => {
  // SVIP：redplus 命中即返回其图标，且 svip 标志为真——不再落 VIP 等级分支
  assert.deepEqual(
    pickOfficialBrandIcon({
      associator: { rights: true },
      redVipLevel: 7,
      redplus: {
        vipCode: 300,
        rights: true,
        iconUrl: "https://p1.music.126.net/svip.png",
      },
    }),
    { url: "https://p1.music.126.net/svip.png", svip: true },
  );
  // SVIP 但无图标：身份仍成立，url 为空由上层走文字铭牌兜底
  assert.deepEqual(
    pickOfficialBrandIcon({
      redplus: { vipCode: 300, rights: true },
    }),
    { url: "", svip: true },
  );
  // redplus 非 300（如普通红Vip）不算 SVIP
  const notSvip = pickOfficialBrandIcon({
    redplus: { vipCode: 100, rights: true, iconUrl: "https://x/a.png" },
    associator: { rights: true, iconUrl: "https://x/vip7.png" },
  });
  assert.equal(notSvip?.svip, false);
});

test("pickOfficialBrandIcon 按官方模板顺序回退", () => {
  // 黑胶在期且有专属图标 → 直接使用
  assert.deepEqual(
    pickOfficialBrandIcon({
      associator: { rights: true, iconUrl: "https://x/vip.png" },
      redVipLevel: 5,
    }),
    { url: "https://x/vip.png", svip: false },
  );
  // 无专属图标但有等级 → 官方静态等级资产（level 7）
  assert.deepEqual(
    pickOfficialBrandIcon({ associator: { rights: true }, redVipLevel: 7 }),
    { url: L7_ASSET, svip: false },
  );
  // 仅畅听包
  assert.deepEqual(
    pickOfficialBrandIcon({
      musicPackage: { rights: true, iconUrl: "https://x/pkg.png" },
    }),
    { url: "https://x/pkg.png", svip: false },
  );
  // 年费 VIP（等级缺失时走官方年费资产）
  assert.equal(
    pickOfficialBrandIcon({
      associator: { rights: true },
      redVipAnnualCount: 2,
    })?.url,
    "https://p6.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/31290261228/d8c6/b0fb/b236/ccc907aabf076e224ac6f2ae76d045e3.png",
  );
  // 黑胶在期但无等级图标 → 默认 VIP 资产；rights 缺失则整体不命中
  assert.ok(
    pickOfficialBrandIcon({ associator: { rights: true } })?.url.startsWith(
      "https://",
    ),
  );
  assert.equal(pickOfficialBrandIcon({ associator: {} }), null);
  assert.equal(pickOfficialBrandIcon(null), null);
});

test("findVipRights 在常见响应形态中定位 profile.vipRights", () => {
  const vr = { redVipLevel: 9 };
  assert.equal(findVipRights({ profile: { vipRights: vr } }), vr);
  assert.equal(findVipRights({ data: { profile: { vipRights: vr } } }), vr);
  assert.equal(findVipRights({ profile: null }), null);
});
