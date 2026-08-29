import { useEffect, useState, type ReactNode } from "react";
import {
  CircleUserRound,
  ChevronRight,
  Bug,
  Trash2,
  FolderOpen,
  Info,
  MonitorCog,
  Palette,
  ServerCog,
  ShieldCheck,
  X,
} from "lucide-react";
import appIconUrl from "../../src-tauri/icons/128x128@2x.png";
import { usePlayerStore } from "../store/playerStore";
import type {
  AnimationSpeed,
  AccentColor,
  GlassBlur,
  GlassContrast,
  GlassOpacity,
  ThemePreference,
} from "../store/playerStore";
import { getAccountOverview } from "../api/account";
import type { AccountOverview } from "../api/account";
import { getNeteaseApiVersion, getNeteaseSettings } from "../api/appMeta";
import {
  captureInteractionOrigin,
  useOriginTransition,
} from "../utils/originTransition";
import { useModalBehavior } from "../utils/modalBehavior";
import {
  buildGitHubIssueUrl,
  createFeedbackIssue,
  openGitHubIssue,
} from "../utils/diagnostics";
import { getSavedAccounts, MAX_SAVED_ACCOUNTS, type SavedAccount } from "../store/accountStore";

const APP_THEMES: Array<{ id: ThemePreference; name: string }> = [
  { id: "system", name: "跟随系统" },
  { id: "light", name: "浅色" },
  { id: "dark", name: "深色" },
];

const ANIMATION_SPEEDS: Array<{ id: AnimationSpeed; name: string }> = [
  { id: "relaxed", name: "舒缓" },
  { id: "normal", name: "标准" },
  { id: "swift", name: "快速" },
  { id: "instant", name: "极速" },
];

const ACCENT_COLORS: Array<{ id: string; name: string }> = [
  { id: "#ec4141", name: "网易红" },
  { id: "#3b82f6", name: "晴空蓝" },
  { id: "#10b981", name: "薄荷绿" },
  { id: "#8b5cf6", name: "星云紫" },
  { id: "#f59e0b", name: "琥珀橙" },
  { id: "#ec4899", name: "樱花粉" },
];

const PRIVACY_TEXT = `隐私政策
最近更新：随版本发布同步修订

一、我们收集什么
Reverie 是本地优先的桌面音乐播放器，不建立独立账户体系，不设 Reverie 远端服务器，不收集、不出售任何个人信息。以下数据仅保存在当前设备的本地存储中：
1. 偏好设置：主题、外观、动效、音质选择、淡入淡出时长、封面展示、启动行为等；
2. 播放数据：播放队列、最近播放、收藏列表缓存、歌词偏好；
3. 登录凭证：网易云音乐登录 Cookie（仅本地保存）。

二、登录凭证如何使用
1. 当你登录网易云音乐账号时，登录 Cookie 仅用于向网易云音乐官方接口发起需要身份认证的请求（播放、收藏、歌单同步等）；
2. 凭证保存在本机客户端存储中，不会上传至 Reverie 或任何第三方服务器；
3. 请勿在共享或公共设备上保持登录状态；退出登录会清除本机保存的凭证。

三、网络请求去向
1. 搜索、播放、歌单、评论等功能通过本机接口服务访问 NeteaseCloudMusicApi 及其代理的网易云音乐官方接口，请求内容仅由你主动使用的功能决定；
2. 位置展示功能调用第三方 IP 定位服务，仅根据网络出口地址推断省市信息，不读取 GPS、通讯录或精确位置；
3. 检查更新、问题反馈会访问 GitHub 及相关发布服务；
4. 上述第三方服务可能按其自身隐私政策记录必要的访问日志，此类处理不受 Reverie 控制。

四、跨端续播
开启「跨端续播」后，本机设备标识（平台与设备名）仅用于在本机标记续播上下文；当前版本不通过云端传输播放进度到其他设备。

五、数据保留与删除
1. 本地数据随应用卸载或清除应用数据一并删除；
2. 清除浏览器/WebView 站点数据同样会移除全部偏好与缓存；
3. 已发送至第三方服务的请求记录，请以对应服务的政策为准行使权利。

六、未成年人保护
Reverie 面向一般用户，不主动向未成年人推送内容，也不进行任何用户画像或个性化广告投放。未成年人使用请在监护人指导下进行。

七、安全提示
请使用可信网络环境并妥善保管账号凭证。Reverie 不会以任何理由向你索取账号密码、短信验证码或支付信息；如收到冒用 Reverie 名义的此类请求，请勿理会并向我们反馈。`;

