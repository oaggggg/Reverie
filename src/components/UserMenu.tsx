import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePlayerStore } from "../store/playerStore";
import { sizedImage } from "../utils/image";
import { CircleUserRound, X } from "lucide-react";
import { getProfileCenter } from "../api/profile";
import {
  mergeWithCachedIdentity,
  useProfileStore,
} from "../store/profileStore";
import FollowListDialog from "./FollowListDialog";
import ProfilePage from "./ProfilePage";
import {
  captureInteractionOrigin,
  useOriginTransition,
} from "../utils/originTransition";

export default function UserMenu() {
  const [open, setOpen] = useState(false);
  const [profileDialog, setProfileDialog] = useState(false);
  const [brokenBadge, setBrokenBadge] = useState("");
  const profile = usePlayerStore((s) => s.profile);
  const vipInfo = usePlayerStore((s) => s.vipInfo);
  const logout = usePlayerStore((s) => s.logout);
  const loadVipInfo = usePlayerStore((s) => s.loadVipInfo);
  const setShowLogin = usePlayerStore((s) => s.setShowLogin);
  const openProfile = useProfileStore((s) => s.openProfile);
  const [followDialog, setFollowDialog] = useState<
    "follows" | "followers" | null
  >(null);
  const prefetchStarted = useRef(false);
  const profileDetail = useProfileStore((s) => s.detail);
  const ref = useRef<HTMLDivElement>(null);
  const transition = useOriginTransition<HTMLDivElement>(
    open,
    "user-menu",
    200,
  );
  const profileTransition = useOriginTransition(
    profileDialog,
    "profile-feature",
    220,
  );

  const prefetchDetails = () => {
    if (!profile || prefetchStarted.current) return;
    prefetchStarted.current = true;
    if (!vipInfo) void loadVipInfo();
    // 轻量加载个人资料（等级/关注/粉丝/简介/加入时间），不跳转页面。
    const uid = usePlayerStore.getState().profile?.userId;
    if (profile && uid && !useProfileStore.getState().detail) {
      void getProfileCenter(uid)
        .then((data) =>
          useProfileStore.setState({
            detail: mergeWithCachedIdentity(data.detail),
          }),
        )
        .catch(() => {});
    }
  };

  useEffect(() => {
    if (!open) return;
    prefetchDetails();
    // 每次展开都静默刷新会员信息（loadVipInfo 内部 10 分钟节流兜底）：
    // 用户刚升级 SVIP 后打开菜单即可同步身份，不必等到点开音质菜单。
    void loadVipInfo();
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, profile, vipInfo, loadVipInfo]);

  const switchAccount = () => {
    setOpen(false);
    setShowLogin(true);
  };

  const vipType = Number(vipInfo?.vipType ?? profile?.vipType ?? 0);
  const vipLevel = Number(vipInfo?.vipLevel ?? 0);
  const expireTime = Number(vipInfo?.expireTime ?? 0);
  const expireTimes = (vipInfo?.expireTimes?.length
    ? vipInfo.expireTimes
    : expireTime > 0
      ? [expireTime]
      : []
  ).filter((time) => Number.isFinite(time) && time >= 1e11);
  const displayExpireTime =
    expireTimes.find((time) => time >= Date.now()) ?? 0;
  const isVip = vipType > 0 || vipLevel > 0 || expireTime > 0;
  // 铭牌以统一身份档位为准（/vip/info 双包生效态 + 官方 redplus 品牌位），
  // 不再用 vipType 数字猜档位：11 实为年费 VIP 而非 SVIP。
  const imgBadges =
    vipInfo?.badgeKind === "brand"
      ? vipInfo.badgeUrls?.length
        ? vipInfo.badgeUrls
        : vipInfo.badgeUrl
          ? [vipInfo.badgeUrl]
          : []
      : [];
  const frameUrl = profile?.avatarFrameUrl;

  return (
    <div className="user-menu" ref={ref}>
      <button
        className="topnav-user"
        data-origin-key="user-menu"
        onPointerEnter={prefetchDetails}
        onFocus={prefetchDetails}
        onClick={(event) => {
          captureInteractionOrigin("user-menu", event.currentTarget);
          setOpen(!open);
        }}
        title={profile?.nickname}
      >
        <span className="user-avatar-wrap">
          {profile?.avatarUrl ? (
            <img
              className="user-avatar"
              src={sizedImage(profile.avatarUrl, 100)}
              alt=""
            />
          ) : (
            <span className="user-avatar user-avatar-ph">
              <CircleUserRound size={17} />
            </span>
          )}
          {/* 佩戴中的个性化头像框：官方挂件图，按原始尺寸悬浮于头像之上 */}
          {frameUrl && brokenBadge !== frameUrl ? (
            <img
              className="user-avatar-frame"
              src={frameUrl}
              alt=""
              onError={() => setBrokenBadge(frameUrl)}
            />
          ) : null}
        </span>
        <span className="user-nick">{profile?.nickname ?? ""}</span>
        {/* 铭牌与头像框是同一来源时只保留头像上的挂件展示，避免重复 */}
        {isVip &&
          imgBadges.map((badge) =>
            brokenBadge !== badge && badge !== frameUrl ? (
              <img
                className="user-badge-api"
                key={badge}
                src={badge}
                alt="会员"
                onError={() => setBrokenBadge(badge)}
              />
            ) : null,
          )}
      </button>
      {transition.rendered && (
        <div
          ref={transition.surfaceRef}
          className={`user-dropdown ${transition.surfaceClassName}`}
        >
          <div className="user-dropdown-head">
            <span className="user-avatar-wrap lg">
              {profile?.avatarUrl ? (
                <img src={sizedImage(profile.avatarUrl, 100)} alt="" />
              ) : (
                <span className="user-avatar-ph-lg">
                  <CircleUserRound size={24} />
                </span>
              )}
              {frameUrl && brokenBadge !== frameUrl ? (
                <img
                  className="user-avatar-frame"
                  src={frameUrl}
                  alt=""
                  onError={() => setBrokenBadge(frameUrl)}
                />
              ) : null}
            </span>
            <div className="uh-info">
              <div className="nm">
                <span className="uh-nick">{profile?.nickname}</span>
                {profileDetail && profileDetail.level > 0 && (
                  <em className="uh-level-chip">Lv.{profileDetail.level}</em>
                )}
              </div>
              <div className="uh-stats">
                {profileDetail && (
                  <button
                    className="user-dropdown-stat"
                    onClick={() => {
                      setOpen(false);
                      setFollowDialog("follows");
                    }}
                  >
                    关注 {profileDetail.follows}
                  </button>
                )}
                {profileDetail && (
                  <button
                    className="user-dropdown-stat"
                    onClick={() => {
                      setOpen(false);
                      setFollowDialog("followers");
                    }}
                  >
                    粉丝 {profileDetail.followeds}
                  </button>
                )}
                {isVip && displayExpireTime > 0 && (
                  <span className="vip-expiry-list">
                    {new Date(displayExpireTime).toLocaleDateString("zh-CN")}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="user-dropdown-grid">
            <button
              className="user-dropdown-cell"
              onClick={(event) => {
                captureInteractionOrigin("profile-feature", event.currentTarget);
                setOpen(false);
                setProfileDialog(true);
                void openProfile(false);
              }}
            >
              个人中心
            </button>
          </div>
          <div className="user-dropdown-foot">
            <button className="user-dropdown-item" onClick={switchAccount}>
              切换账号
            </button>
            <button
              className="user-dropdown-item danger"
              onClick={() => {
                logout();
                setOpen(false);
              }}
            >
              退出登录
            </button>
          </div>
        </div>
      )}
      {followDialog && (
        <FollowListDialog
          type={followDialog}
          onClose={() => setFollowDialog(null)}
        />
      )}
      {profileTransition.rendered && createPortal(
        <div className={`modal-backdrop user-feature-backdrop ${profileTransition.backdropClassName}`} onClick={() => setProfileDialog(false)}>
          <section ref={profileTransition.surfaceRef} className={`modal user-feature-modal profile-feature-modal ${profileTransition.surfaceClassName}`} role="dialog" aria-modal="true" aria-label="个人中心" onClick={(event) => event.stopPropagation()}>
            <button className="icon-btn user-feature-close" title="关闭" onClick={() => setProfileDialog(false)}><X size={18} /></button>
            <ProfilePage modal />
          </section>
        </div>,
        document.body,
      )}
    </div>
  );
}
