import { useEffect, useState } from "react";
import { Flame, RefreshCw, Star } from "lucide-react";
import {
  getHotTopics,
  getSubscribedTopics,
  getTopicDetail,
  getTopicHotEvents,
} from "../api/topic";
import type { TopicEvent, TopicInfo } from "../api/types";
import { usePlayerStore } from "../store/playerStore";
import { sizedImage } from "../utils/image";
import { LoadingState, Page, PageHeader } from "./Page";

type TopicTab = "hot" | "subscribed";

export default function TopicPage() {
  const [tab, setTab] = useState<TopicTab>("hot");
  const [topics, setTopics] = useState<TopicInfo[]>([]);
  const [selected, setSelected] = useState<TopicInfo | null>(null);
  const [events, setEvents] = useState<TopicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const load = tab === "hot" ? getHotTopics() : getSubscribedTopics();
    void load
      .then((items) => {
        if (!alive) return;
        setTopics(items);
        setSelected((current) =>
          current && items.some((item) => item.id === current.id)
            ? current
            : (items[0] ?? null),
        );
      })
      .catch(() => {
        if (alive) usePlayerStore.getState().toast("加载话题失败", "error");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [refreshKey, tab]);

  useEffect(() => {
    let alive = true;
    if (!selected) {
      setEvents([]);
      return;
    }
    setDetailLoading(true);
    void Promise.all([
      getTopicDetail(selected.id),
      getTopicHotEvents(selected.id),
    ])
      .then(([detail, nextEvents]) => {
        if (!alive) return;
        setSelected(detail);
        setEvents(nextEvents);
      })
      .catch(() => {
        if (alive) usePlayerStore.getState().toast("加载话题详情失败", "error");
      })
      .finally(() => {
        if (alive) setDetailLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [selected?.id]);

  return (
    <Page>
      <PageHeader
        title="话题"
        subtitle="浏览热门话题与话题动态"
        actions={
          <button
            className="btn"
            onClick={() => setRefreshKey((value) => value + 1)}
            disabled={loading}
          >
            <RefreshCw size={15} /> 刷新
          </button>
        }
      />
      <div className="topic-tabs" role="tablist" aria-label="话题列表">
        <button
          className={tab === "hot" ? "active" : ""}
          onClick={() => setTab("hot")}
        >
          <Flame size={15} /> 热门话题
        </button>
        <button
          className={tab === "subscribed" ? "active" : ""}
          onClick={() => setTab("subscribed")}
        >
          <Star size={15} /> 我的收藏
        </button>
      </div>
      {loading ? (
        <LoadingState label="正在加载话题…" />
      ) : !topics.length ? (
        <div className="empty">暂无话题</div>
      ) : (
        <div className="topic-layout">
          <div className="topic-list">
            {topics.map((topic) => (
              <button
                key={topic.id}
                className={`topic-card ${selected?.id === topic.id ? "active" : ""}`}
                onClick={() => setSelected(topic)}
              >
                {topic.coverUrl ? (
                  <img src={sizedImage(topic.coverUrl, 180)} alt="" />
                ) : (
                  <span className="topic-cover-ph">
                    <Flame size={20} />
                  </span>
                )}
                <span>
                  <strong>{topic.title}</strong>
                  <small>
                    {topic.participateCount.toLocaleString("zh-CN")} 人参与
                  </small>
                </span>
              </button>
            ))}
          </div>
          <section className="topic-detail">
            {selected && (
              <>
                <header>
                  <h2>{selected.title}</h2>
                  <p>{selected.description || "暂无话题介绍"}</p>
                  <small>
                    {selected.participateCount.toLocaleString("zh-CN")} 人参与 ·{" "}
                    {selected.shareCount.toLocaleString("zh-CN")} 次分享
                  </small>
                </header>
                {detailLoading ? (
                  <LoadingState label="正在加载话题动态…" />
                ) : (
                  <div className="topic-event-list">
                    {events.map((event) => (
                      <article className="topic-event" key={event.id}>
                        <img src={sizedImage(event.creatorAvatar, 72)} alt="" />
                        <div>
                          <strong>{event.creatorName}</strong>
                          <p>{event.text}</p>
                          <small>
                            {event.time
                              ? new Date(event.time).toLocaleString()
                              : ""}{" "}
                            · 赞 {event.likedCount} · 评论 {event.commentCount}
                          </small>
                        </div>
                      </article>
                    ))}
                    {!events.length && (
                      <div className="empty">暂无热门动态</div>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </Page>
  );
}
