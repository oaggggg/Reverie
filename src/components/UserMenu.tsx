import { useEffect, useRef, useState } from "react";
import { usePlayerStore } from "../store/playerStore";
import { sizedImage } from "../utils/image";
import { CircleUserRound } from "lucide-react";
import { getProfileCenter } from "../api/profile";
import { useProfileStore } from "../store/profileStore";

export default function UserMenu() {
  const [open, setOpen] = useState(false);
  const [brokenBadge, setBrokenBadge] = useState("");
  const profile = usePlayerStore((s) => s.profile);
  const vipInfo = usePlayerStore((s) => s.vipInfo);
  const logout = usePlayerStore((s) => s.logout);
  const loadVipInfo = usePlayerStore((s) => s.loadVipInfo);
  const setShowLogin = usePlayerStore((s) => s.setShowLogin);
  const openProfile = useProfileStore((s) => s.openProfile);
  const profileDetail = useProfileStore((s) => s.detail);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    if (profile && !vipInfo) void loadVipInfo();
    // 轻量加载个人资料（等级/关注/粉丝/简介/加入时间），不跳转页面
    const uid = usePlayerStore.getState().profile?.userId;
    if (profile && uid && !useProfileStore.getState().detail) {
      void getProfileCenter(uid)
        .then((data) => useProfileStore.setState({ detail: data.detail }))
        .catch(() => {});
    }
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
  const badgeUrl = vipInfo?.badgeUrl || profile?.badgeUrl;

  return (
    <div className="user-menu" ref={ref}>
      <button
        className="topnav-user"
        onClick={() => setOpen(!open)}
        title={profile?.nickname}
      >
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
        <span className="user-nick">{profile?.nickname ?? ""}</span>
        {isVip && badgeUrl && brokenBadge !== badgeUrl ? (
          <img
            className="user-badge-api"
            src={badgeUrl}
            alt="会员"
            onError={() => setBrokenBadge(badgeUrl)}
          />
        ) : isVip ? (
          <span className="user-vip-fallback">
            {vipType === 11 ? "SVIP" : "VIP"}
          </span>
        ) : null}
      </button>
      {open && (
        <div className="user-dropdown">
          <div className="user-dropdown-head">
            {profile?.avatarUrl ? (
              <img src={sizedImage(profile.avatarUrl, 100)} alt="" />
            ) : (
              <span className="user-avatar-ph-lg">
                <CircleUserRound size={24} />
              </span>
            )}
            <div className="uh-info">
              <div className="nm">
                <span className="uh-nick">{profile?.nickname}</span>
                {profileDetail && profileDetail.level > 0 && (
                  <em className="uh-level-chip">Lv.{profileDetail.level}</em>
                )}
              </div>
              <div className="uh-stats">
                {profileDetail && <span>关注 {profileDetail.follows}</span>}
                {profileDetail && <span>粉丝 {profileDetail.followeds}</span>}
                {isVip && expireTime > 0 && (
                  <span>
                    {new Date(expireTime).getFullYear()}年
                    {String(new Date(expireTime).getMonth() + 1).padStart(2, "0")}
                    月
                    {String(new Date(expireTime).getDate()).padStart(2, "0")}日
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
                  activeView: "downloadHistory",
                  prevView: "home",
                });
              }}
            >
              下载与购买
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
    </div>
  );
}
