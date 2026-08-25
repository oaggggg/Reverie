import { request } from "./client.ts";
import type {
  HappySignInfo,
  SigninProgress,
  YunbeiLedgerEntry,
  YunbeiOverview,
  YunbeiTask,
} from "./types.ts";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value && typeof value === "object" ? (value as Obj) : {};
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export async function getHappySignInfo(): Promise<HappySignInfo> {
  const response = await request<Obj>("/sign/happy/info", {}, false);
  const value = obj(response.data ?? response.result ?? response);
  return {
    content: String(value.content ?? value.text ?? value.title ?? ""),
    author: String(value.author ?? value.source ?? value.from ?? ""),
    imageUrl: String(value.imageUrl ?? value.picUrl ?? value.cover ?? ""),
    date: String(value.date ?? value.time ?? value.createTime ?? ""),
  };
}

export async function getYunbeiOverview(): Promise<YunbeiOverview> {
  const [balance, info, today] = await Promise.all([
    request<Obj>("/yunbei", {}, false),
    request<Obj>("/yunbei/info", {}, false),
    request<Obj>("/yunbei/today", {}, false),
  ]);
  const balanceData = obj(balance.data ?? balance);
  const infoData = obj(info.data ?? info);
  const todayData = obj(today.data ?? today);
  return {
    balance: Number(
      balanceData.balance ?? balanceData.point ?? infoData.point ?? 0,
    ),
    todayEarned: Number(todayData.point ?? todayData.todayPoint ?? 0),
    signed: Boolean(
      todayData.isSigned ?? todayData.signed ?? balanceData.signed,
    ),
    signDays: Number(todayData.continuousDays ?? todayData.signDays ?? 0),
  };
}

export async function dailySignIn(type: 0 | 1 = 1): Promise<Obj> {
  return request<Obj>("/daily_signin", { type }, false, { method: "POST" });
}

export async function getSigninProgress(
  moduleId = "1207signin-1207signin",
): Promise<SigninProgress> {
  const response = await request<Obj>("/signin/progress", { moduleId }, false);
  const value = obj(response.data ?? response.result ?? response);
  const current = Number(
    value.current ?? value.progress ?? value.day ?? value.completedDays ?? 0,
  );
  const total = Number(value.total ?? value.totalDays ?? value.target ?? 0);
  return {
    moduleId: String(value.moduleId ?? moduleId),
    title: String(value.title ?? value.name ?? "签到进度"),
    description: String(value.description ?? value.desc ?? ""),
    current,
    total,
    completed: Boolean(
      value.completed ?? value.finished ?? (total > 0 && current >= total),
    ),
    reward: String(value.reward ?? value.rewardText ?? value.nextReward ?? ""),
  };
}

export async function yunbeiSign(): Promise<Obj> {
  return request<Obj>("/yunbei/sign", {}, false, { method: "POST" });
}

export async function getYunbeiTasks(): Promise<YunbeiTask[]> {
  const response = await request<Obj>("/yunbei/tasks", {}, false);
  return arr(response.data ?? response.tasks ?? response.list)
    .map((raw) => {
      const value = obj(raw);
      const status = String(value.status ?? value.taskStatus ?? "todo");
      return {
        id: Number(value.id ?? value.taskId ?? value.userTaskId ?? 0),
        name: String(value.name ?? value.taskName ?? "云贝任务"),
        description: String(value.description ?? value.taskDescription ?? ""),
        point: Number(value.point ?? value.reward ?? value.yunbei ?? 0),
        status:
          status === "done" || status === "2"
            ? "done"
            : status === "claimed" || status === "3"
              ? "claimed"
              : "todo",
        userTaskId: Number(value.userTaskId ?? value.id ?? 0) || undefined,
        depositCode: String(value.depositCode ?? "") || undefined,
      } satisfies YunbeiTask;
    })
    .filter((task) => task.id > 0);
}

export async function getYunbeiTodo(): Promise<YunbeiTask[]> {
  const response = await request<Obj>("/yunbei/tasks/todo", {}, false);
  return arr(response.data ?? response.tasks ?? response.list)
    .map((raw) => {
      const value = obj(raw);
      return {
        id: Number(value.id ?? value.taskId ?? value.userTaskId ?? 0),
        name: String(value.name ?? value.taskName ?? "待办任务"),
        description: String(value.description ?? value.taskDescription ?? ""),
        point: Number(value.point ?? value.reward ?? 0),
        status: "todo",
        userTaskId: Number(value.userTaskId ?? value.id ?? 0) || undefined,
        depositCode: String(value.depositCode ?? "") || undefined,
      } satisfies YunbeiTask;
    })
    .filter((task) => task.id > 0);
}

export async function finishYunbeiTask(
  userTaskId: number,
  depositCode = "0",
): Promise<void> {
  await request("/yunbei/task/finish", { userTaskId, depositCode }, false, {
    method: "POST",
  });
}

export async function getYunbeiLedger(
  type: "income" | "expense",
  limit = 20,
  offset = 0,
): Promise<YunbeiLedgerEntry[]> {
  const route = type === "income" ? "/yunbei/receipt" : "/yunbei/expense";
  const response = await request<Obj>(route, { limit, offset }, false);
  return arr(response.data ?? response.list ?? response.records).map(
    (raw, index) => {
      const value = obj(raw);
      return {
        id: String(value.id ?? value.recordId ?? `${type}-${offset + index}`),
        title: String(
          value.reason ?? value.description ?? value.name ?? "云贝记录",
        ),
        amount: Number(value.amount ?? value.point ?? value.yunbei ?? 0),
        time: Number(value.time ?? value.createTime ?? value.operateTime ?? 0),
        type,
      } satisfies YunbeiLedgerEntry;
    },
  );
}

export async function submitYunbeiRecommendation(input: {
  songId: number;
  reason?: string;
  yunbeiNum?: number;
}): Promise<void> {
  await request(
    "/yunbei/rcmd/song",
    {
      id: input.songId,
      reason: input.reason,
      yunbeiNum: input.yunbeiNum ?? 10,
    },
    false,
    { method: "POST" },
  );
}

export async function getYunbeiRecommendationHistory(
  size = 20,
  cursor = "",
): Promise<Obj[]> {
  const response = await request<Obj>(
    "/yunbei/rcmd/song/history",
    { size, cursor },
    false,
  );
  const value = obj(response.data ?? response.result ?? response);
  return arr(value.list ?? value.records ?? response.data ?? response).map(
    (item) => obj(item),
  );
}
