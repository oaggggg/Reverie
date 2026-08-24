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

function normalizeProvince(value) {
  return String(value || "")
    .trim()
    .replace(/^(中国|中华人民共和国)/, "")
    .replace(
      /(省|市|自治区|壮族自治区|回族自治区|维吾尔自治区|特别行政区)$/,
      "",
    );
}

function normalizeCity(value) {
  return String(value || "")
    .trim()
    .replace(/(市|地区|盟|自治州|特别行政区)$/, "");
}

function cleanLocation(raw) {
  const country = String(raw.country || "").trim();
  const province = normalizeProvince(raw.province);
  const city = normalizeCity(raw.city);
  return {
    country,
    province,
    city: city && city !== province ? city : "",
  };
}

function chooseLocation(candidates) {
  const clean = candidates
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
  const agreedCity =
    [...cityVotes.entries()].find(([, count]) => count >= 2)?.[0] || "";
  const city = agreedCity ? agreedCity.split("|")[1] || "" : "";
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
