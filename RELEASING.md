# Reverie 发布流程

Reverie 当前仅面向 Windows 与 macOS 桌面客户端，通过 GitHub Actions 构建 Windows x64 安装包和 macOS Universal 安装包，并把 Tauri updater 所需的完整性签名产物发布到 GitHub Releases。不构建 Android、iOS 或其他移动端版本。应用运行时从 `src-tauri/tauri.conf.json` 配置的 `latest.json` 地址检查更新。

## 发布前提

- 本地验证需要 Node.js 22、Rust stable 和当前系统对应的桌面构建环境。
- `TAURI_SIGNING_PRIVATE_KEY` 已配置为 GitHub Actions Secret。
- 如果签名私钥设置了密码，同时配置 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`。
- 私钥只保存在密码管理器或 CI Secret 中，禁止写入仓库、构建日志和本地提交。

Tauri updater 签名只用于验证应用内更新包完整性。Windows Authenticode、Apple Developer ID 和 macOS 公证属于操作系统代码签名体系，本项目的 Windows 与 macOS 产物均不使用这些软件签名能力。

## 发布步骤

### 1. 同步版本号

同时更新以下三个文件中的版本号：

- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`

然后运行 `npm install`，让 `package-lock.json` 与版本保持一致。

### 2. 本地验证

```bash
npm run check
npm test
```

`npm run check` 会重新生成当前平台 sidecar、执行 TypeScript 检查、构建前端并运行 `cargo check`。`npm test` 会运行单元测试和 sidecar 启动冒烟测试。若要额外验证第三方 API，可运行：

```bash
npm run test:api
npm run test:extended-api
```

### 3. 提交并创建标签

使用与版本号一致的 Git 标签，例如：

```bash
git add package.json package-lock.json src-tauri/Cargo.toml src-tauri/tauri.conf.json
git commit -m "发布 v1.2.0"
git tag v1.2.0
git push origin master --follow-tags
```

推送符合 `vX.Y.Z`（可带预发布后缀）的标签会触发 `.github/workflows/release.yml`。也可以在 GitHub Actions 中手动运行工作流，并填写要构建的标签名；手动运行时可选择创建草稿 Release。

### 4. 检查 Release

工作流会分别在 `windows-latest` 和 `macos-latest` 上执行以下步骤：

1. 按标签检出代码。
2. 安装 Node.js 22、Rust stable 和 npm 依赖。
3. 校验标签与 `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json` 的版本一致。
4. 执行项目检查和测试。
5. 校验 updater 私钥 Secret 是否存在。
6. Windows 构建 NSIS 安装包，macOS 构建同时支持 Intel 与 Apple 芯片的 Universal App/DMG。
7. 使用 `tauri-apps/tauri-action` 上传安装包、updater 压缩包、完整性签名和 `latest.json`。

推送标签时默认直接发布 Release；手动运行时可以勾选 `release_draft` 先创建草稿。发布前应检查：

- 安装包名称和版本号是否正确。
- `latest.json` 中的平台、版本、下载地址和签名是否完整。
- 安装包能否在干净的 Windows 与 macOS 环境中启动。
- 已安装旧版本能否通过应用内更新完成下载、安装和重启。

确认无误后再发布草稿 Release。不要在草稿阶段修改自动生成的签名文件内容。

## 回滚与重新发布

- 构建失败：修复代码或 CI 配置后，删除失败的草稿 Release，再重新推送一个修正后的版本标签。
- 产物错误但版本号未变：优先重新生成一个递增的补丁版本，避免客户端缓存旧的 `latest.json`。
- 已发布版本发现严重问题：先在 GitHub Releases 标记说明，再发布修复版本；不要复用已公开的标签。
- updater 私钥泄露：立即轮换密钥、更新 `tauri.conf.json` 公钥，并发布新的完整版本。

## 发布后检查

在 GitHub Release 发布后，至少完成一次：

1. 下载并安装 Windows NSIS 安装包与 macOS Universal DMG。
2. 处理未签名应用的系统安全提示后，验证启动、扫码登录、搜索、播放和退出流程。
3. 在旧版本中触发更新检查，确认下载进度、重启安装和版本展示正常。
4. 检查 Release 页面中的两个系统安装包、updater 归档、完整性签名文件和 `latest.json` 均可下载。
