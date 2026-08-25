import { mkdir, readdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { serveNcmApi } = require("NeteaseCloudMusicApi");

const port = 3979;
const base = `http://127.0.0.1:${port}`;
const moduleDir = new URL(
  "../node_modules/NeteaseCloudMusicApi/module/",
  import.meta.url,
);
const excluded = new Set([
  "activate_init_profile",
  "captcha_sent",
  "captcha_verify",
  "cellphone_existence_check",
  "countries_code_list",
  "login",
  "login_cellphone",
  "login_refresh",
  "logout",
  "nickname_check",
  "rebind",
  "register_anonimous",
  "register_cellphone",
  "user_replacephone",
  "verify_getQr",
  "verify_qrcodestatus",
  "user_bindingcellphone",
  "user_update",
  "user_social_status_edit",
  "avatar_upload",
]);
const specialRoutes = {
  daily_signin: "/daily_signin",
  fm_trash: "/fm_trash",
  personal_fm: "/personal_fm",
};

const files = await readdir(moduleDir);
const routes = files
  .filter((file) => file.endsWith(".js"))
  .map((file) => file.slice(0, -3))
  .filter((name) => !excluded.has(name))
  .sort()
  .map((name) => ({
    name,
    path: specialRoutes[name] ?? `/${name.replaceAll("_", "/")}`,
  }));

const results = [];
const concurrency = 12;
let cursor = 0;

async function probe(route) {
  const url = `${base}${route.path}?timestamp=${Date.now()}`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const body = await response.text();
    const contentType = response.headers.get("content-type") ?? "";
    const missing =
      response.status === 404 &&
      !contentType.includes("application/json") &&
      /cannot get|not found/i.test(body);
    return {
      ...route,
      status: response.status,
      reachable: !missing,
      detail: missing ? "route-not-found" : body.slice(0, 180),
    };
  } catch (error) {
    return {
      ...route,
      status: 0,
      reachable: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function worker() {
  while (cursor < routes.length) {
    const index = cursor++;
    results[index] = await probe(routes[index]);
  }
}

const server = await serveNcmApi({
  port,
  host: "127.0.0.1",
  checkVersion: false,
});
try {
  await Promise.all(Array.from({ length: concurrency }, worker));
} finally {
  await new Promise((resolve) => server.server?.close(resolve));
}

const missing = results.filter((item) => !item.reachable);
const report = {
  timestamp: new Date().toISOString(),
  total: routes.length,
  reachable: routes.length - missing.length,
  missing: missing.length,
  results,
};
await mkdir("test-results", { recursive: true });
await writeFile(
  "test-results/api-coverage-report.json",
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(`接口路由覆盖: ${report.reachable}/${report.total} 可达`);
if (missing.length) {
  console.log("不可达接口:");
  for (const item of missing)
    console.log(`  ${item.name} (${item.path}) -> ${item.detail}`);
}
process.exit(missing.length ? 1 : 0);