const USAGE_TEXT = `服务条款
最近更新：随版本发布同步修订

接受条款
下载、安装或使用 Reverie 即表示你已阅读并同意本服务条款。若不同意任一条款，请停止使用并删除本应用。

一、服务说明
1. Reverie 提供音乐浏览、搜索、播放、歌单管理、歌词展示、下载等本地功能；
2. 音乐内容及元数据均来自第三方接口服务，Reverie 不存储、不上传、不改写任何音频内容；
3. 部分功能（收藏同步、私人漫游、评论、会员音质等）需登录网易云音乐账号并受该账号权益限制。

二、账号与合规使用
1. 你应使用本人合法拥有的网易云音乐账号登录，并自行保管凭证；
2. 不得利用本应用从事任何违反法律法规、平台协议或侵犯他人合法权益的行为；
3. 不得对本应用的接口服务进行攻击、爬取、逆向压测或干扰其正常运行。

三、播放与音质
1. 可用音质由当前歌曲、你的账号身份和接口返回结果共同决定，不支持的音质不会显示；
2. 会员音质（VIP/SVIP）的可用性以网易云音乐官方权益判定为准，Reverie 不提供任何形式的权益绕过。

四、下载与缓存
1. 下载路径可在「设置 > 常规」中修改；下载能力受歌曲版权、账号权限和接口返回状态限制；
2. 应用不会绕过平台权限或解除 DRM；下载内容仅供个人离线欣赏，不得二次分发或用于商业用途。

五、知识产权
1. Reverie 软件本身的代码按其开源许可证提供；
2. 音乐、歌词、评论、封面、商标等内容的权利归各权利人所有；
3. 「网易云音乐」及相关名称、商标为其权利人财产，Reverie 与其无隶属或合作关系。

六、服务变更与中止
第三方接口的内容范围、可用性与配额可能随时变化，由此导致的功能波动不属于违约。Reverie 可随版本更新调整功能形态，并在说明文档中告知。

七、责任限制
在适用法律允许的最大范围内，Reverie 按「现状」提供，不对内容的准确性、完整性、可用性作出保证；对于因使用或无法使用本应用造成的间接损失不承担责任。`;

