import { useEffect, useRef, useState } from "react";
import { Heart, RefreshCw } from "lucide-react";
import type {
  BroadcastCategory,
  PodcastProgramRank,
  RadioInfo,
} from "../api/types";
import { useExploreStore } from "../store/exploreStore";
import { sizedImage } from "../utils/image";
import { LoadingState, Page, PageHeader } from "./Page";
import SongList from "./SongList";
import {
  getDifmChannels,
  getDifmSubscribedChannels,
  getDifmTracks,
  getPodcastCategories,
  getPodcastExcludeHotCategories,
  getPodcastHomeCategoryRecommendations,
  getPodcastCategoryRecommendations,
  getPodcastAdvancedToplist,
  getPodcastHotRadios,
  getPodcastLegacyHotRadios,
  getPersonalizedDjPrograms,
  getPodcastProgramHoursToplist,
  getPodcastProgramToplist,
  getPodcastPaidRadios,
  getPodcastTodayPreferred,
  getPodcastToplist,
  getProgramRecommendations,
  toggleDifmChannel,
} from "../api/broadcast.ts";
import type { DifmChannel, Song } from "../api/types.ts";
import { usePlayerStore } from "../store/playerStore.ts";


function RadioGrid({ radios }: { radios: RadioInfo[] }) {
  const openRadio = useExploreStore((s) => s.openRadio);
  const toggleSubscription = useExploreStore((s) => s.toggleRadioSubscription);
  return (
    <div className="media-grid">
      {radios.map((radio) => (
        <article
          className="media-card"
          key={radio.id}
          onClick={() => void openRadio(radio.id)}
        >
          <div className="card-cover">
            <img src={sizedImage(radio.picUrl, 360)} alt="" loading="lazy" />
            <button
              className={`media-favorite ${radio.subscribed ? "active" : ""}`}
              title={radio.subscribed ? "取消订阅" : "订阅电台"}
              onClick={(e) => {
                e.stopPropagation();
                void toggleSubscription(radio);
              }}
            >
              <Heart
                size={15}
                fill={radio.subscribed ? "currentColor" : "none"}
              />
            </button>
          </div>
          <strong>{radio.name}</strong>
          <span>
            {radio.category || radio.djName || `${radio.programCount} 期`}
          </span>
        </article>
      ))}
    </div>
  );
}

function ProgramRankGrid({
  items,
  loading,
}: {
  items: PodcastProgramRank[];
  loading: boolean;
}) {
  const playSong = usePlayerStore((state) => state.playSong);
  const songs = items
    .map((item) => item.song)
    .filter((song): song is NonNullable<typeof song> => song !== null);
  return loading ? (
    <LoadingState label="正在加载节目榜…" />
  ) : (
    <div className="program-rank-grid">
      {items.map((item, index) => (
        <button
          className="program-rank-card"
          key={`${item.id}-${index}`}
          disabled={!item.song}
          onClick={() => item.song && void playSong(item.song, songs)}
        >
          <span className="program-rank-index">{index + 1}</span>
          {item.coverUrl ? (
            <img src={sizedImage(item.coverUrl, 180)} alt="" />
          ) : (
            <span className="program-rank-cover">DJ</span>
          )}
          <span className="program-rank-copy">
            <strong>{item.name}</strong>
            <small>
              {item.radioName || item.djName || item.description || "播客节目"}
            </small>
          </span>
          {item.score > 0 && <b>{item.score.toLocaleString("zh-CN")}</b>}
        </button>
      ))}
      {!items.length && <div className="empty">暂无节目榜数据</div>}
    </div>
  );
}

const DIFM_SOURCES = [
  { id: 0, label: "最嗨电音" },
  { id: 1, label: "古典电台" },
  { id: 2, label: "爵士电台" },
];

