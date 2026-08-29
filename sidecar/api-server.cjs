"use strict";

const { existsSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

// NeteaseCloudMusicApi reads this file while its request module is loading.
// Create it before requiring the server so a fresh packaged sidecar can start.
const anonymousTokenPath = join(tmpdir(), "anonymous_token");
if (!existsSync(anonymousTokenPath)) {
  writeFileSync(anonymousTokenPath, "", "utf8");
}

const { serveNcmApi, getModulesDefinitions } = require("NeteaseCloudMusicApi/server");
const { bareForm, matchPrefecture } = require("./prefecture.cjs");
const path = require("node:path");

const port = Number(process.env.PORT || 3939);
const host = process.env.HOST || "127.0.0.1";
const parentPid = Number(process.env.PARENT_PID || 0);
// 每次由宿主应用随机生成的共享密钥；未设置时仅限本机开发调试。
const authToken = process.env.REVERIE_AUTH_TOKEN || "";
// The Vite browser used during `tauri dev` cannot invoke the native token
// command. Allow that browser-only path in debug builds; packaged builds keep
// mandatory shared-secret protection.
const allowUnauthenticatedDev = process.env.REVERIE_ALLOW_UNAUTH === "1";

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i];
  return diff === 0;
}

/**
 * HTTP 层包装：在 express 路由之前统一执行
 * 1. /reverie/health 健康检查（宿主用于确认端口归属）；
 * 2. 共享密钥校验，未携带正确 x-reverie-auth 的请求一律 403，
 *    阻断浏览器中任意网页对 localhost API 的跨域调用；
 * 3. 把前端放在 x-ncm-cookie 头里的会话凭证并入 Cookie 头，
 *    避免凭证出现在 URL/日志/缓存键中。
 */
function wrapServer(server) {
  const originalListeners = server.listeners("request").slice();
  server.removeAllListeners("request");
  server.on("request", (req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": req.headers.origin || "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers":
          req.headers["access-control-request-headers"] ||
          "content-type,x-reverie-auth,x-ncm-cookie",
        "Access-Control-Max-Age": "600",
      });
      res.end();
      return;
    }

    const finishUnauthorized = () => {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ code: 403, msg: "unauthorized" }));
    };

    // 健康检查同样要求密钥：能通过即证明占用端口的是本实例的 sidecar。
    if (req.url && req.url.startsWith("/reverie/health")) {
      if (
        !allowUnauthenticatedDev &&
        (!authToken ||
          !timingSafeEqual(req.headers["x-reverie-auth"] || "", authToken))
      ) {
        finishUnauthorized();
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (
      authToken &&
      !allowUnauthenticatedDev &&
      !timingSafeEqual(req.headers["x-reverie-auth"] || "", authToken)
    ) {
      finishUnauthorized();
      return;
    }

    const headerCookie = req.headers["x-ncm-cookie"];
    if (typeof headerCookie === "string" && headerCookie.trim()) {
      req.headers.cookie = req.headers.cookie
        ? `${req.headers.cookie}; ${headerCookie.trim()}`
        : headerCookie.trim();
    }
    delete req.headers["x-ncm-cookie"];

    for (const listener of originalListeners) listener.call(server, req, res);
  });
}

// 与前端 generate-api-registry.mjs 的排除清单保持一致：认证保持二维码登录、
// 不暴露凭证/资料修改类接口。该清单必须在服务端边界强制执行。
const EXCLUDED_MODULES = new Set([
  "activate_init_profile",
  "avatar_upload",
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
  "user_bindingcellphone",
  "user_replacephone",
  "user_social_status_edit",
  "user_update",
  "verify_getQr",
  "verify_qrcodestatus",
]);

