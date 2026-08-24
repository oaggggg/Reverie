import test from "node:test";
import assert from "node:assert/strict";
import {
  dailySignIn,
  finishYunbeiTask,
  getHappySignInfo,
  getSigninProgress,
  getYunbeiLedger,
  getYunbeiOverview,
  getYunbeiRecommendationHistory,
  getYunbeiTasks,
  submitYunbeiRecommendation,
} from "../src/api/yunbei.ts";

test("yunbei recommendation actions forward expected params", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    calls.push(String(input));
    return Response.json({ data: { list: [] } });
  };
  try {
    await submitYunbeiRecommendation({
      songId: 4,
      reason: "推荐",
      yunbeiNum: 12,
    });
    await getYunbeiRecommendationHistory(10, "cursor");
    assert.match(
      calls[0]!,
      /yunbei\/rcmd\/song\?id=4&reason=%E6%8E%A8%E8%8D%90&yunbeiNum=12/,
    );
    assert.match(
      calls[1]!,
      /yunbei\/rcmd\/song\/history\?size=10&cursor=cursor/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("yunbei overview combines balance, daily points and sign state", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/yunbei/info"))
      return Response.json({ data: { point: 88 } });
    if (url.includes("/yunbei/today"))
      return Response.json({
        data: { point: 6, isSigned: true, continuousDays: 4 },
      });
    return Response.json({ data: { balance: 120 } });
  };
  try {
    const overview = await getYunbeiOverview();
    assert.deepEqual(overview, {
      balance: 120,
      todayEarned: 6,
      signed: true,
      signDays: 4,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("yunbei tasks, sign-in and ledger use their dedicated routes", async () => {
  const originalFetch = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    urls.push(url);
    if (url.includes("/yunbei/tasks"))
      return Response.json({
        data: [{ id: 1, name: "签到", point: 5, status: "done" }],
      });
    if (url.includes("/yunbei/receipt"))
      return Response.json({ data: [{ id: 2, reason: "任务", point: 5 }] });
    return Response.json({ code: 200 });
  };
  try {
    const tasks = await getYunbeiTasks();
    await dailySignIn(1);
    await finishYunbeiTask(1, "0");
    const ledger = await getYunbeiLedger("income");
    assert.equal(tasks[0]?.status, "done");
    assert.equal(ledger[0]?.amount, 5);
    assert.match(urls[0]!, /\/yunbei\/tasks/);
    assert.match(urls[1]!, /\/daily_signin/);
    assert.match(urls[2]!, /\/yunbei\/task\/finish/);
    assert.match(urls[3]!, /\/yunbei\/receipt/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sign-in progress normalizes completion and reward fields", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, "/signin/progress");
    assert.equal(url.searchParams.get("moduleId"), "module-test");
    return Response.json({
      data: {
        title: "连续签到",
        description: "完成本阶段签到",
        current: 3,
        total: 7,
        rewardText: "云贝 20",
      },
    });
  };
  try {
    const progress = await getSigninProgress("module-test");
    assert.equal(progress.current, 3);
    assert.equal(progress.total, 7);
    assert.equal(progress.completed, false);
    assert.equal(progress.reward, "云贝 20");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("happy sign info normalizes quote metadata", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, "/sign/happy/info");
    return Response.json({ data: { text: "保持热爱，奔赴山海", source: "乐签", date: "2026-08-22", picUrl: "cover" } });
  };
  try {
    const info = await getHappySignInfo();
    assert.deepEqual(info, { content: "保持热爱，奔赴山海", author: "乐签", imageUrl: "cover", date: "2026-08-22" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
