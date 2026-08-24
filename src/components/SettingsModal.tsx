import { useEffect, useState, type ReactNode } from "react";
import {
  CircleUserRound,
  ChevronRight,
  Info,
  MonitorCog,
  Music2,
  Palette,
  ServerCog,
  ShieldCheck,
  X,
} from "lucide-react";
import { usePlayerStore } from "../store/playerStore";
import type {
  GlassBlur,
  GlassContrast,
  GlassOpacity,
  ThemePreference,
} from "../store/playerStore";
import { getAccountOverview } from "../api/account";
import type { AccountOverview } from "../api/account";
import { getNeteaseApiVersion, getNeteaseSettings } from "../api/appMeta";
import { captureInteractionOrigin, useOriginTransition } from "../utils/originTransition";

const APP_THEMES: Array<{ id: ThemePreference; name: string }> = [
  { id: "system", name: "跟随系统" },
  { id: "light", name: "浅色" },
  { id: "dark", name: "深色" },
];

const PRIVACY_TEXT = `隐私说明

1. 数据范围
Reverie 不建立独立的用户账户体系，也不向 Reverie 服务器收集或出售个人信息。界面主题、外观偏好、播放历史、下载路径等设置仅保存在当前设备的本地存储中。

2. 登录凭证
当你使用网易云音乐账号登录时，登录 Cookie 仅用于向网易云音乐接口发起需要身份认证的请求。凭证由本地客户端保存，不会上传到 Reverie 的服务器；请勿在共享设备上保持登录状态。

3. 网络请求
搜索、播放、歌单、评论等功能会通过本地接口服务访问 NeteaseCloudMusicApi 及其所代理的网易云音乐接口。具体请求内容由你主动使用的功能决定，接口服务可能按照其自身隐私政策记录必要的访问日志。

4. 位置信息
首页位置由第三方 IP 定位服务根据网络出口地址推断，仅用于展示省市信息。应用不会读取 GPS、通讯录或精确地址；你可以在系统网络层面阻止相关请求。

5. 数据删除
清除应用数据、退出账号或删除本地存储即可移除本机保存的偏好和缓存。已发送到第三方服务的请求记录不受 Reverie 控制，请以对应服务的政策为准。

6. 安全提示
请使用可信网络环境并妥善保管账号凭证。Reverie 不会以任何理由索取你的密码、短信验证码或支付信息。`;

const USAGE_TEXT = `使用说明

1. 开始使用
启动本地接口服务后即可浏览首页、搜索歌曲和播放公开内容。部分歌单、收藏、评论及同步功能需要先登录网易云音乐账号。

2. 播放与音质
播放栏支持播放控制、播放列表、循环模式和官方可用音质切换。可用音质由当前歌曲、账号权限和接口返回结果共同决定，不支持的音质不会显示。

3. 下载与缓存
下载路径可在“设置 > 常规”中修改。下载能力受歌曲版权、账号权限和接口返回状态限制；应用不会绕过平台权限或解除 DRM。

4. 设置与外观
“设置 > 外观”可调整透明程度、背景模糊和文字对比度；“设置 > 常规”可调整主题、动效、歌词翻译和字号。设置会即时生效并保存在本机。

5. 更新与故障排查
建议保持接口服务和客户端版本一致。遇到搜索、播放或登录异常时，请先确认网络连接、接口服务状态和账号登录状态，再重启本地接口服务或重新登录。

6. 内容与版权
音乐、歌词、评论、封面及相关元数据均来自第三方服务。请遵守所在地法律、平台服务协议和版权要求，仅将本应用用于个人学习与合法欣赏。`;

const DISCLAIMER_TEXT = `· Reverie 是开源音乐播放器，仅供个人学习与交流使用。
· 音乐数据来源于 NeteaseCloudMusicApi，歌曲版权归各版权方所有。
· 本应用与网易云音乐及其关联公司无隶属或合作关系。
· 若涉及合法权益问题，请联系移除相关内容。`;

type Category = "general" | "appearance" | "account" | "about";
type Panel = "privacy" | "usage" | "disclaimer" | null;

const CATEGORIES: Array<{
  id: Category;
  label: string;
  icon: ReactNode;
}> = [
  { id: "general", label: "常规", icon: <MonitorCog size={17} /> },
  { id: "appearance", label: "外观", icon: <Palette size={17} /> },
  { id: "account", label: "账号", icon: <CircleUserRound size={17} /> },
  { id: "about", label: "关于", icon: <Info size={17} /> },
];