async function loadModuleDefs() {
  try {
    const serverDir = path.dirname(
      require.resolve("NeteaseCloudMusicApi/server"),
    );
    const moduleDir = path.join(serverDir, "module");
    const special = {
      "daily_signin.js": "/daily_signin",
      "fm_trash.js": "/fm_trash",
      "personal_fm.js": "/personal_fm",
    };
    const defs = await getModulesDefinitions(moduleDir, special);
    const filtered = defs.filter(
      (def) => !EXCLUDED_MODULES.has(def.identifier),
    );
    console.log(
      `[reverie] modules registered: ${filtered.length} (${defs.length - filtered.length} excluded)`,
    );
    return filtered;
  } catch (error) {
    // Never fall back to the upstream full registry: that would re-expose the
    // login/profile mutation endpoints explicitly excluded above. Failing
    // closed is safer than starting an API with an unreviewed surface.
    console.error(
      "[reverie] failed to build the filtered module registry:",
      error,
    );
    throw error;
  }
}

function normalizeProvince(value) {
  return String(value || "")
    .trim()
    .replace(/^(中国|中华人民共和国)/, "")
    .replace(
      /(省|市|自治区|壮族自治区|回族自治区|维吾尔自治区|特别行政区)$/,
      "",
    );
}

const MUNICIPALITY_PROVINCES = new Set([
  "北京",
  "上海",
  "天津",
  "重庆",
  "香港",
  "澳门",
]);

function cleanLocation(raw) {
  const country = String(raw.country || "").trim();
  const province = normalizeProvince(raw.province);
  const city = String(raw.city || "").trim();
  if (!province) return { country, province, city };
  // 直辖市/特别行政区的“城市”字段与省级区域重名时丢弃，避免展示重复。
  if (MUNICIPALITY_PROVINCES.has(province) && bareForm(city) === province) {
    return { country, province, city: "" };
  }
  // IP 库的 city 可能是区县/乡镇级地名（如江苏南通的“平潮”镇），
  // 只有命中所在地省份的地级行政区名录才保留，否则降级为仅省级。
  return { country, province, city: matchPrefecture(province, city) };
}

function chooseLocation(candidates) {
  const clean = candidates
    // 非中国（含港澳台以外地区）的候选不参与省市投票：
    // 它们的省/市字段是海外地名，混入后会拼出“xxx省xxx市”式的错误文本。
    // 全部落选时返回 null，由前端走带国家前缀的备用数据源。
    .filter((item) => !item.country || /中国|China/i.test(String(item.country)))
    .map(cleanLocation)
    .filter((item) => item.province || item.city);
  if (!clean.length) return null;
  const provinceVotes = new Map();
  const cityVotes = new Map();
  for (const item of clean) {
    if (item.province)
      provinceVotes.set(
        item.province,
        (provinceVotes.get(item.province) || 0) + 1,
      );
    if (item.city) {
      const key = item.province + "|" + item.city;
      cityVotes.set(key, (cityVotes.get(key) || 0) + 1);
    }
  }
  const topProvince = [...provinceVotes.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0];
  const province = topProvince?.[0] || clean[0].province;
  // 城市结果不要求所有来源完全一致：只要与最高票省份匹配，就使用
  // 该省份下票数最高的城市，避免定位结果无故退化为只有省份。
  const cityEntry = [...cityVotes.entries()]
    .filter(([key]) => key.startsWith(`${province}|`))
    .sort((a, b) => b[1] - a[1])[0];
  const city = cityEntry ? cityEntry[0].split("|")[1] || "" : "";
  const matching = clean.find((item) => item.province === province) || clean[0];
  return {
    country: matching.country || "中国",
    province,
    city,
    precision: city ? "city" : "province",
    sources: clean.length,
  };
}

if (Number.isInteger(parentPid) && parentPid > 0) {
  setInterval(() => {
    try {
      process.kill(parentPid, 0);
    } catch {
      process.exit(0);
    }
  }, 1000);
}

