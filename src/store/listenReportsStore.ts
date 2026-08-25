import { create } from "zustand";
import {
  getAnnualSummary,
  getListenRealtime,
  getListenReport,
  getListenTodaySongs,
  getListenTotal,
  getListenYearReport,
  getListenTimeMachine,
} from "../api/listenReports.ts";
import type {
  ListenReport,
  ListenTodaySong,
  ListenTotal,
  VipTimeMachineEntry,
} from "../api/types.ts";
interface State {
  period: "week" | "month" | "year";
  total: ListenTotal | null;
  report: ListenReport | null;
  today: ListenTodaySong[];
  annual: unknown;
  timeMachine: VipTimeMachineEntry[];
  loading: boolean;
  error: string;
  load: (period?: State["period"]) => Promise<void>;
}
let requestToken = 0;

export const useListenReportsStore = create<State>((set) => ({
  period: "week",
  total: null,
  report: null,
  today: [],
  annual: null,
  timeMachine: [],
  loading: false,
  error: "",
  load: async (nextPeriod) => {
    const period = nextPeriod ?? useListenReportsStore.getState().period;
    const token = ++requestToken;
    set({ period, loading: true, error: "" });
    const [total, report, today, annual, timeMachine] =
      await Promise.allSettled([
        getListenTotal(),
        period === "week" ? getListenRealtime("week") : getListenReport(period),
        getListenTodaySongs(),
        period === "year"
          ? getListenYearReport()
          : getAnnualSummary(new Date().getFullYear()),
        getListenTimeMachine(),
      ]);
    if (token !== requestToken) return;
    set({
      period,
      total: total.status === "fulfilled" ? total.value : null,
      report: report.status === "fulfilled" ? report.value : null,
      today: today.status === "fulfilled" ? today.value : [],
      annual: annual.status === "fulfilled" ? annual.value : null,
      timeMachine: timeMachine.status === "fulfilled" ? timeMachine.value : [],
      loading: false,
      error:
        total.status === "rejected" && report.status === "rejected"
          ? "听歌报告暂时不可用"
          : "",
    });
  },
}));