export function DifmPanel() {
  const playSong = usePlayerStore((state) => state.playSong);
  const [source, setSource] = useState(0);
  const [channels, setChannels] = useState<DifmChannel[]>([]);
  const [selected, setSelected] = useState<DifmChannel | null>(null);
  const [tracks, setTracks] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [error, setError] = useState("");
  const tracksRequestRef = useRef(0);
  const channelsRequestRef = useRef(0);

  const load = async (nextSource = source) => {
    const request = ++channelsRequestRef.current;
    setLoading(true);
    setError("");
    try {
      const [available, subscribed] = await Promise.all([
        getDifmChannels(nextSource),
        getDifmSubscribedChannels(nextSource),
      ]);
      if (request !== channelsRequestRef.current) return;
      const subscribedIds = new Set(subscribed.map((item) => item.id));
      const merged = available.map((item) => ({
        ...item,
        subscribed: item.subscribed || subscribedIds.has(item.id),
      }));
      setChannels(merged);
      setSelected(
        (current) =>
          merged.find((item) => item.id === current?.id) ?? merged[0] ?? null,
      );
    } catch (cause) {
      if (request !== channelsRequestRef.current) return;
      setChannels([]);
      setSelected(null);
      setError(cause instanceof Error ? cause.message : "DIFM 电台加载失败");
    } finally {
      if (request === channelsRequestRef.current) setLoading(false);
    }
  };

  const loadTracks = async (channel: DifmChannel | null) => {
    setSelected(channel);
    if (!channel) {
      tracksRequestRef.current += 1;
      setTracks([]);
      return;
    }
    const request = ++tracksRequestRef.current;
    setTracksLoading(true);
    try {
      const next = await getDifmTracks(source, channel.id);
      if (request !== tracksRequestRef.current) return;
      setTracks(next);
    } catch {
      if (request !== tracksRequestRef.current) return;
      setTracks([]);
    } finally {
      if (request === tracksRequestRef.current) setTracksLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // Source changes are handled explicitly by the source buttons below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chooseSource = (nextSource: number) => {
    setSource(nextSource);
    tracksRequestRef.current += 1;
    setTracks([]);
    void load(nextSource);
  };

  const toggle = async (channel: DifmChannel) => {
    try {
      await toggleDifmChannel(channel.id, !channel.subscribed);
      setChannels((items) =>
        items.map((item) =>
          item.id === channel.id
            ? { ...item, subscribed: !channel.subscribed }
            : item,
        ),
      );
    } catch {
      setError("DIFM 频道收藏操作失败");
    }
  };

  return (
    <section className="difm-section">
      <div className="list-header">
        <h3>DIFM 电台</h3>
        <button
          className="icon-button"
          title="刷新 DIFM"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? "spin" : ""} />
        </button>
      </div>
      <div className="collection-tabs" role="tablist" aria-label="DIFM 来源">
        {DIFM_SOURCES.map((item) => (
          <button
            key={item.id}
            className={source === item.id ? "active" : ""}
            onClick={() => chooseSource(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {loading ? (
        <LoadingState label="正在加载 DIFM 频道…" />
      ) : channels.length ? (
        <div className="difm-layout">
          <div className="difm-channel-grid">
            {channels.map((channel) => (
              <button
                className={`difm-channel ${selected?.id === channel.id ? "active" : ""}`}
                key={channel.id}
                onClick={() => void loadTracks(channel)}
              >
                {channel.coverUrl ? (
                  <img src={sizedImage(channel.coverUrl, 180)} alt="" />
                ) : (
                  <span className="difm-channel-placeholder">DIFM</span>
                )}
                <span>{channel.name}</span>
                <i
                  onClick={(event) => {
                    event.stopPropagation();
                    void toggle(channel);
                  }}
                  title={channel.subscribed ? "取消收藏" : "收藏频道"}
                >
                  <Heart
                    size={14}
                    fill={channel.subscribed ? "currentColor" : "none"}
                  />
                </i>
              </button>
            ))}
          </div>
          <div className="difm-tracks">
            {selected ? (
              <SongList
                songs={tracks}
                loading={tracksLoading}
                title={`${selected.name} · 播放列表`}
                emptyText="暂无播放内容"
              />
            ) : (
              <div className="empty">选择一个频道查看播放列表</div>
            )}
            {tracks.length > 0 && (
              <button
                className="btn"
                onClick={() => void playSong(tracks[0]!, tracks)}
              >
                播放当前频道
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="empty">暂无 DIFM 频道</div>
      )}
      {error && (
        <div className="broadcast-error" role="alert">
          {error}
        </div>
      )}
    </section>
  );
}

export default function RadioPage() {
  const radios = useExploreStore((s) => s.radios);
  const subscribed = useExploreStore((s) => s.subscribedRadios);
  const loading = useExploreStore((s) => s.loading);
  const loadRadios = useExploreStore((s) => s.loadRadios);
  const [ranking, setRanking] = useState<
    "new" | "hot" | "hours" | "popular" | "newcomer" | "pay" | ""
  >("");
  const [ranked, setRanked] = useState<RadioInfo[]>([]);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [categories, setCategories] = useState<BroadcastCategory[]>([]);
  const [excludeHotCategories, setExcludeHotCategories] = useState<
    BroadcastCategory[]
  >([]);
  const [categoryId, setCategoryId] = useState(0);
  const [categoryRadios, setCategoryRadios] = useState<RadioInfo[]>([]);
  const [hotRadios, setHotRadios] = useState<RadioInfo[]>([]);
  const [legacyHotRadios, setLegacyHotRadios] = useState<RadioInfo[]>([]);
  const [homeCategoryRadios, setHomeCategoryRadios] = useState<RadioInfo[]>([]);
  const [personalizedPrograms, setPersonalizedPrograms] = useState<
    PodcastProgramRank[]
  >([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [programRanking, setProgramRanking] = useState<
    "top" | "hours" | "today" | ""
  >("");
  const [programRanks, setProgramRanks] = useState<PodcastProgramRank[]>([]);
  const [programRankingLoading, setProgramRankingLoading] = useState(false);
  const [paidRadios, setPaidRadios] = useState<RadioInfo[]>([]);
  const [paidLoading, setPaidLoading] = useState(false);
  const rankingRequestRef = useRef(0);
  const categoryRequestRef = useRef(0);
  const programRankingRequestRef = useRef(0);

  useEffect(() => {
    void loadRadios();
  }, [loadRadios]);

  useEffect(() => {
    let alive = true;
    setDiscoveryLoading(true);
    void Promise.allSettled([
      getPodcastCategories(),
      getPodcastHotRadios(),
      getPodcastExcludeHotCategories(),
      getPodcastHomeCategoryRecommendations(),
      getPodcastLegacyHotRadios(),
      getPersonalizedDjPrograms(),
      getProgramRecommendations(),
    ])
      .then(
        ([
          nextCategories,
          nextHot,
          nextExclude,
          nextHome,
          nextLegacyHot,
          nextPersonalized,
          nextRecommended,
        ]) => {
          if (!alive) return;
          setCategories(
            nextCategories.status === "fulfilled" ? nextCategories.value : [],
          );
          setHotRadios(nextHot.status === "fulfilled" ? nextHot.value : []);
          setExcludeHotCategories(
            nextExclude.status === "fulfilled" ? nextExclude.value : [],
          );
          setHomeCategoryRadios(
            nextHome.status === "fulfilled" ? nextHome.value : [],
          );
          setLegacyHotRadios(
            nextLegacyHot.status === "fulfilled" ? nextLegacyHot.value : [],
          );
          const programs = [
            ...(nextPersonalized.status === "fulfilled"
              ? nextPersonalized.value
              : []),
            ...(nextRecommended.status === "fulfilled"
              ? nextRecommended.value
              : []),
          ];
          setPersonalizedPrograms(
            programs.filter(
              (item, index, items) =>
                items.findIndex((entry) => entry.id === item.id) === index,
            ),
          );
        },
      )
      .catch(() => {
        if (alive) setCategories([]);
      })
      .finally(() => {
        if (alive) setDiscoveryLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const loadCategory = async (id: number) => {
    const request = ++categoryRequestRef.current;
    setCategoryId(id);
    if (!id) {
      setCategoryRadios([]);
      return;
    }
    setDiscoveryLoading(true);
    try {
      const next = await getPodcastCategoryRecommendations(id);
      if (request !== categoryRequestRef.current) return;
      setCategoryRadios(next);
    } catch {
      if (request !== categoryRequestRef.current) return;
      setCategoryRadios([]);
    } finally {
      if (request === categoryRequestRef.current) setDiscoveryLoading(false);
    }
  };

  const loadRanking = async (
    type: "new" | "hot" | "hours" | "popular" | "newcomer" | "pay",
  ) => {
    const request = ++rankingRequestRef.current;
    setRanking(type);
    setRankingLoading(true);
    try {
      const next =
        type === "new" || type === "hot"
          ? await getPodcastToplist(type)
          : await getPodcastAdvancedToplist(type);
      if (request !== rankingRequestRef.current) return;
      setRanked(next);
    } catch {
      if (request !== rankingRequestRef.current) return;
      setRanked([]);
    } finally {
      if (request === rankingRequestRef.current) setRankingLoading(false);
    }
  };

  const loadProgramRanking = async (type: "top" | "hours" | "today") => {
    const request = ++programRankingRequestRef.current;
    setProgramRanking(type);
    setProgramRankingLoading(true);
    try {
      const next =
        type === "top"
          ? await getPodcastProgramToplist(30, 0)
          : type === "hours"
            ? await getPodcastProgramHoursToplist(30)
            : await getPodcastTodayPreferred(0);
      if (request !== programRankingRequestRef.current) return;
      setProgramRanks(next);
    } catch {
      if (request !== programRankingRequestRef.current) return;
      setProgramRanks([]);
    } finally {
      if (request === programRankingRequestRef.current)
        setProgramRankingLoading(false);
    }
  };

  const loadPaidRadios = async () => {
    setPaidLoading(true);
    try {
      setPaidRadios(await getPodcastPaidRadios(30, 0));
    } catch {
      setPaidRadios([]);
    } finally {
      setPaidLoading(false);
    }
  };

  return (
    <Page>
      <PageHeader
        title="播客与电台"
        subtitle="精选节目、声音内容和已订阅电台"
        actions={
          <button
            className="btn"
            onClick={() => void loadCategory(categoryId)}
            disabled={discoveryLoading}
          >
            <RefreshCw size={15} /> 刷新
          </button>
        }
      />
      <div
        className="podcast-category-strip"
        role="tablist"
        aria-label="播客分类"
      >
        <button
          className={!categoryId ? "active" : ""}
          onClick={() => void loadCategory(0)}
        >
          精选
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            className={categoryId === category.id ? "active" : ""}
            onClick={() => void loadCategory(category.id)}
          >
            {category.name}
          </button>
        ))}
      </div>
      {excludeHotCategories.length > 0 && (
        <div className="podcast-category-strip" aria-label="更多播客分类">
          {excludeHotCategories.slice(0, 12).map((category) => (
            <span key={category.id}>{category.name}</span>
          ))}
        </div>
      )}
      {categoryId > 0 && (
        <section className="content-section">
          <div className="list-header">
            <h3>分类精选</h3>
            <span className="count">{categoryRadios.length} 个</span>
          </div>
          {discoveryLoading ? (
            <LoadingState label="正在加载分类电台…" />
          ) : (
            <RadioGrid radios={categoryRadios} />
          )}
        </section>
      )}
      {!categoryId && hotRadios.length > 0 && (
        <section className="content-section">
          <div className="list-header">
            <h3>热门电台</h3>
            <span className="count">{hotRadios.length} 个</span>
          </div>
          <RadioGrid radios={hotRadios} />
        </section>
      )}
      {homeCategoryRadios.length > 0 && (
        <section className="content-section">
          <div className="list-header">
            <h3>分类推荐</h3>
            <span className="count">{homeCategoryRadios.length} 个</span>
          </div>
          <RadioGrid radios={homeCategoryRadios} />
        </section>
      )}
      {legacyHotRadios.length > 0 && (
        <section className="content-section">
          <div className="list-header">
            <h3>热门声音</h3>
            <span className="count">{legacyHotRadios.length} 个</span>
          </div>
          <RadioGrid radios={legacyHotRadios} />
        </section>
      )}
      <div className="collection-tabs" role="tablist" aria-label="播客榜单">
        <button
          className={ranking === "new" ? "active" : ""}
          onClick={() => void loadRanking("new")}
        >
          新晋电台榜
        </button>
        <button
          className={ranking === "hot" ? "active" : ""}
          onClick={() => void loadRanking("hot")}
        >
          热门电台榜
        </button>
        <button
          className={ranking === "hours" ? "active" : ""}
          onClick={() => void loadRanking("hours")}
        >
          24 小时主播榜
        </button>
        <button
          className={ranking === "popular" ? "active" : ""}
          onClick={() => void loadRanking("popular")}
        >
          最热主播榜
        </button>
        <button
          className={ranking === "newcomer" ? "active" : ""}
          onClick={() => void loadRanking("newcomer")}
        >
          主播新人榜
        </button>
        <button
          className={ranking === "pay" ? "active" : ""}
          onClick={() => void loadRanking("pay")}
        >
          付费精品榜
        </button>
      </div>
      {ranking && (
        <section className="content-section">
          <div className="list-header">
            <h3>
              {ranking === "new"
                ? "新晋电台榜"
                : ranking === "hot"
                  ? "热门电台榜"
                  : ranking === "hours"
                    ? "24 小时主播榜"
                    : ranking === "popular"
                      ? "最热主播榜"
                      : ranking === "newcomer"
                        ? "主播新人榜"
                        : "付费精品榜"}
            </h3>
            <span className="count">{ranked.length} 个</span>
          </div>
          {rankingLoading ? (
            <LoadingState label="正在加载播客榜单…" />
          ) : (
            <RadioGrid radios={ranked} />
          )}
        </section>
      )}
      <div className="collection-tabs" role="tablist" aria-label="播客节目榜">
        <button
          className={programRanking === "top" ? "active" : ""}
          onClick={() => void loadProgramRanking("top")}
        >
          节目榜
        </button>
        <button
          className={programRanking === "hours" ? "active" : ""}
          onClick={() => void loadProgramRanking("hours")}
        >
          24 小时节目榜
        </button>
        <button
          className={programRanking === "today" ? "active" : ""}
          onClick={() => void loadProgramRanking("today")}
        >
          今日优选
        </button>
      </div>
      {programRanking && (
        <section className="content-section">
          <div className="list-header">
            <h3>
              {programRanking === "top"
                ? "节目榜"
                : programRanking === "hours"
                  ? "24 小时节目榜"
                  : "今日优选"}
            </h3>
            <span className="count">{programRanks.length} 条</span>
          </div>
          <ProgramRankGrid
            items={programRanks}
            loading={programRankingLoading}
          />
        </section>
      )}
      {personalizedPrograms.length > 0 && (
        <section className="content-section">
          <div className="list-header">
            <h3>推荐节目</h3>
            <span className="count">{personalizedPrograms.length} 条</span>
          </div>
          <ProgramRankGrid
            items={personalizedPrograms.slice(0, 12)}
            loading={false}
          />
        </section>
      )}
      <section className="content-section podcast-paid-section">
        <div className="list-header">
          <h3>付费精品电台</h3>
          <button
            className="btn"
            onClick={() => void loadPaidRadios()}
            disabled={paidLoading}
          >
            <RefreshCw size={15} className={paidLoading ? "spin" : ""} />{" "}
            {paidRadios.length ? "刷新" : "查看"}
          </button>
        </div>
        {paidLoading ? (
          <LoadingState label="正在加载付费电台…" />
        ) : paidRadios.length ? (
          <RadioGrid radios={paidRadios} />
        ) : (
          <div className="empty">点击查看付费精品电台</div>
        )}
      </section>
      {subscribed.length > 0 && (
        <section className="content-section">
          <div className="list-header">
            <h3>我的订阅</h3>
            <span className="count">{subscribed.length} 个</span>
          </div>
          <RadioGrid radios={subscribed} />
        </section>
      )}
      <section className="content-section">
        <div className="list-header">
          <h3>精选推荐</h3>
          <span className="count">{radios.length} 个</span>
        </div>
        {radios.length ? (
          <RadioGrid radios={radios} />
        ) : loading ? (
          <LoadingState label="正在加载播客与电台…" />
        ) : (
          <div className="empty">暂无推荐电台</div>
        )}
      </section>
    </Page>
  );
}
