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
  const [account, detail, binding] = await Promise.all([
    request<Obj>("/user/account", {}, false),
    request<Obj>("/user/detail/new", {}, false).catch(() => ({}) as Obj),
    request<Obj>("/user/binding", {}, false).catch(() => ({}) as Obj),
  ]);
  const profile = obj(detail.profile ?? detail.data ?? detail);
  const accountData = obj(account.account ?? account.data ?? account);
  const bindings = obj(binding.bindings ?? binding.data ?? binding);
  const phone = String(
    bindings.phone ?? bindings.mobile ?? accountData.mobile ?? "",
  );
  const email = String(bindings.email ?? accountData.email ?? "");
  return {
    userId: Number(accountData.id ?? accountData.userId ?? profile.userId ?? 0),
    nickname: String(profile.nickname ?? accountData.nickname ?? "网易云用户"),
    accountType: Number(accountData.type ?? accountData.accountType ?? 0),
    level: Number(profile.level ?? accountData.level ?? 0),
    vipType: Number(profile.vipType ?? accountData.vipType ?? 0),
    email,
    phone: phone ? maskPhone(phone) : "",
    bindings: Object.entries(bindings)
      .filter(
        ([key, value]) =>
          Boolean(value) &&
          ["phone", "mobile", "email", "qq", "weibo", "weixin"].includes(key),
      )
      .map(([key]) => key),
    detail: String(profile.signature ?? profile.description ?? ""),
  };
}
