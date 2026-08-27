import { useEffect, useRef, useState } from "react";
import { userQualityTier, usePlayerStore } from "../store/playerStore";
import { sizedImage } from "../utils/image";
import { CircleUserRound } from "lucide-react";
import { getProfileCenter } from "../api/profile";
import {
  mergeWithCachedIdentity,
  useProfileStore,
} from "../store/profileStore";
import FollowListDialog from "./FollowListDialog";
import {
  captureInteractionOrigin,
  useOriginTransition,
} from "../utils/originTransition";

export default function UserMenu() {
  const [open, setOpen] = useState(false);
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
  const isVip = vipType > 0 || vipLevel > 0 || expireTime > 0;
  // 铭牌以统一身份档位为准（/vip/info 双包生效态 + 官方 redplus 品牌位），
  // 不再用 vipType 数字猜档位：11 实为年费 VIP 而非 SVIP。
  const tier = userQualityTier(usePlayerStore.getState());
  // 昵称旁图片只认两类官方来源：佩戴中的个性化铭牌（plate），以及
  // vipRights 品牌位图标（brand，与档位天然对应，SVIP 即 redplus 图）。
  // 动态包图/深扫等其它来源无法自证身份档位——SVIP 账号就曾被下发
  // "VIP·柒" 等级图——一律改用矢量铭牌按档位自绘，杜绝错标。
  const imgBadge =
    vipInfo && (vipInfo.badgeKind === "plate" || vipInfo.badgeKind === "brand")
      ? vipInfo.badgeUrl
      : undefined;
  const frameUrl = profile?.avatarFrameUrl;
  // 官方铭牌为矢量渲染，等级数字用大写中文（VIP·柒 / SVIP·柒）。
  const cnDigits = [
    "零",
    "一",
    "二",
    "三",
    "四",
    "五",
    "六",
    "七",
    "八",
    "九",
    "十",
  ];
  const levelText =
    vipLevel >= 1 && vipLevel <= 10
      ? `·${cnDigits[vipLevel]}`
      : vipLevel > 10
        ? `·${vipLevel}`
        : "";

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
        imgBadge &&
        brokenBadge !== imgBadge &&
        imgBadge !== frameUrl ? (
          <img
            className="user-badge-api"
            src={imgBadge}
            alt="会员"
            onError={() => setBrokenBadge(imgBadge)}
          />
        ) : isVip ? (
          <span
            className={`user-vip-fallback${tier === "svip" ? " svip" : ""}`}
            aria-label={tier === "svip" ? "黑胶超级会员" : "黑胶会员"}
          >
            {tier === "svip" ? "SVIP" : "VIP"}
            {levelText}
          </span>
        ) : null}
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
                {isVip && expireTime > 0 && (
                  <span>
                    {new Date(expireTime).getFullYear()}年
                    {String(new Date(expireTime).getMonth() + 1).padStart(
                      2,
                      "0",
                    )}
                    月{String(new Date(expireTime).getDate()).padStart(2, "0")}
                    日
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="user-dropdown-grid">
            <button
              className="user-dropdown-cell"
              onClick={() => {
                setOpen(false);
                void openProfile();
              }}
            >
              个人中心
            </button>
            <button
              className="user-dropdown-cell"
              onClick={() => {
                setOpen(false);
                usePlayerStore.setState({
                  activeView: "listenTogether",
                  prevView: "home",
                });
              }}
            >
              一起听
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
    </div>
  );
}