function SettingRow({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="setting-row">
      <label>
        {title}
        {hint && <span className="setting-hint">{hint}</span>}
      </label>
      <div className="setting-control">{children}</div>
    </div>
  );
}

export default function SettingsModal() {
  const [category, setCategory] = useState<Category>("general");
  const [panel, setPanel] = useState<Panel>(null);
  const [downloadPath, setDownloadPath] = useState(() => localStorage.getItem("reverie_download_path") || "D:\Reverie\Downloads");
  const showSettings = usePlayerStore((s) => s.showSettings);
  const setShowSettings = usePlayerStore((s) => s.setShowSettings);
  const theme = usePlayerStore((s) => s.theme);
  const setTheme = usePlayerStore((s) => s.setTheme);
  const glassOpacity = usePlayerStore((s) => s.glassOpacity);
  const setGlassOpacity = usePlayerStore((s) => s.setGlassOpacity);
  const glassBlur = usePlayerStore((s) => s.glassBlur);
  const setGlassBlur = usePlayerStore((s) => s.setGlassBlur);
  const glassContrast = usePlayerStore((s) => s.glassContrast);
  const setGlassContrast = usePlayerStore((s) => s.setGlassContrast);
  const reducedMotion = usePlayerStore((s) => s.reducedMotion);
  const setReducedMotion = usePlayerStore((s) => s.setReducedMotion);
  const loggedIn = usePlayerStore((s) => s.loggedIn);
  const profile = usePlayerStore((s) => s.profile);
  const showTranslation = usePlayerStore((s) => s.showTranslation);
  const setShowTranslation = usePlayerStore((s) => s.setShowTranslation);
  const lyricFontSize = usePlayerStore((s) => s.lyricFontSize);
  const setLyricFontSize = usePlayerStore((s) => s.setLyricFontSize);
  const logout = usePlayerStore((s) => s.logout);
  const checkUpdate = usePlayerStore((s) => s.checkUpdate);
  const updatePhase = usePlayerStore((s) => s.updatePhase);
  const [accountOverview, setAccountOverview] = useState<AccountOverview | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [neteaseVersion, setNeteaseVersion] = useState("");
  const [neteaseSettings, setNeteaseSettings] = useState<Record<string, unknown> | null>(null);
  const transition = useOriginTransition<HTMLDivElement>(showSettings, "settings", 240);

  useEffect(() => {
    if (!showSettings || category !== "account" || !loggedIn) return;
    let alive = true;
    setAccountLoading(true);
    void getAccountOverview()
      .then((overview) => {
        if (alive) setAccountOverview(overview);
      })
      .catch(() => {
        if (alive) setAccountOverview(null);
      })
      .finally(() => {
        if (alive) setAccountLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [category, loggedIn, showSettings]);

  useEffect(() => {
    if (!showSettings || category !== "about") return;
    let alive = true;
    void Promise.allSettled([getNeteaseApiVersion(), getNeteaseSettings()]).then(
      ([version, settings]) => {
        if (!alive) return;
        if (version.status === "fulfilled") setNeteaseVersion(version.value);
        if (settings.status === "fulfilled") setNeteaseSettings(settings.value);
      },
    );
    return () => {
      alive = false;
    };
  }, [category, showSettings]);

  if (!transition.rendered) return null;

  const close = () => setShowSettings(false);
  const checking = updatePhase === "checking";

  return (
    <div className={`modal-backdrop settings-backdrop ${transition.backdropClassName}`} onClick={close}>
      <div
        ref={transition.surfaceRef}
        className={`settings-modal ${transition.surfaceClassName}`}
        role="dialog"
        aria-modal="true"
        aria-label="设置"
        onClick={(e) => e.stopPropagation()}
      >
        <aside className="settings-sidebar">
          <div className="settings-brand">
            <div>
              <strong>设置</strong>
              <small>Reverie</small>
            </div>
          </div>
          <nav>
            {CATEGORIES.map((item) => (
              <button
                key={item.id}
                className={category === item.id ? "active" : ""}
                onClick={() => setCategory(item.id)}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="settings-sidebar-footer">
            <ShieldCheck size={15} /> 本地保存
          </div>
        </aside>

        <section className="settings-content">
          <header className="settings-content-header">
            <div>
              <h2>{CATEGORIES.find((item) => item.id === category)?.label}</h2>
              <p>调整 Reverie 的使用体验</p>
            </div>
            <button className="icon-btn" onClick={close} title="关闭设置">
              <X size={19} />
            </button>
          </header>

          <div className="settings-scroll">
            {category === "appearance" && (
              <>
                <div className="settings-section">
                  <h3>透明效果</h3>
                  <SettingRow
                    title="透明程度"
                    hint="控制导航栏、播放栏、弹窗和上下拉列表的底色强度"
                  >
                    <div className="opt-group">
                      {(
                        [
                          ["subtle", "轻盈"],
                          ["balanced", "平衡"],
                          ["solid", "稳固"],
                        ] as Array<[GlassOpacity, string]>
                      ).map(([id, name]) => (
                        <button
                          key={id}
                          className={`opt-btn ${glassOpacity === id ? "active" : ""}`}
                          onClick={() => setGlassOpacity(id)}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </SettingRow>
                  <SettingRow title="背景模糊" hint="调整透明表面对背后内容的柔化程度">
                    <div className="opt-group">
                      {(
                        [
                          ["none", "关闭"],
                          ["soft", "柔和"],
                          ["strong", "强"],
                        ] as Array<[GlassBlur, string]>
                      ).map(([id, name]) => (
                        <button
                          key={id}
                          className={`opt-btn ${glassBlur === id ? "active" : ""}`}
                          onClick={() => setGlassBlur(id)}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </SettingRow>
                  <SettingRow title="文字对比度" hint="增强透明背景上的文字可读性">
                    <div className="opt-group">
                      {(
                        [
                          ["standard", "标准"],
                          ["high", "增强"],
                        ] as Array<[GlassContrast, string]>
                      ).map(([id, name]) => (
                        <button
                          key={id}
                          className={`opt-btn ${glassContrast === id ? "active" : ""}`}
                          onClick={() => setGlassContrast(id)}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </SettingRow>
                </div>
                <div className="settings-section">
                  <h3>界面</h3>
                  <SettingRow title="界面主题" hint="切换应用的整体明暗外观">
                    <div className="opt-group">
                      {APP_THEMES.map((item) => (
                        <button
                          key={item.id}
                          className={`opt-btn ${theme === item.id ? "active" : ""}`}
                          onClick={() => setTheme(item.id)}
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                  </SettingRow>
                </div>
              </>
            )}

            {category === "general" && (
              <>
                <div className="settings-section">
                  <h3>界面</h3>
                  <SettingRow title="界面主题" hint="切换应用的整体明暗外观">
                    <div className="opt-group">
                      {APP_THEMES.map((item) => (
                        <button
                          key={item.id}
                          className={`opt-btn ${theme === item.id ? "active" : ""}`}
                          onClick={() => setTheme(item.id)}
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                  </SettingRow>
                  <SettingRow
                    title="减少动画效果"
                    hint="关闭大多数过渡、浮动和入场动画"
                  >
                    <button
                      type="button"
                      className={`setting-switch ${reducedMotion ? "active" : ""}`}
                      role="switch"
                      aria-checked={reducedMotion}
                      aria-label="减少动画效果"
                      onClick={() => setReducedMotion(!reducedMotion)}
                    >
                      <span />
                    </button>
                  </SettingRow>
                </div>
                <div className="settings-section">
                  <h3>播放</h3>
                  <SettingRow title="歌曲下载路径" hint="浏览器环境无法直接选择系统目录，将使用该路径作为首选设置">
                    <input className="settings-input" value={downloadPath} onChange={(event) => { setDownloadPath(event.target.value); localStorage.setItem("reverie_download_path", event.target.value); }} placeholder="例如 D:\Music\Downloads" />
                  </SettingRow>
                  <SettingRow title="歌词翻译" hint="在歌词页同时显示译文">
                    <div className="opt-group">
                      <button
                        className={`opt-btn ${showTranslation ? "active" : ""}`}
                        onClick={() => setShowTranslation(true)}
                      >
                        开启
                      </button>
                      <button
                        className={`opt-btn ${!showTranslation ? "active" : ""}`}
                        onClick={() => setShowTranslation(false)}
                      >
                        关闭
                      </button>
                    </div>
                  </SettingRow>
                  <SettingRow title="歌词字号" hint={`当前 ${lyricFontSize}px`}>
                    <div className="opt-group">
                      {[18, 22, 26, 30].map((size) => (
                        <button
                          key={size}
                          className={`opt-btn ${lyricFontSize === size ? "active" : ""}`}
                          onClick={() => setLyricFontSize(size)}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </SettingRow>
                </div>
                <div className="settings-section">
                  <h3>快捷键</h3>
                  <div className="shortcut-list" aria-label="键盘快捷键">
                    <div><span>播放 / 暂停</span><kbd>Space</kbd></div>
                    <div><span>快进 / 快退 5 秒</span><span><kbd>→</kbd> <kbd>←</kbd></span></div>
                    <div><span>音量增减</span><span><kbd>↑</kbd> <kbd>↓</kbd></span></div>
                  </div>
                </div>
              </>
            )}

            {category === "account" && (
              <div className="settings-section">
                <h3>账号</h3>
                <SettingRow
                  title={profile?.nickname || "未登录"}
                  hint={loggedIn ? "网易云音乐账号" : "登录后同步收藏内容"}
                >
                  {loggedIn ? (
                    <button className="btn danger" onClick={logout}>
                      退出登录
                    </button>
                  ) : (
                    <span className="setting-status">未登录</span>
                  )}
                </SettingRow>
                {loggedIn && (
                  <div className="account-overview" aria-live="polite">
                    {accountLoading ? (
                      <span className="setting-status">正在读取账号信息…</span>
                    ) : accountOverview ? (
                      <>
                        <div><span>账号 ID</span><strong>{accountOverview.userId || "—"}</strong></div>
                        <div><span>等级</span><strong>Lv.{accountOverview.level || 0}</strong></div>
                        <div><span>会员</span><strong>{accountOverview.vipType > 0 ? "已开通" : "普通账号"}</strong></div>
                        <div><span>绑定方式</span><strong>{accountOverview.bindings.length ? accountOverview.bindings.join("、") : "未读取到"}</strong></div>
                        {accountOverview.phone && <div><span>手机号</span><strong>{accountOverview.phone}</strong></div>}
                        {accountOverview.email && <div><span>邮箱</span><strong>{accountOverview.email}</strong></div>}
                        <p>账号安全操作请在网易云音乐官方客户端完成。</p>
                      </>
                    ) : (
                      <span className="setting-status">账号扩展信息暂不可用</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {category === "about" && (
              <div className="settings-section about-section">
                <h3>应用</h3>
                <div className="about-identity">
                  <div className="about-app-icon" aria-hidden="true">
                    <Music2 size={24} />
                  </div>
                  <div className="about-app-copy">
                    <strong>Reverie</strong>
                    <span>桌面音乐播放器</span>
                    <small>{"v" + __APP_VERSION__ + " · " + (window.ncm?.versions.runtime ?? "Tauri") + " · WebView " + (window.ncm?.versions.webview ?? "—")}</small>
                  </div>
                  <button
                    className="btn"
                    onClick={(event) => {
                      captureInteractionOrigin("update", event.currentTarget);
                      checkUpdate(true);
                    }}
                    disabled={checking}
                  >
                    {checking ? "检查中…" : "检查更新"}
                  </button>
                </div>
                <div className="about-service">
                  <ServerCog size={19} aria-hidden="true" />
                  <div>
                    <strong>接口服务</strong>
                    <span>NeteaseCloudMusicApi</span>
                  </div>
                  <b>{neteaseVersion ? "v" + neteaseVersion : neteaseSettings ? "可用" : "读取中…"}</b>
                </div>
                <h3>说明与政策</h3>
                <div className="about-link-list">
                  <button className={"about-link " + (panel === "privacy" ? "active" : "")} onClick={() => setPanel(panel === "privacy" ? null : "privacy")}>
                    <span><strong>隐私说明</strong><small>数据处理、账号凭证与第三方服务</small></span><ChevronRight size={16} />
                  </button>
                  {panel === "privacy" && <article className="about-panel">{PRIVACY_TEXT}</article>}
                  <button className={"about-link " + (panel === "usage" ? "active" : "")} onClick={() => setPanel(panel === "usage" ? null : "usage")}>
                    <span><strong>使用说明</strong><small>播放、下载、设置与故障排查</small></span><ChevronRight size={16} />
                  </button>
                  {panel === "usage" && <article className="about-panel">{USAGE_TEXT}</article>}
                  <button className={"about-link " + (panel === "disclaimer" ? "active" : "")} onClick={() => setPanel(panel === "disclaimer" ? null : "disclaimer")}>
                    <span><strong>免责声明</strong><small>版权归属、服务边界与责任范围</small></span><ChevronRight size={16} />
                  </button>
                  {panel === "disclaimer" && <article className="about-panel">{DISCLAIMER_TEXT}</article>}
                </div>
                <p className="settings-legal">数据来源：NeteaseCloudMusicApi · 仅供学习交流</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
