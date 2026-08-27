# Reverie

![Reverie 音乐播放器封面](./docs/assets/reverie-readme-cover.png)

Reverie 是一款音乐播放器，使用 Tauri 2、React、TypeScript 和 Rust 构建。应用通过随包分发的本地 API sidecar 访问音乐服务，播放器本身不依赖 Reverie 自建后端。

> Reverie 仅提供 Windows 与 macOS 桌面客户端，不提供 Android、iOS 或其他移动端版本。GitHub Release 同时提供 Windows x64 安装包和兼容 Intel/Apple 芯片的 macOS Universal 安装包。

## 目录

- [功能概览](#功能概览)
- [隐私与使用边界](#隐私与使用边界)
- [免责声明](#免责声明)
- [下载安装](#下载安装)
- [从源码运行](#从源码运行)
- [常用命令](#常用命令)
- [项目结构](#项目结构)
- [运行机制](#运行机制)
- [故障排查](#故障排查)
- [发布流程](#发布流程)
- [许可证](#许可证)

## 功能概览

- **发现音乐**：搜索、排行榜、每日推荐、私人 FM、歌单和歌手/专辑浏览。
- **播放体验**：播放队列、上一首/下一首、进度、音量、播放模式和最近播放记录。
- **沉浸式播放页**：专辑封面、歌词同步、高亮、译文、歌词字号和可切换的歌词视觉效果。
- **账号能力**：网易云音乐扫码登录；登录后可使用个性化推荐、收藏内容、评论和需要账号权限的播放能力。
- **接口覆盖**：基于 `NeteaseCloudMusicApi` 接入 357 条非账号接口，统一提供搜索、播放、歌词、歌单、社交、播客、视频、会员和云贝等客户端能力。
- **桌面能力**：自定义标题栏、主题切换、窗口控制、启动更新检查和应用内更新安装；客户端仅面向 Windows 与 macOS。
- **本地优先**：界面设置、播放队列、最近播放和登录 Cookie 默认保存在当前设备。

未登录时仍可浏览部分公开内容；需要账号权限的功能会在界面中提示登录。歌曲是否可播放取决于第三方接口返回的权限和版权状态。

当前客户端仅保留扫码登录。注册、密码登录、修改密码、修改手机号和其他账号敏感操作不在客户端开放，账号安全操作请在网易云音乐官方客户端完成。

接口路由覆盖检查可运行 `npm run test:api-coverage`。该检查验证本地 sidecar 中的 357 条路由可达；匿名状态下出现的登录要求、参数错误、会员限制或第三方业务错误不等同于客户端接口缺失。

## 隐私与使用边界

- 应用在本机启动 API sidecar，默认只监听 `127.0.0.1:3939`，不向 Reverie 服务器上传个人数据。
- 登录 Cookie 保存在 WebView 的本地存储中，并仅作为请求参数发送给本地 API sidecar，再由其访问第三方音乐接口。
- 本项目使用第三方开源接口服务获取音乐数据，不存储或再分发音乐文件。
- Reverie 与网易云音乐及其关联公司不存在隶属或合作关系。请遵守所在地法律、第三方平台规则和版权要求。
- 设置页内置隐私说明与免责声明；使用前请确认自己理解登录凭据和第三方接口的风险边界。

## 免责声明

- 本项目仅供学习、研究和个人使用，不构成对任何音乐服务的官方授权、推荐或保证。
- 音乐、歌词、封面、用户资料和其他内容均来自第三方服务，相关版权、商标和其他权利归各自权利人所有。内容的准确性、完整性、可用性和持续提供不由本项目保证。
- 本项目不提供破解会员、绕过 DRM、规避地区限制或获取未授权内容的功能。请勿使用本项目下载、保存、传播或公开播放未经授权的内容。
- 使用者应自行承担登录账号、Cookie、网络请求和第三方服务使用带来的风险，并负责遵守所在地法律、第三方平台协议及版权要求。
- 因第三方接口变更、服务中断、账号限制、版权策略、网络问题或使用本项目产生的任何直接或间接损失，项目作者和贡献者不承担责任。
- 如发现涉及合法权益的内容，请通过项目仓库提交说明，项目维护者会在合理范围内核查和处理。

## 下载安装

前往 [GitHub Releases](https://github.com/oaggggg/Reverie/releases) 下载对应版本：

| 文件                                   | 适用场景                                      |
| -------------------------------------- | --------------------------------------------- |
| `Reverie_<版本>_Windows_x64_setup.exe` | Windows x64，支持开始菜单和卸载流程           |
| `Reverie_<版本>_macOS_universal.dmg`   | macOS Universal，同时支持 Intel 与 Apple 芯片 |

Windows 版本需要可用的 WebView2 运行时。安装包通常会由系统或安装器处理 WebView2；若启动失败，请先更新 Windows WebView2 Runtime。

两个系统的安装包均未进行操作系统代码签名。首次运行时 Windows SmartScreen 或 macOS Gatekeeper 可能显示安全提示，请仅从本仓库的 GitHub Releases 下载安装。

## 从源码运行

### 环境要求

- Node.js 22 LTS 或更高版本，npm 10 或更高版本。
- Rust stable，且版本不低于 `src-tauri/Cargo.toml` 中声明的 `rust-version`。
- Windows 开发需要 WebView2，macOS 开发需要 Xcode Command Line Tools。
- 首次构建需要能够下载 npm、Cargo 和 sidecar 打包依赖；仅构建 Windows 与 macOS 桌面版本，Linux 和移动端不在支持范围内。

### 快速开始

```bash
npm install
npm run dev
```

`npm run dev` 会启动 Tauri 开发模式。开发构建中的 Rust 进程直接调用仓库内的 `sidecar/api-server.cjs`，前端通过 `http://127.0.0.1:3939` 访问本地 API。

### 仅启动 Web 前端

需要快速检查页面布局或调试 React 时，可以只启动 Vite：

```bash
npm run dev:web
```

此模式不会启动 Tauri，也不会自动启动 API sidecar；涉及搜索、登录或播放的功能可能不可用。

### 构建与检查

```bash
npm run check    # 生成 sidecar、TypeScript 检查、Vite 构建、cargo check
npm test         # 单元测试 + sidecar 启动冒烟测试
npm run build    # 生成当前系统的 Tauri 安装包与更新产物
```

首次运行 `npm run check` 或 `npm run build` 时，`scripts/build-api-sidecar.mjs` 会使用 `pkg` 将 `sidecar/api-server.cjs` 和 `NeteaseCloudMusicApi` 打包到 `src-tauri/binaries/`。这些二进制文件是本地构建产物，已被 `.gitignore` 忽略，不应提交到仓库。

## 常用命令

| 命令                        | 用途                                       |
| --------------------------- | ------------------------------------------ |
| `npm run dev`               | 启动 Tauri 桌面开发模式                    |
| `npm run dev:web`           | 仅启动 Vite Web 开发服务器                 |
| `npm run prepare:sidecar`   | 为当前平台生成或刷新 API sidecar           |
| `npm run typecheck`         | 运行 TypeScript 类型检查                   |
| `npm run build:web`         | 构建前端静态资源到 `dist/`                 |
| `npm run check`             | 执行 sidecar、TypeScript、前端和 Rust 检查 |
| `npm test`                  | 执行单元测试和 sidecar 冒烟测试            |
| `npm run test:api`          | 启动临时 API 服务并检查常用接口            |
| `npm run test:api-coverage` | 检查 357 条允许接口的路由可达性            |
| `npm run test:extended-api` | 执行扩展 API 冒烟测试                      |
| `npm run format`            | 使用 Prettier 格式化源码和项目文档         |
| `npm run build`             | 构建 Tauri 安装包和更新签名产物            |

单元测试使用 Node 原生测试运行器，测试文件位于 `tests/`；sidecar 测试会在 `127.0.0.1:3959` 启动临时进程，不会复用应用的 `3939` 端口。

## 项目结构

目录职责、命名约定和提交前检查见 [工程结构与命名约定](./docs/ARCHITECTURE.md)。

```text
src/                           React 页面、组件、状态和 API 客户端
src/api/                       音乐接口类型、请求封装和扩展接口
src/store/                     播放器与发现页的 Zustand 状态
src-tauri/src/                 Tauri 生命周期、窗口控制和 sidecar 管理
src-tauri/tauri.conf.json      前端、打包和更新的共享配置
src-tauri/tauri.*.conf.json    Windows 与 macOS 平台窗口/安装器配置
sidecar/api-server.cjs         本地 API 服务入口
scripts/                       sidecar 构建、API 测试和冒烟测试脚本
tests/                         Node 原生单元测试
.github/workflows/release.yml  GitHub Release 自动构建工作流
```

## 运行机制

1. Tauri 启动后检查 `127.0.0.1:3939` 是否已有服务。
2. 开发模式启动仓库内的 Node sidecar，生产模式启动 `src-tauri/binaries/reverie-api-*`。
3. React 前端通过本地 HTTP API 请求搜索、登录、歌词、播放地址和社区数据。
4. 窗口关闭时，Tauri 会尝试终止由当前应用启动的 sidecar 进程。
5. 生产构建使用 Tauri updater；更新地址和公钥位于 `src-tauri/tauri.conf.json`，私钥只应保存在 GitHub Actions Secret 中。

如果 `3939` 已被其他进程占用，Tauri 会假定已有 API 服务并继续启动。遇到数据异常时，优先确认该端口上的服务确实属于当前项目。

## 故障排查

### 启动后搜索或登录无响应

确认 `127.0.0.1:3939` 未被其他程序占用，并重新运行：

```bash
npm run prepare:sidecar
npm run dev
```

开发模式下可查看终端中的 sidecar 日志；生产模式日志由 Tauri 记录。日志中的 Cookie 参数会被脱敏。

### 测试提示 sidecar 缺失

先生成当前平台的 sidecar，再重新测试：

```bash
npm run prepare:sidecar
npm run test:sidecar
```

### `npm run build` 失败

按以下顺序排查：

1. 删除并重新安装依赖：`Remove-Item -Recurse -Force node_modules; npm install`。
2. 确认 Node.js、Rust 和 WebView2 满足环境要求。
3. 单独运行 `npm run check`，先修复类型、前端构建或 `cargo check` 报错。
4. 检查 `src-tauri/binaries/` 是否生成了当前平台对应的 sidecar 文件。

### 播放地址不可用

第三方接口可能因登录状态、会员权限、地区或版权策略返回不可播放结果。此类结果不等同于播放器本地故障，请先重新登录并尝试其他公开歌曲。

## 发布流程

版本发布、更新签名、GitHub Actions Secret 和草稿 Release 的详细步骤见 [RELEASING.md](./RELEASING.md)。日常提交前至少运行：

```bash
npm run check
npm test
```

## 许可证

本项目以 [GNU General Public License v3.0](./LICENSE) 发布。音乐数据和相关内容的版权归各权利方所有；版权所有 © 2026 oaggggg。
