import { create } from "zustand";
import {
  getProfileCenter,
  getUserMedals,
  getUserCreatedRadios,
  getUserDjPrograms,
  type ProfileDetail,
  type UserLevelInfo,
  type UserSubcount,
  type UserMedal,
} from "../api/profile";
import type { RadioInfo } from "../api/types";
import { usePlayerStore } from "./playerStore";

interface ProfileState {
  detail: ProfileDetail | null;
  level: UserLevelInfo | null;
  subcount: UserSubcount | null;
  medals: UserMedal[];
  createdRadios: RadioInfo[];
  createdPrograms: import("../api/types").Song[];
  loading: boolean;
  openProfile: (navigate?: boolean) => Promise<void>;
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

export const useProfileStore = create<ProfileState>()((set) => ({
  detail: null,
  level: null,
  subcount: null,
  medals: [],
  createdRadios: [],
  createdPrograms: [],
  loading: false,

  openProfile: async (navigate = true) => {
    const uid = usePlayerStore.getState().profile?.userId;
    if (!uid) {
      usePlayerStore.getState().setShowLogin(true);
      return;
    }
    const token = ++profileToken;
    if (navigate) showProfileView();
    set({ loading: true });
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
}));
