import { create } from "zustand";
import {
  getPersonalizedMvs,
  getPersonalizedNewSongs,
  getPrivateContent,
  getPrivateContentList,
  getRecommendResources,
} from "../api/discovery.ts";
import type { PlaylistInfo, SearchMediaInfo, Song } from "../api/types.ts";
import { getStarpickCommentsSummary } from "../api/starpick.ts";
import { usePlayerStore } from "./playerStore";

interface DiscoveryState {
  newSongs: Song[];
  mvs: SearchMediaInfo[];
  privateContent: SearchMediaInfo[];
  recommendResources: PlaylistInfo[];
  starpickComments: import("../api/types.ts").CommentInfo[];
  loading: boolean;
  load: () => Promise<void>;
}

/** 已有数据的静默刷新节流：窗口内重复挂载首页不重复打接口。 */
const DISCOVERY_REFRESH_TTL = 10 * 60 * 1000;
let lastLoadedAt = 0;

export const useDiscoveryStore = create<DiscoveryState>()((set) => ({
  newSongs: [],
  mvs: [],
  privateContent: [],
  recommendResources: [],
  starpickComments: [],
  loading: false,
  load: async () => {
    // 未登录：清空并跳过所有发现页内容。
    if (!usePlayerStore.getState().loggedIn) {
      set({
        newSongs: [],
        mvs: [],
        privateContent: [],
        recommendResources: [],
        starpickComments: [],
        loading: false,
      });
      return;
    }
    // 已有数据时节流 + 静默刷新：不置 loading，避免每次进入首页
    // 都用骨架屏替换已有内容造成白闪；只有空数据才显示加载态。
    const hasData = Boolean(
      useDiscoveryStore.getState().recommendResources.length ||
        useDiscoveryStore.getState().newSongs.length,
    );
    if (hasData && Date.now() - lastLoadedAt < DISCOVERY_REFRESH_TTL) {
      return;
    }
    const silent = hasData;
    if (!silent) set({ loading: true });
    const [
      newSongs,
      mvs,
      privateContent,
      privateContentList,
      recommendResources,
      starpickComments,
    ] = await Promise.allSettled([
      getPersonalizedNewSongs(),
      getPersonalizedMvs(),
      getPrivateContent(),
      getPrivateContentList(),
      getRecommendResources(),
      getStarpickCommentsSummary(),
    ]);
    const privateItems = [
      ...(privateContent.status === "fulfilled" ? privateContent.value : []),
      ...(privateContentList.status === "fulfilled"
        ? privateContentList.value
        : []),
    ].filter(
      (item, index, items) =>
        items.findIndex((entry) => entry.id === item.id) === index,
    );
    set({
      newSongs: newSongs.status === "fulfilled" ? newSongs.value : [],
      mvs: mvs.status === "fulfilled" ? mvs.value : [],
      privateContent: privateItems,
      recommendResources:
        recommendResources.status === "fulfilled"
          ? recommendResources.value
          : [],
      starpickComments:
        starpickComments.status === "fulfilled" ? starpickComments.value : [],
      loading: false,
    });
    lastLoadedAt = Date.now();
  },
}));
