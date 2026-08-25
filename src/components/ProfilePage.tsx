import { useState } from "react";
import {
  Album,
  CalendarDays,
  Disc3,
  Heart,
  LibraryBig,
  Music2,
  Podcast,
  Radio,
  Users,
} from "lucide-react";
import { useExploreStore } from "../store/exploreStore";
import { usePlayerStore } from "../store/playerStore";
import { useProfileStore } from "../store/profileStore";
import { useCollectionStore } from "../store/collectionStore";
import { sizedImage } from "../utils/image";
import BackButton from "./BackButton";
import SongList from "./SongList";
import FollowListDialog from "./FollowListDialog";
import { LoadingState, Page } from "./Page";

function formatDate(timestamp: number) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
  });
}

export default function ProfilePage() {
  const [brokenAvatar, setBrokenAvatar] = useState("");
  const [brokenBackground, setBrokenBackground] = useState("");
  const [followDialog, setFollowDialog] = useState<
    "follows" | "followers" | null
  >(null);
  const detail = useProfileStore((state) => state.detail);
  const level = useProfileStore((state) => state.level);
  const subcount = useProfileStore((state) => state.subcount);
  const medals = useProfileStore((state) => state.medals);
  const createdRadios = useProfileStore((state) => state.createdRadios);
  const createdPrograms = useProfileStore((state) => state.createdPrograms);
  const records = useProfileStore((state) => state.records);
  const period = useProfileStore((state) => state.period);
  const loading = useProfileStore((state) => state.loading);
  const recordsLoading = useProfileStore((state) => state.recordsLoading);
  const setPeriod = useProfileStore((state) => state.setPeriod);
  const openCollections = useCollectionStore((state) => state.openCollections);
  const playSong = usePlayerStore((state) => state.playSong);
  const openRadio = useExploreStore((state) => state.openRadio);

  const openSocial = (tab: "follows" | "followers") => {
    setFollowDialog(tab);
  };

  if (!detail) {
    return (
      <Page>
        {loading ? (
          <LoadingState label="正在加载个人中心…" />
        ) : (
          <div className="empty">无法加载个人资料</div>
        )}
      </Page>
    );
  }

  const levelProgress = Math.max(
    0,
    Math.min(100, (level?.progress ?? 0) * 100),
  );
  const songs = records.map((record) => record.song);

  return (
    <Page>
      <BackButton />
      <section className="profile-hero">
        {detail.backgroundUrl && brokenBackground !== detail.backgroundUrl && (
          <img
            className="profile-hero-background"
            src={sizedImage(detail.backgroundUrl, 1600)}
            alt=""
            onError={() => setBrokenBackground(detail.backgroundUrl)}
          />
        )}
        <div className="profile-hero-shade" />
        <div className="profile-hero-content">
          {detail.avatarUrl && brokenAvatar !== detail.avatarUrl ? (
            <img
              className="profile-avatar-large"
              src={sizedImage(detail.avatarUrl, 320)}
              alt=""
              onError={() => setBrokenAvatar(detail.avatarUrl)}
            />
          ) : (
            <span className="profile-avatar-large profile-avatar-placeholder">
              <Disc3 size={38} />
            </span>
          )}
          <div className="profile-copy">
            <div className="profile-title-row">
              <h1>{detail.nickname}</h1>
              <span>Lv.{detail.level}</span>
            </div>
            <p>{detail.signature || "这个人很安静，还没有留下简介"}</p>
            {detail.createTime > 0 && (
              <div className="profile-since">
                <CalendarDays size={14} />
                {formatDate(detail.createTime)} 加入网易云音乐
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="profile-stat-grid">
        <button onClick={() => openSocial("follows")}>
          <Users size={18} />
          <strong>{detail.follows}</strong>
          <span>关注</span>
        </button>
        <button onClick={() => openSocial("followers")}>
          <Heart size={18} />
          <strong>{detail.followeds}</strong>
          <span>粉丝</span>
        </button>
        <div>
          <Music2 size={18} />
          <strong>{detail.listenSongs}</strong>
          <span>听过歌曲</span>
        </div>
        <div>
          <LibraryBig size={18} />
          <strong>
            {subcount?.createdPlaylistCount ?? detail.playlistCount}
          </strong>
          <span>创建歌单</span>
        </div>
      </section>

      <section className="profile-level-section">
        <div className="profile-level-heading">
          <div>
            <span>等级进度</span>
            <strong>Lv.{level?.level ?? detail.level}</strong>
          </div>
          <span>{Math.round(levelProgress)}%</span>
        </div>
        <div className="profile-level-track">
          <span style={{ width: `${levelProgress}%` }} />
        </div>
        <div className="profile-level-meta">
          <span>
            今日听歌 {level?.nowPlayCount ?? 0} / {level?.nextPlayCount ?? 0}
          </span>
          <span>
            登录天数 {level?.nowLoginCount ?? 0} / {level?.nextLoginCount ?? 0}
          </span>
        </div>
      </section>

      <section className="profile-library-summary">
        <button onClick={() => void openCollections("albums")}>
          <Album size={17} />
          <strong>{subcount?.albumCount ?? 0}</strong>
          <span>收藏专辑</span>
        </button>
        <button onClick={() => void openCollections("artists")}>
          <Music2 size={17} />
          <strong>{subcount?.artistCount ?? 0}</strong>
          <span>收藏歌手</span>
        </button>
        <button onClick={() => void openCollections("mvs")}>
          <Radio size={17} />
          <strong>{subcount?.mvCount ?? 0}</strong>
          <span>收藏 MV</span>
        </button>
        <button onClick={() => void openCollections("radios")}>
          <Podcast size={17} />
          <strong>{subcount?.djRadioCount ?? 0}</strong>
          <span>订阅播客</span>
        </button>
      </section>

      {medals.length > 0 && (
        <section className="content-section profile-medals-section">
          <div className="list-header">
            <h3>我的徽章</h3>
            <span className="count">{medals.length} 枚</span>
          </div>
          <div className="profile-medal-grid">
            {medals.map((medal) => (
              <article
                className="profile-medal"
                key={medal.id}
                title={medal.description || medal.name}
              >
                {medal.iconUrl ? (
                  <img
                    src={sizedImage(medal.iconUrl, 120)}
                    alt=""
                    loading="lazy"
                  />
                ) : (
                  <span className="profile-medal-placeholder">
                    <Disc3 size={18} />
                  </span>
                )}
                <strong>{medal.name}</strong>
                {medal.level > 0 && <small>Lv.{medal.level}</small>}
              </article>
            ))}
          </div>
        </section>
      )}

      {createdRadios.length > 0 && (
        <section className="content-section">
          <div className="list-header">
            <h3>我创建的电台</h3>
            <span className="count">{createdRadios.length} 个</span>
          </div>
          <div className="profile-radio-list">
            {createdRadios.map((radio) => (
              <button key={radio.id} onClick={() => void openRadio(radio.id)}>
                {radio.picUrl ? (
                  <img
                    src={sizedImage(radio.picUrl, 120)}
                    alt=""
                    loading="lazy"
                  />
                ) : (
                  <span className="profile-radio-placeholder">
                    <Podcast size={18} />
                  </span>
                )}
                <span>
                  <strong>{radio.name}</strong>
                  <small>
                    {radio.programCount} 期 · {radio.subscriberCount} 订阅
                  </small>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {createdPrograms.length > 0 && (
        <section className="content-section">
          <div className="list-header">
            <h3>我发布的电台节目</h3>
            <span className="count">{createdPrograms.length} 期</span>
          </div>
          <SongList songs={createdPrograms} emptyText="暂无电台节目" />
        </section>
      )}

      <section className="content-section">
        <div className="profile-record-heading">
          <div>
            <h2>听歌排行</h2>
            <span>{records.length} 首</span>
          </div>
          <div className="segmented">
            <button
              className={period === "week" ? "active" : ""}
              onClick={() => void setPeriod("week")}
            >
              最近一周
            </button>
            <button
              className={period === "all" ? "active" : ""}
              onClick={() => void setPeriod("all")}
            >
              所有时间
            </button>
          </div>
        </div>
        {recordsLoading ? (
          <LoadingState label="正在加载听歌排行…" />
        ) : records.length ? (
          <div className="profile-record-list">
            {records.map((record, index) => (
              <button
                key={`${record.song.id}-${index}`}
                onClick={() => void playSong(record.song, songs)}
              >
                <span className="profile-record-rank">{index + 1}</span>
                {record.song.picUrl ? (
                  <img
                    src={sizedImage(record.song.picUrl, 100)}
                    alt=""
                    loading="lazy"
                  />
                ) : (
                  <span className="profile-record-cover">
                    <Disc3 size={17} />
                  </span>
                )}
                <span className="profile-record-copy">
                  <strong>{record.song.name}</strong>
                  <small>{record.song.artists}</small>
                </span>
                <span className="profile-record-count">
                  播放 {record.playCount} 次
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty">听歌排行未公开或暂无记录</div>
        )}
      </section>
      {followDialog && (
        <FollowListDialog
          type={followDialog}
          onClose={() => setFollowDialog(null)}
        />
      )}
    </Page>
  );
}
