import { useEffect, useState, type ReactNode } from "react";
import {
  CircleUserRound,
  Info,
  MonitorCog,
  ShieldCheck,
  X,
} from "lucide-react";
import { usePlayerStore } from "../store/playerStore";
import type { ThemePreference } from "../store/playerStore";
import { getAccountOverview } from "../api/account";
import type { AccountOverview } from "../api/account";
import { getNeteaseApiVersion, getNeteaseSettings } from "../api/appMeta";
import { captureInteractionOrigin, useOriginTransition } from "../utils/originTransition";

const APP_THEMES: Array<{ id: ThemePreference; name: string }> = [
  { id: "system", name: "跟随系统" },
  { id: "light", name: "浅色" },
  { id: "dark", name: "深色" },
];

const PRIVACY_TEXT = `· 个人数据（界面设置、最近播放、登录 Cookie 等）仅保存在本机，不会上传到 Reverie 的服务器。
· 登录 Cookie 只在调用网易云音乐接口时用于身份认证。
· 首页城市信息由第三方 IP 定位服务获取，仅用于展示。
· 本应用不收集统计数据，不进行行为追踪。`;

const DISCLAIMER_TEXT = `· Reverie 是开源音乐播放器，仅供个人学习与交流使用。
· 音乐数据来源于 NeteaseCloudMusicApi，歌曲版权归各版权方所有。
· 本应用与网易云音乐及其关联公司无隶属或合作关系。
· 若涉及合法权益问题，请联系移除相关内容。`;

type Category = "general" | "account" | "about";
type Panel = "privacy" | "disclaimer" | null;

const CATEGORIES: Array<{
  id: Category;
  label: string;
  icon: ReactNode;
}> = [
  { id: "general", label: "常规", icon: <MonitorCog size={17} /> },
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
              <div className="settings-section">
                <h3>应用</h3>
                <SettingRow
                  title={`Reverie v${__APP_VERSION__}`}
                  hint={`${window.ncm?.versions.runtime ?? "Tauri"} · WebView ${window.ncm?.versions.webview ?? "—"}`}
                >
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
                </SettingRow>
                <SettingRow
                  title={neteaseVersion ? `接口服务 v${neteaseVersion}` : "接口服务版本"}
                  hint={neteaseSettings ? "已读取网易云设置" : "正在读取网易云设置"}
                >
                  <span className="setting-status">
                    {neteaseVersion || (neteaseSettings ? "可用" : "读取中…")}
                  </span>
                </SettingRow>
                <SettingRow title="隐私说明">
                  <button
                    className="btn"
                    onClick={() =>
                      setPanel(panel === "privacy" ? null : "privacy")
                    }
                  >
                    {panel === "privacy" ? "收起" : "查看"}
                  </button>
                </SettingRow>
                {panel === "privacy" && (
                  <div className="about-panel">{PRIVACY_TEXT}</div>
                )}
                <SettingRow title="免责声明">
                  <button
                    className="btn"
                    onClick={() =>
                      setPanel(panel === "disclaimer" ? null : "disclaimer")
                    }
                  >
                    {panel === "disclaimer" ? "收起" : "查看"}
                  </button>
                </SettingRow>
                {panel === "disclaimer" && (
                  <div className="about-panel">{DISCLAIMER_TEXT}</div>
                )}
                <p className="settings-legal">
                  数据来源：NeteaseCloudMusicApi · 仅供学习交流
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
