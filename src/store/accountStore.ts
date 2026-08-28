import type { UserProfile } from "../api/types.ts";

export const MAX_SAVED_ACCOUNTS = 3;
const STORAGE_KEY = "reverie_saved_accounts";

export interface SavedAccount {
  userId: number;
  nickname: string;
  avatarUrl: string;
  vipType: number;
  cookie: string;
  lastUsedAt: number;
}

function readAccounts(): SavedAccount[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (item): item is SavedAccount =>
        item && Number(item.userId) > 0 && typeof item.cookie === "string",
    );
  } catch {
    return [];
  }
}

function writeAccounts(accounts: SavedAccount[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  } catch {
    /* local storage may be unavailable in private browser contexts */
  }
}

export function getSavedAccounts(): SavedAccount[] {
  return readAccounts().sort((a, b) => b.lastUsedAt - a.lastUsedAt);
}

export function getSavedAccount(userId: number): SavedAccount | null {
  return readAccounts().find((item) => item.userId === userId) || null;
}

export function saveAccount(profile: UserProfile, cookie: string): void {
  const accounts = readAccounts();
  const existing = accounts.findIndex((item) => item.userId === profile.userId);
  const next: SavedAccount = {
    userId: profile.userId,
    nickname: profile.nickname,
    avatarUrl: profile.avatarUrl,
    vipType: profile.vipType,
    cookie,
    lastUsedAt: Date.now(),
  };
  if (existing >= 0) accounts[existing] = next;
  else accounts.push(next);
  writeAccounts(accounts.slice(-MAX_SAVED_ACCOUNTS));
}

export function removeSavedAccount(userId: number): void {
  writeAccounts(readAccounts().filter((item) => item.userId !== userId));
}

export function hasReachedAccountLimit(userId?: number): boolean {
  const accounts = readAccounts();
  return accounts.length >= MAX_SAVED_ACCOUNTS &&
    (userId === undefined || !accounts.some((item) => item.userId === userId));
}
