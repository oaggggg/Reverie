import { create } from "zustand";
import {
  getVipGrowth,
  getVipGrowthpointInfo,
  getVipGrowthDetails,
  getVipTasks,
  getVipTimeMachine,
  claimVipTaskRewards,
} from "../api/vip.ts";
import type {
  VipGrowthEntry,
  VipGrowthInfo,
  VipTask,
  VipTimeMachineInfo,
} from "../api/types.ts";
import { usePlayerStore } from "./playerStore.ts";

interface VipState {
  growth: VipGrowthInfo | null;
  tasks: VipTask[];
  details: VipGrowthEntry[];
  timeMachine: VipTimeMachineInfo | null;
  growthInfo: Record<string, unknown> | null;
  loading: boolean;
  claiming: boolean;
  load: () => Promise<void>;
  claimRewards: (taskIds: string[]) => Promise<void>;
}

export const useVipStore = create<VipState>()((set, get) => ({
  growth: null,
  tasks: [],
  details: [],
  timeMachine: null,
  growthInfo: null,
  loading: false,
  claiming: false,
  load: async () => {
    set({ loading: true });
    const [growth, tasks, details, timeMachine, growthInfo] = await Promise.allSettled([
      getVipGrowth(),
      getVipTasks(),
      getVipGrowthDetails(),
      getVipTimeMachine(),
      getVipGrowthpointInfo(),
    ]);
    set({
      growth: growth.status === "fulfilled" ? growth.value : null,
      tasks: tasks.status === "fulfilled" ? tasks.value : [],
      details: details.status === "fulfilled" ? details.value : [],
      timeMachine:
        timeMachine.status === "fulfilled" ? timeMachine.value : null,
      growthInfo:
        growthInfo.status === "fulfilled" ? growthInfo.value : null,
      loading: false,
    });
    if (growth.status === "rejected")
      usePlayerStore
        .getState()
        .toast("加载会员中心失败，请确认登录状态", "error");
  },
  claimRewards: async (taskIds) => {
    const ids = taskIds.filter(Boolean);
    if (!ids.length || get().claiming) return;
    set({ claiming: true });
    try {
      await claimVipTaskRewards(ids);
      usePlayerStore.getState().toast("成长值奖励已领取", "success");
      await get().load();
    } catch (error) {
      usePlayerStore
        .getState()
        .toast(
          error instanceof Error ? error.message : "领取成长值失败",
          "error",
        );
    } finally {
      set({ claiming: false });
    }
  },
}));