const DISCLAIMER_TEXT = `免责声明

一、项目性质
Reverie 是开源桌面音乐播放器，仅供个人学习、技术研究与合法欣赏使用，不得用于任何商业用途。

二、内容来源
音乐数据来源于 NeteaseCloudMusicApi 所代理的公开接口，歌曲、歌词、封面等内容版权归各版权方所有。Reverie 不托管、不缓存分发任何音频文件。

三、非官方声明
本应用与网易云音乐、NetEase Cloud Music 及其关联公司无隶属、合作或授权关系。「网易云音乐」及相关商标为其权利人财产。因使用本应用产生的与平台账号相关的一切风险由使用者自行承担。

四、使用风险
使用第三方接口意味着接受其可用性变化、限流或失效的可能。因平台策略调整、接口变更、账号处罚等原因导致的功能异常，Reverie 不承担相关责任。

五、版权处理
若你是权利人或其代理，认为本应用的相关链接侵犯了合法权益，请通过项目仓库提交 Issue 并附权属证明与具体链接，我们将在核实后及时移除。

六、其他
本免责声明与隐私政策、服务条款共同构成使用本应用的完整约定；如与法律法规强制性规定冲突，以法律规定为准。`;

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
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackOpening, setFeedbackOpening] = useState(false);
  const [downloadPath, setDownloadPath] = useState(
    () =>
      localStorage.getItem("reverie_download_path") || "D:\\Reverie\\Downloads",
  );
  // 仅桌面（Tauri）环境提供系统文件夹选择器；纯浏览器降级为手填路径。
  const canPickFolder = typeof window !== "undefined" && !!window.ncm;
  const pickDownloadFolder = async () => {
    const picked = await window.ncm?.pickFolder(downloadPath || undefined);
    if (!picked) return;
    setDownloadPath(picked);
    localStorage.setItem("reverie_download_path", picked);
  };
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
  const animationSpeed = usePlayerStore((s) => s.animationSpeed);
  const setAnimationSpeed = usePlayerStore((s) => s.setAnimationSpeed);
  const accentColor = usePlayerStore((s) => s.accentColor);
  const setAccentColor = usePlayerStore((s) => s.setAccentColor);
  const reducedMotion = usePlayerStore((s) => s.reducedMotion);
  const setReducedMotion = usePlayerStore((s) => s.setReducedMotion);
  const audioFadeEnabled = usePlayerStore((s) => s.audioFadeEnabled);
  const setAudioFadeEnabled = usePlayerStore((s) => s.setAudioFadeEnabled);
  const audioFadeSeconds = usePlayerStore((s) => s.audioFadeSeconds);
  const setAudioFadeSeconds = usePlayerStore((s) => s.setAudioFadeSeconds);
  const showListCover = usePlayerStore((s) => s.showListCover);
  const setShowListCover = usePlayerStore((s) => s.setShowListCover);
  const launchFmOnStart = usePlayerStore((s) => s.launchFmOnStart);
  const setLaunchFmOnStart = usePlayerStore((s) => s.setLaunchFmOnStart);
  const crossDeviceResume = usePlayerStore((s) => s.crossDeviceResume);
  const setCrossDeviceResume = usePlayerStore((s) => s.setCrossDeviceResume);
  const loggedIn = usePlayerStore((s) => s.loggedIn);
  const profile = usePlayerStore((s) => s.profile);
  const vipInfo = usePlayerStore((s) => s.vipInfo);
  const showTranslation = usePlayerStore((s) => s.showTranslation);
  const setShowTranslation = usePlayerStore((s) => s.setShowTranslation);
  const lyricFontSize = usePlayerStore((s) => s.lyricFontSize);
  const setLyricFontSize = usePlayerStore((s) => s.setLyricFontSize);
  const logout = usePlayerStore((s) => s.logout);
  const switchAccount = usePlayerStore((s) => s.switchAccount);
  const removeAccount = usePlayerStore((s) => s.removeAccount);
  const setShowLogin = usePlayerStore((s) => s.setShowLogin);
  const clearAppCache = usePlayerStore((s) => s.clearAppCache);
  const checkUpdate = usePlayerStore((s) => s.checkUpdate);
  const updatePhase = usePlayerStore((s) => s.updatePhase);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [accountOverview, setAccountOverview] = useState<AccountOverview | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [neteaseVersion, setNeteaseVersion] = useState("");
  const [neteaseSettings, setNeteaseSettings] = useState<Record<
    string,
    unknown
  > | null>(null);
  const transition = useOriginTransition<HTMLDivElement>(
    showSettings,
    "settings",
    240,
  );
  useModalBehavior(showSettings, transition.surfaceRef, () =>
    setShowSettings(false),
  );

  useEffect(() => {
    if (showSettings && category === "account") setSavedAccounts(getSavedAccounts());
  }, [category, loggedIn, profile, showSettings]);

  useEffect(() => {
    if (!showSettings || category !== "account" || !loggedIn) {
      setAccountOverview(null);
      return;
    }
    let alive = true;
    setAccountLoading(true);
    void getAccountOverview()
      .then((value) => { if (alive) setAccountOverview(value); })
      .catch(() => { if (alive) setAccountOverview(null); })
      .finally(() => { if (alive) setAccountLoading(false); });
    return () => { alive = false; };
  }, [category, loggedIn, showSettings, profile?.userId]);

  useEffect(() => {
    if (!showSettings || category !== "about") return;
    let alive = true;
    void Promise.allSettled([
      getNeteaseApiVersion(),
      getNeteaseSettings(),
    ]).then(([version, settings]) => {
      if (!alive) return;
      if (version.status === "fulfilled") setNeteaseVersion(version.value);
      if (settings.status === "fulfilled") setNeteaseSettings(settings.value);
    });
    return () => {
      alive = false;
    };
  }, [category, showSettings]);

  if (!transition.rendered) return null;

  const close = () => setShowSettings(false);
  const checking = updatePhase === "checking";
  const vipActive = Boolean(
    vipInfo &&
      vipInfo.vipType > 0 &&
      (vipInfo.expireTime <= 0 || vipInfo.expireTime > Date.now()),
  );

  const openFeedback = async () => {
    setFeedbackOpening(true);
    try {
      const issue = createFeedbackIssue(feedbackText, {
        platform: window.ncm?.platform || navigator.platform || "unknown",
        runtime: window.ncm?.versions.runtime || "WebView",
        webview: window.ncm?.versions.webview || navigator.userAgent,
        currentSong: usePlayerStore.getState().currentSong?.name,
      });
      await openGitHubIssue(buildGitHubIssueUrl(issue));
      usePlayerStore
        .getState()
        .toast("已生成反馈报告，请在 GitHub 页面确认提交", "success");
    } catch {
      usePlayerStore
        .getState()
        .toast("打开 GitHub 反馈页面失败，请检查网络", "error");
    } finally {
      setFeedbackOpening(false);
    }
  };

  return (
    <div
      className={`modal-backdrop settings-backdrop ${transition.backdropClassName}`}
      onClick={close}
    >
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
                  <SettingRow
                    title="背景模糊"
                    hint="调整透明表面对背后内容的柔化程度"
                  >
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
                  <SettingRow
                    title="文字对比度"
                    hint="增强透明背景上的文字可读性"
                  >
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
                  <h3>界面与动效</h3>
                  <SettingRow title="播放器主题色" hint="应用到播放栏、进度条、按钮和交互高光，可自定义颜色">
                    <div className="accent-picker">
                      <div className="accent-swatches" role="group" aria-label="主题色预设">
                        {ACCENT_COLORS.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className={`accent-swatch ${accentColor.toLowerCase() === item.id ? "active" : ""}`}
                            style={{ backgroundColor: item.id }}
                            title={item.name}
                            aria-label={item.name}
                            aria-pressed={accentColor.toLowerCase() === item.id}
                            onClick={() => setAccentColor(item.id as AccentColor)}
                          />
                        ))}
                      </div>
                      <label className="accent-custom" title="自定义主题色">
                        <input
                          type="color"
                          value={accentColor}
                          aria-label="自定义播放器主题色"
                          onChange={(e) => setAccentColor(e.target.value)}
                        />
                        <span style={{ backgroundColor: accentColor }} />
                      </label>
                    </div>
                  </SettingRow>
                  <SettingRow title="界面主题" hint="切换应用的整体明暗外观">
                    <div className="opt-group">
                      {APP_THEMES.map((item) => (
                        <button key={item.id} className={`opt-btn ${theme === item.id ? "active" : ""}`} onClick={() => setTheme(item.id)}>{item.name}</button>
                      ))}
                    </div>
                  </SettingRow>
                  <SettingRow title="动画速度" hint="调节播放器内过渡与控件的动画节奏">
                    <div className="opt-group">
                      {ANIMATION_SPEEDS.map((item) => (
                        <button key={item.id} className={`opt-btn ${animationSpeed === item.id ? "active" : ""}`} onClick={() => setAnimationSpeed(item.id)}>{item.name}</button>
                      ))}
                    </div>
                  </SettingRow>
                  <SettingRow title="减少动画效果" hint="关闭大多数过渡、浮动和入场动画">
                    <button type="button" className={`setting-switch ${reducedMotion ? "active" : ""}`} role="switch" aria-checked={reducedMotion} aria-label="减少动画效果" onClick={() => setReducedMotion(!reducedMotion)}><span /></button>
                  </SettingRow>
                </div>
              </>
            )}

            {category === "general" && (
              <>
                <div className="settings-section">
                  <h3>内容与缓存</h3>
                  <SettingRow
                    title="列表展示专辑封面"
                    hint="歌单与歌曲列表行内是否显示封面缩略图，关闭后更紧凑"
                  >
                    <button
                      type="button"
                      className={`setting-switch ${showListCover ? "active" : ""}`}
                      role="switch"
                      aria-checked={showListCover}
                      aria-label="列表展示专辑封面"
                      onClick={() => setShowListCover(!showListCover)}
                    >
                      <span />
                    </button>
                  </SettingRow>
                  <SettingRow
                    title="清理缓存"
                    hint="清除接口、首页、推荐和播放数据缓存"
                  >
                    <button
                      type="button"
                      className="btn danger"
                      onClick={clearAppCache}
                    >
                      <Trash2 size={14} /> 清理缓存
                    </button>
                  </SettingRow>
                </div>
                <div className="settings-section">
                  <h3>启动</h3>
                  <SettingRow
                    title="启动直达私人漫游"
                    hint="打开 Reverie 后自动开始播放私人漫游内容（需已登录）"
                  >
                    <button
                      type="button"
                      className={`setting-switch ${launchFmOnStart ? "active" : ""}`}
                      role="switch"
                      aria-checked={launchFmOnStart}
                      aria-label="启动直达私人漫游"
                      onClick={() => setLaunchFmOnStart(!launchFmOnStart)}
                    >
                      <span />
                    </button>
                  </SettingRow>
                </div>
                <div className="settings-section">
                  <h3>跨端续播</h3>
                  <SettingRow
                    title="跨端续播"
                    hint="记住本机作为续播设备，在其他端继续上次播放进度"
                  >
                    <button
                      type="button"
                      className={`setting-switch ${crossDeviceResume ? "active" : ""}`}
                      role="switch"
                      aria-checked={crossDeviceResume}
                      aria-label="跨端续播"
                      onClick={() => setCrossDeviceResume(!crossDeviceResume)}
                    >
                      <span />
                    </button>
                  </SettingRow>
                  {crossDeviceResume && (
                    <div className="setting-sub-row">
                      <span className="setting-hint">
                        当前续播设备：
                        {window.ncm?.platform ||
                          navigator.platform ||
                          "未知平台"}
                        （本机）
                      </span>
                    </div>
                  )}
                </div>
                <div className="settings-section">
                  <h3>播放</h3>
                  <SettingRow
                    title="歌曲淡入淡出"
                    hint="起播渐入、暂停渐出，切歌与音质切换时音量平滑过渡；关闭后立即切换"
                  >
                    <button
                      type="button"
                      className={`setting-switch ${audioFadeEnabled ? "active" : ""}`}
                      role="switch"
                      aria-checked={audioFadeEnabled}
                      aria-label="歌曲淡入淡出"
                      onClick={() => setAudioFadeEnabled(!audioFadeEnabled)}
                    >
                      <span />
                    </button>
                  </SettingRow>
                  {audioFadeEnabled && (
                    <div className="setting-sub-row setting-fade-slider">
                      <span className="setting-hint">淡入淡出时长</span>
                      <input
                        type="range"
                        min={1}
                        max={12}
                        step={1}
                        value={audioFadeSeconds}
                        aria-label="淡入淡出时长（秒）"
                        onChange={(e) =>
                          setAudioFadeSeconds(Number(e.target.value))
                        }
                      />
                      <b>{audioFadeSeconds} 秒</b>
                    </div>
                  )}
                  <SettingRow
                    title="歌曲下载路径"
                    hint={
                      canPickFolder
                        ? "点击“浏览…”打开系统文件夹选择器，也可以手动输入"
                        : "浏览器环境无法直接选择系统目录，将使用该路径作为首选设置"
                    }
                  >
                    <div className="settings-path-field">
                      <input
                        className="settings-path-input"
                        value={downloadPath}
                        onChange={(event) => {
                          setDownloadPath(event.target.value);
                          localStorage.setItem(
                            "reverie_download_path",
                            event.target.value,
                          );
                        }}
                        placeholder="例如 D:\\Music\\Downloads"
                        spellCheck={false}
                      />
                      {canPickFolder && (
                        <button
                          type="button"
                          className="settings-path-btn"
                          onClick={() => void pickDownloadFolder()}
                          title="打开文件夹选择器"
                        >
                          <FolderOpen size={15} />
                          浏览…
                        </button>
                      )}
                    </div>
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
                    <div>
                      <span>播放 / 暂停</span>
                      <kbd>Space</kbd>
                    </div>
                    <div>
                      <span>快进 / 快退 5 秒</span>
                      <span>
                        <kbd>→</kbd> <kbd>←</kbd>
                      </span>
                    </div>
                    <div>
                      <span>音量增减</span>
                      <span>
                        <kbd>↑</kbd> <kbd>↓</kbd>
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {category === "account" && (
              <>
              <div className="settings-section">
                <h3>账号管理</h3>
                <SettingRow
                  title={profile?.nickname || "未登录"}
                  hint={loggedIn ? "网易云音乐账号" : "登录后同步收藏内容"}
                >
                  {loggedIn ? (
                    <div className="saved-account-actions">
                      <button className="btn" onClick={() => setShowLogin(true)}>
                        添加账号
                      </button>
                      <button className="btn danger" onClick={logout}>
                        退出登录
                      </button>
                    </div>
                  ) : (
                    <button className="btn" onClick={() => setShowLogin(true)}>
                      添加账号
                    </button>
                  )}
                </SettingRow>
                <div className="saved-accounts" aria-live="polite">
                  <div className="saved-accounts-header">
                    <span>已保存账号</span>
                    <small>{savedAccounts.length}/{MAX_SAVED_ACCOUNTS}</small>
                  </div>
                  {savedAccounts.length ? savedAccounts.map((account) => (
                    <div className={`saved-account ${account.userId === profile?.userId ? "current" : ""}`} key={account.userId}>
                      <div className="saved-account-main">
                        {account.avatarUrl ? <img src={account.avatarUrl} alt="" /> : <CircleUserRound size={22} />}
                        <div className="saved-account-copy">
                          <strong>{account.nickname || "网易云用户"}</strong>
                          <span>ID {account.userId}{account.userId === profile?.userId ? " · 当前使用" : ""}</span>
                        </div>
                        <div className="saved-account-actions">
                          {account.userId !== profile?.userId && <button className="btn" onClick={() => void switchAccount(account.userId)}>切换</button>}
                          <button className="icon-btn" title="删除账号" onClick={() => { removeAccount(account.userId); setSavedAccounts(getSavedAccounts()); }}><Trash2 size={14} /></button>
                        </div>
                      </div>
                      {account.userId === profile?.userId && (
                        <div className="saved-account-details">
                          {accountLoading ? <span className="setting-status">账号信息同步中…</span> : (
                            <>
                              <div><span>账号 ID</span><strong>{accountOverview?.userId || account.userId}</strong></div>
                              <div><span>账号类型</span><strong>网易云音乐账号</strong></div>
                              <div><span>等级</span><strong>Lv.{accountOverview?.level || 0}</strong></div>
                              <div><span>会员类型</span><strong>{vipInfo?.svip && vipActive ? "黑胶 SVIP" : vipActive || accountOverview?.vipType ? "黑胶 VIP" : "普通账号"}</strong></div>
                              <div><span>会员等级</span><strong>{vipInfo?.vipLevel ? `Lv.${vipInfo.vipLevel}` : "—"}</strong></div>
                              <div><span>会员到期</span><strong className="vip-expiry-list">{(() => { const now = Date.now(); const dates = (vipInfo?.expireTimes ?? []).filter((time) => time >= 1e11).sort((a, b) => a - b); const next = dates.find((time) => time >= now) ?? 0; const fallback = next || (vipInfo?.expireTime && vipInfo.expireTime >= now ? vipInfo.expireTime : 0); return fallback ? new Date(fallback).toLocaleDateString("zh-CN") : "未开通"; })()}</strong></div>
                              {accountOverview?.phone && <div><span>手机号</span><strong>{accountOverview.phone}</strong></div>}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )) : <p className="setting-status">暂无保存的账号</p>}
                </div>
              </div>
              </>
            )}

            {category === "about" && (
              <div className="settings-section about-section">
                <h3>应用</h3>
                <div className="about-identity">
                  <div className="about-app-icon" aria-hidden="true">
                    <img src={appIconUrl} alt="" />
                  </div>
                  <div className="about-app-copy">
                    <strong>Reverie</strong>
                    <span>Windows 与 macOS 桌面音乐播放器</span>
                    <small>
                      仅提供 Windows、macOS 客户端，不提供移动端版本
                    </small>
                    <small>{"v" + __APP_VERSION__}</small>
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
                  <b>
                    {neteaseVersion
                      ? "v" + neteaseVersion
                      : neteaseSettings
                        ? "可用"
                        : "读取中…"}
                  </b>
                </div>
                <div className="about-feedback">
                  <div className="about-feedback-head">
                    <Bug size={18} aria-hidden="true" />
                    <div>
                      <strong>问题反馈</strong>
                      <span>自动生成脱敏错误报告并打开 GitHub Issues</span>
                    </div>
                  </div>
                  <textarea
                    className="about-feedback-input"
                    value={feedbackText}
                    onChange={(event) => setFeedbackText(event.target.value)}
                    placeholder="请描述遇到的问题（可选）"
                    rows={3}
                  />
                  <button
                    className="btn"
                    onClick={() => void openFeedback()}
                    disabled={feedbackOpening}
                  >
                    {feedbackOpening ? "正在生成报告…" : "生成并提交反馈"}
                  </button>
                </div>
                <h3>说明与政策</h3>
                <div className="about-link-list">
                  <button
                    className={
                      "about-link " + (panel === "privacy" ? "active" : "")
                    }
                    onClick={() =>
                      setPanel(panel === "privacy" ? null : "privacy")
                    }
                  >
                    <span>
                      <strong>隐私政策</strong>
                      <small>数据处理、账号凭证与第三方服务</small>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                  {panel === "privacy" && (
                    <article className="about-panel">{PRIVACY_TEXT}</article>
                  )}
                  <button
                    className={
                      "about-link " + (panel === "usage" ? "active" : "")
                    }
                    onClick={() => setPanel(panel === "usage" ? null : "usage")}
                  >
                    <span>
                      <strong>服务条款</strong>
                      <small>播放、下载、设置与故障排查</small>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                  {panel === "usage" && (
                    <article className="about-panel">{USAGE_TEXT}</article>
                  )}
                  <button
                    className={
                      "about-link " + (panel === "disclaimer" ? "active" : "")
                    }
                    onClick={() =>
                      setPanel(panel === "disclaimer" ? null : "disclaimer")
                    }
                  >
                    <span>
                      <strong>免责声明</strong>
                      <small>版权归属、服务边界与责任范围</small>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                  {panel === "disclaimer" && (
                    <article className="about-panel">{DISCLAIMER_TEXT}</article>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
