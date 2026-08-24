import test from "node:test";
import assert from "node:assert/strict";
import {
  getVipGrowth,
  getVipGrowthDetails,
  getVipTasks,
  getVipTimeMachine,
} from "../src/api/vip.ts";

test("vip APIs normalize growth, tasks and history records", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("vip/growthpoint/details"))
      return Response.json({ data: [{ id: 3, reason: "播放", growth: 8 }] });
    if (url.includes("vip/tasks"))
      return Response.json({
        data: [
          {
            id: "t1",
            taskName: "听歌",
            reward: 5,
            completed: true,
            claimed: true,
          },
        ],
      });
    if (url.includes("vip/timemachine"))
      return Response.json({
        data: {
          recordTime: 1780675200000,
          notVipLimitNum: 3,
          hasnext: true,
          detail: [
            {
              type: 2,
              data: JSON.stringify({
                keyword: "睡前爱听华语流行",
                description: "这是最近常听的音乐标签",
              }),
            },
          ],
        },
      });
    return Response.json({
      data: { level: 4, growth: 80, nextLevelGrowth: 100 },
    });
  };
  try {
    const growth = await getVipGrowth();
    const tasks = await getVipTasks();
    const details = await getVipGrowthDetails();
    const timeMachine = await getVipTimeMachine();
    assert.equal(growth.level, 4);
    assert.equal(growth.progress, 0.8);
    assert.equal(tasks[0]?.completed, true);
    assert.equal(tasks[0]?.claimed, true);
    assert.equal(details[0]?.amount, 8);
    assert.equal(timeMachine.items[0]?.title, "睡前爱听华语流行");
    assert.equal(timeMachine.items[0]?.description, "这是最近常听的音乐标签");
    assert.equal(timeMachine.limitedCount, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