(async () => {
  const moduleDefs = await loadModuleDefs();
  return serveNcmApi({ port, host, checkVersion: false, moduleDefs });
})()
  .then((app) => {
    // 浏览器直连公网 IP 定位服务会被 CORS 拦截，由 sidecar 服务端代理。
    // 主源多服务投票返回城市级 JSON（province/city，城市经地级名录校验），
    // 备用 ipip 文本源仅省级。
    if (app && typeof app.get === "function") {
      // 图片代理：网易图床不返回 CORS 头，渲染层 <img crossOrigin> 直接
      // 加载会失败/污染画布，歌词取色等场景经本地 sidecar 中转字节。
      // 域名白名单限定网易系图床，防止被当成任意地址的开放代理。
      app.get("/reverie/image", async (req, res) => {
        const target = String(req.query.url || "");
        let parsed;
        try {
          parsed = new URL(target);
        } catch {
          res.status(400).json({ code: 400, msg: "bad url" });
          return;
        }
        const host = parsed.hostname.toLowerCase();
        const allowed =
          (parsed.protocol === "https:" || parsed.protocol === "http:") &&
          (host === "music.126.net" ||
            host.endsWith(".music.126.net") ||
            host === "126.net" ||
            host.endsWith(".126.net") ||
            host === "163.com" ||
            host.endsWith(".163.com"));
        if (!allowed) {
          res.status(403).json({ code: 403, msg: "host not allowed" });
          return;
        }
        try {
          const upstream = await fetch(target, {
            signal: AbortSignal.timeout(8000),
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              Referer: "https://music.163.com/",
            },
          });
          if (!upstream.ok) {
            res.status(502).json({ code: 502, msg: `upstream ${upstream.status}` });
            return;
          }
          const body = Buffer.from(await upstream.arrayBuffer());
          res
            .status(200)
            .type(
              (upstream.headers.get("content-type") || "image/jpeg").split(";")[0],
            )
            .set("Cache-Control", "public, max-age=86400")
            .send(body);
        } catch {
          res.status(502).json({ code: 502, msg: "fetch failed" });
        }
      });
      app.get("/reverie/location", async (req, res) => {
        const source = String(req.query.src || "");
        if (source === "ipip") {
          try {
            const upstream = await fetch("https://myip.ipip.net", {
              signal: AbortSignal.timeout(3500),
            });
            res.type("text/plain").send(await upstream.text());
          } catch {
            res.status(502).type("text/plain").send("");
          }
          return;
        }
        const lookups = await Promise.allSettled([
          (async () => {
            const upstream = await fetch(
              "https://whois.pconline.com.cn/ipJson.jsp?json=true",
              { signal: AbortSignal.timeout(3800) },
            );
            const buf = Buffer.from(await upstream.arrayBuffer());
            const text = new TextDecoder("gbk").decode(buf);
            const data = JSON.parse(text);
            return {
              country:
                String(data.addr || "").includes("中国") || data.pro
                  ? "中国"
                  : "",
              province: data.pro,
              city: data.city,
            };
          })(),
          (async () => {
            const upstream = await fetch(
              "http://ip-api.com/json/?lang=zh-CN&fields=status,country,regionName,city",
              { signal: AbortSignal.timeout(3800) },
            );
            const data = await upstream.json();
            if (data?.status && data.status !== "success") return {};
            return {
              country: data.country,
              province: data.regionName,
              city: data.city,
            };
          })(),
          (async () => {
            const upstream = await fetch(
              "https://ipwho.is/?lang=zh-CN&fields=success,country,region,city",
              { signal: AbortSignal.timeout(3800) },
            );
            const data = await upstream.json();
            if (data?.success === false) return {};
            return {
              country: data.country,
              province: data.region,
              city: data.city,
            };
          })(),
        ]);
        const best = chooseLocation(
          lookups
            .filter((item) => item.status === "fulfilled")
            .map((item) => item.value),
        );
        if (best) {
          res.json(best);
          return;
        }
        res.status(502).json({});
      });
    }
    // listen 绑定失败（如 EADDRINUSE）在 promise resolve 之后异步抛出，
    // 不监听 error 事件会变成未捕获异常。
    if (app && app.server && typeof app.server.on === "function") {
      // 在 express 之前包一层：共享密钥校验 + cookie 头转发 + /reverie/health。
      wrapServer(app.server);
      app.server.on("error", (error) => {
        console.error("Failed to start NCM API:", error);
        process.exit(1);
      });
    }
    if (!authToken || allowUnauthenticatedDev) {
      console.warn(
        "[reverie] local API accepts unauthenticated requests (development only).",
      );
    }
  })
  .catch((error) => {
    console.error("Failed to start NCM API:", error);
    process.exit(1);
  });
