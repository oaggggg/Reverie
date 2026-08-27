import { create } from "zustand";
import {
  getListeningRecords,
  getProfileCenter,
  getUserMedals,
  getUserCreatedRadios,
  getUserDjPrograms,
  type ListeningRecord,
  type ProfileDetail,
  type UserLevelInfo,
  type UserSubcount,
  type UserMedal,
} from "../api/profile";
import type { RadioInfo } from "../api/types";
import { usePlayerStore } from "./playerStore";

type RecordPeriod = "week" | "all";

interface ProfileState {
  detail: ProfileDetail | null;
  level: UserLevelInfo | null;
  subcount: UserSubcount | null;
  medals: UserMedal[];
  createdRadios: RadioInfo[];
  createdPrograms: import("../api/types").Song[];
  records: ListeningRecord[];
  period: RecordPeriod;
  loading: boolean;
  recordsLoading: boolean;
  openProfile: (navigate?: boolean) => Promise<void>;
  setPeriod: (period: RecordPeriod) => Promise<void>;
}

function showProfileView() {
  const player = usePlayerStore.getState();
  const previous = player.activeView;
  player.setPage("browse");
  player.setSearchOpen(false);
  usePlayerStore.setState({
    activeView: "profile",
    prevView: previous === "profile" ? player.prevView : previous,
  });
}

let profileToken = 0;
let recordsToken = 0;

/** 远端档案缺少身份字段（昵称/头像均为空）时，用本地登录资料补齐。 */
export function mergeWithCachedIdentity(
  detail: ProfileDetail,
): ProfileDetail {
  if (detail.nickname || detail.avatarUrl) return detail;
  const cached = usePlayerStore.getState().profile;
  if (!cached) return detail;
  return {
    ...detail,
    userId: detail.userId || cached.userId,
    nickname: cached.nickname,
    avatarUrl: cached.avatarUrl || detail.avatarUrl,
    signature: detail.signature || cached.signature || "",
  };
}

export const useProfileStore = create<ProfileState>()((set, get) => ({
  detail: null,
  level: null,
  subcount: null,
  medals: [],
  createdRadios: [],
  createdPrograms: [],
  records: [],
  period: "week",
  loading: false,
  recordsLoading: false,

  openProfile: async (navigate = true) => {
    const uid = usePlayerStore.getState().profile?.userId;
    if (!uid) {
      usePlayerStore.getState().setShowLogin(true);
      return;
    }
    const token = ++profileToken;
    if (navigate) showProfileView();
    set({ loading: true, period: "week" });
    try {
      const [data, medals, createdRadios, createdPrograms] = await Promise.all([
        getProfileCenter(uid),
        getUserMedals(uid).catch(() => []),
        getUserCreatedRadios(uid).catch(() => []),
        getUserDjPrograms(uid).catch(() => []),
      ]);
      if (token !== profileToken) return;
      set({
        // 远端 /user/detail 偶发失败时 getProfileCenter 返回空档案；
        // 叠加本地缓存的登录身份，页面至少展示头像/昵称而不是“没有数据”。
        detail: mergeWithCachedIdentity(data.detail),
        level: data.level,
        subcount: data.subcount,
        records: data.records,
        medals,
        createdRadios,
        createdPrograms,
      });
    } catch {
      if (token !== profileToken) return;
      usePlayerStore.getState().toast("加载个人中心失败", "error");
    } finally {
      if (token === profileToken) set({ loading: false });
    }
  },

  setPeriod: async (period) => {
    if (period === get().period && get().records.length) return;
    const uid = usePlayerStore.getState().profile?.userId;
    if (!uid) return;
    const token = ++recordsToken;
    ++profileToken; // 作废仍在途的 openProfile，防止其 records 覆盖当前周期
    set({ period, recordsLoading: true });
    try {
      const records = await getListeningRecords(uid, period);
      if (token !== recordsToken) return;
      set({ records });
    } catch {
      if (token !== recordsToken) return;
      usePlayerStore.getState().toast("加载听歌排行失败", "error");
    } finally {
      if (token === recordsToken) set({ recordsLoading: false });
    }
  },
}));
