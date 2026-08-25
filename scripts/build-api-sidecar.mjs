import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { join, resolve } from "node:path";

const targets = {
  "win32-x64": {
    pkg: "node22-win-x64",
    triple: "x86_64-pc-windows-msvc",
    extension: ".exe",
  },
  "win32-arm64": {
    pkg: "node22-win-arm64",
    triple: "aarch64-pc-windows-msvc",
    extension: ".exe",
  },
  "darwin-x64": {
    pkg: "node22-macos-x64",
    triple: "x86_64-apple-darwin",
    extension: "",
  },
  "darwin-arm64": {
    pkg: "node22-macos-arm64",
    triple: "aarch64-apple-darwin",
    extension: "",
  },
  "linux-x64": {
    pkg: "node22-linux-x64",
    triple: "x86_64-unknown-linux-gnu",
    extension: "",
  },
  "linux-arm64": {
    pkg: "node22-linux-arm64",
    triple: "aarch64-unknown-linux-gnu",
    extension: "",
  },
};

const root = resolve(import.meta.dirname, "..");
const outputDir = join(root, "src-tauri", "binaries");
const input = join(root, "sidecar", "api-server.cjs");
const config = join(root, "package.json");
const lockfile = join(root, "package-lock.json");
const apiPackage = join(
  root,
  "node_modules",
  "NeteaseCloudMusicApi",
  "package.json",
);
const pkgCli = join(
  root,
  "node_modules",
  "@yao-pkg",
  "pkg",
  "lib-es5",
  "bin.js",
);

if (!existsSync(apiPackage)) {
  throw new Error("NeteaseCloudMusicApi is missing; run npm install first");
}

// sidecar 目录下的全部本地模块（api-server.cjs、prefecture.cjs、china-divisions.json 等）
// 都会被 pkg 静态打包进二进制，任何一个更新都需要重新打包。
const sidecarDir = join(root, "sidecar");
const sidecarInputs = readdirSync(sidecarDir)
  .filter((name) => /\.(?:cjs|json)$/.test(name))
  .map((name) => join(sidecarDir, name));

const newestInput = Math.max(
  statSync(import.meta.filename).mtimeMs,
  statSync(config).mtimeMs,
  statSync(lockfile).mtimeMs,
  statSync(apiPackage).mtimeMs,
  ...sidecarInputs.map((file) => statSync(file).mtimeMs),
);

mkdirSync(outputDir, { recursive: true });

function outputPath(target) {
  return join(outputDir, `reverie-api-${target.triple}${target.extension}`);
}

function buildTarget(key) {
  const target = targets[key];
  if (!target) throw new Error(`Unsupported sidecar target: ${key}`);

  const output = outputPath(target);
  if (existsSync(output) && statSync(output).mtimeMs >= newestInput) {
    console.log(`API sidecar is current: ${output}`);
    return output;
  }

  const temporaryOutput = join(
    outputDir,
    `reverie-api-${target.triple}.tmp${target.extension}`,
  );
  rmSync(temporaryOutput, { force: true });
  try {
    execFileSync(
      process.execPath,
      [
        pkgCli,
        input,
        "--config",
        config,
        "--target",
        target.pkg,
        "--public",
        "--public-packages",
        "*",
        "--no-bytecode",
        "--output",
        temporaryOutput,
      ],
      { cwd: root, stdio: "inherit" },
    );
    rmSync(output, { force: true });
    renameSync(temporaryOutput, output);
  } finally {
    rmSync(temporaryOutput, { force: true });
  }
  console.log(`Built API sidecar: ${output}`);
  return output;
}

function buildUniversalMacSidecar() {
  if (process.platform !== "darwin") {
    throw new Error("The universal macOS sidecar must be built on macOS");
  }
  const x64 = buildTarget("darwin-x64");
  const arm64 = buildTarget("darwin-arm64");
  const output = join(outputDir, "reverie-api-universal-apple-darwin");
  const temporaryOutput = `${output}.tmp`;
  const newestSlice = Math.max(statSync(x64).mtimeMs, statSync(arm64).mtimeMs);
  if (existsSync(output) && statSync(output).mtimeMs >= newestSlice) {
    console.log(`API sidecar is current: ${output}`);
    return;
  }
  rmSync(temporaryOutput, { force: true });
  try {
    execFileSync("lipo", ["-create", x64, arm64, "-output", temporaryOutput], {
      stdio: "inherit",
    });
    rmSync(output, { force: true });
    renameSync(temporaryOutput, output);
  } finally {
    rmSync(temporaryOutput, { force: true });
  }
  console.log(`Built universal API sidecar: ${output}`);
}

const requestedTarget =
  process.env.REVERIE_SIDECAR_TARGET ?? `${process.platform}-${process.arch}`;

if (requestedTarget === "darwin-universal") buildUniversalMacSidecar();
else buildTarget(requestedTarget);
