import { request } from "./client.ts";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value && typeof value === "object" ? (value as Obj) : {};

export interface AccountOverview {
  userId: number;
  nickname: string;
  accountType: number;
  level: number;
  vipType: number;
  email: string;
  phone: string;
  bindings: string[];
  detail: string;
}

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 7) return value;
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
}

export async function getAccountOverview(): Promise<AccountOverview> {
  // 第一步：/user/account 是账号身份的权威来源，必须成功；
  // 同时从它拿到 uid —— 下面的扩展接口都要求 uid。
  const account = await request<Obj>("/user/account", {}, false);
  // /user/account 同时携带 account{} 与 profile{}；profile 字段
  // （等级/会员/昵称/签名）比 detail 接口更全且随登录态实时更新，
  // 因此以它优先，detail 仅作补充。
  const accountData = obj(account.account ?? account.data ?? account);
  const accountProfile = obj(account.profile);
  // 匿名会话（游客 type=1000、无 profile）不算已登录：
  // 抛错让设置页显示“暂不可用”，而不是渲染全 0 的空壳概览。
  if (
    !Object.keys(accountProfile).length &&
    Number(accountData.type) === 1000
  ) {
    throw new Error("anonymous session");
  }
  const uid = Number(
    accountData.id ?? accountData.userId ?? accountProfile.userId ?? 0,
  );
  // 第二步：扩展信息各自独立降级。注意 /user/binding 与 /user/detail/new
  // 都要求 uid 参数，缺参时接口直接返回 code 400“参数错误”——
  // 实测这正是设置页绑定方式永远“未读取到”、手机/邮箱为空的根因。
  const [detail, binding] = await Promise.all([
    request<Obj>("/user/detail/new", { uid }, false).catch(() => ({}) as Obj),
    request<Obj>("/user/binding", { uid }, false).catch(() => ({}) as Obj),
  ]);
  const detailProfile = obj(detail.profile ?? detail.data ?? detail);
  const mergedProfile: Obj = { ...detailProfile };
  for (const [key, value] of Object.entries(accountProfile)) {
    if (value !== null && value !== undefined && value !== "") {
      mergedProfile[key] = value;
    }
  }
  const bindingsRaw = binding.bindings ?? binding.binding ?? binding.data;
  const bindings = Array.isArray(bindingsRaw)
    ? bindingsObjFromArray(bindingsRaw)
    : obj(bindingsRaw ?? binding);
  const phone = String(
    bindings.phone ?? bindings.mobile ?? accountData.mobile ?? "",
  );
  const email = String(bindings.email ?? accountData.email ?? "");
  return {
    userId: Number(
      accountData.id ?? accountData.userId ?? mergedProfile.userId ?? 0,
    ),
    nickname: String(mergedProfile.nickname ?? accountData.nickname ?? "网易云用户"),
    accountType: Number(accountData.type ?? accountData.accountType ?? 0),
    level: Number(mergedProfile.level ?? accountData.level ?? 0),
    vipType: Number(
      mergedProfile.vipType ?? accountData.vipType ?? accountProfile.vipType ?? 0,
    ),
    email,
    phone: phone ? maskPhone(phone) : "",
    bindings: Object.entries(bindings)
      .filter(
        ([key, value]) =>
          Boolean(value) &&
          ["phone", "mobile", "email", "qq", "weibo", "weixin"].includes(key),
      )
      .map(([key]) => key),
    detail: String(
      mergedProfile.signature ?? mergedProfile.description ?? "",
    ),
  };
}

/**
 * /user/binding 在不同版本返回数组（[{type,url},…]）或对象两种形态。
 * 数组形态的 type 是数字枚举：0 手机 / 2 邮箱 / 常见第三方见映射表。
 */
export function bindingsObjFromArray(value: unknown[]): Obj {
  const TYPE_NAMES: Record<number, string> = {
    0: "phone",
    1: "weibo",
    2: "email",
    3: "weixin",
    4: "qq",
  };
  const result: Obj = {};
  for (const raw of value) {
    const item = obj(raw);
    const key =
      TYPE_NAMES[Number(item.type)] || String(item.type ?? "") || "";
    if (!key) continue;
    // 出现在绑定列表里即视为已绑定；url 常为空字符串（falsy 但非空缺），
    // 不能用 `url ?? token ?? true` 判断，否则会把真实存在的绑定丢掉。
    if (!(key in result)) result[key] = true;
  }
  return result;
}
