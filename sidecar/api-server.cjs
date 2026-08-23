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

const { serveNcmApi } = require("NeteaseCloudMusicApi/server");

const port = Number(process.env.PORT || 3939);
const host = process.env.HOST || "127.0.0.1";
const parentPid = Number(process.env.PARENT_PID || 0);

if (Number.isInteger(parentPid) && parentPid > 0) {
  setInterval(() => {
    try {
      process.kill(parentPid, 0);
    } catch {
      process.exit(0);
    }
  }, 1000);
}

serveNcmApi({ port, host, checkVersion: false })
  .then((app) => {
    // 浏览器直连公网 IP 定位服务会被 CORS 拦截，由 sidecar 服务端代理。
    // 主源返回城市级 JSON（province/city），备用 ipip 文本源仅省级。
    if (app && typeof app.get === "function") {
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
        // 主源：太平洋 pconline，返回规范的省/市级中文名（GBK 编码）
        try {
          const upstream = await fetch(
            "https://whois.pconline.com.cn/ipJson.jsp?json=true",
            { signal: AbortSignal.timeout(4000) },
          );
          const buf = Buffer.from(await upstream.arrayBuffer());
          const text = new TextDecoder("gbk").decode(buf);
          const data = JSON.parse(text);
          const province = String(data.pro || "").trim();
          const city = String(data.city || "").trim();
          if (province || city) {
            res.json({
              country: String(data.addr || "").includes("中国") || province ? "中国" : "",
              province,
              city: city === province ? "" : city,
            });
            return;
          }
        } catch {
          /* fall through */
        }
        // 备源：ip-api（city 可能为区级，仅在前者失败时使用）
        try {
          const upstream = await fetch(
            "http://ip-api.com/json/?lang=zh-CN&fields=regionName,city,country",
            { signal: AbortSignal.timeout(4000) },
          );
          const data = await upstream.json();
          if (data && (data.regionName || data.city)) {
            res.json({
              country: data.country || "",
              province: data.regionName || "",
              city: data.city || "",
            });
            return;
          }
          res.status(502).json({});
        } catch {
          res.status(502).json({});
        }
      });
    }
    // listen 绑定失败（如 EADDRINUSE）在 promise resolve 之后异步抛出，
    // 不监听 error 事件会变成未捕获异常。
    if (app && app.server && typeof app.server.on === "function") {
      app.server.on("error", (error) => {
        console.error("Failed to start NCM API:", error);
        process.exit(1);
      });
    }
  })
  .catch((error) => {
    console.error("Failed to start NCM API:", error);
    process.exit(1);
  });
