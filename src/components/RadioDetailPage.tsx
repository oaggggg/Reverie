import {
  CalendarDays,
  Clock3,
  Heart,
  MessageCircle,
  Radio,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  getPodcastProgramDetail,
  getPodcastSubscribers,
} from "../api/broadcast.ts";
import type {
  PodcastProgramDetail,
  PodcastSubscriber,
  Song,
} from "../api/types.ts";
import { useExploreStore } from "../store/exploreStore";
import { useCommentStore } from "../store/commentStore";
import { usePlayerStore } from "../store/playerStore";
import { sizedImage } from "../utils/image";
import { LoadingState, Page } from "./Page";
import SongList from "./SongList";
import BackButton from "./BackButton";
import { useModalBehavior } from "../utils/modalBehavior";

export default function RadioDetailPage() {
  const radio = useExploreStore((s) => s.currentRadio);
  const programs = useExploreStore((s) => s.radioPrograms);
  const loading = useExploreStore((s) => s.loading);
  const toggleSubscription = useExploreStore((s) => s.toggleRadioSubscription);
  const openComments = useCommentStore((s) => s.openResourceComments);
  const [program, setProgram] = useState<PodcastProgramDetail | null>(null);
  const [programLoading, setProgramLoading] = useState(false);
  const [programError, setProgramError] = useState("");
  const programSurfaceRef = useRef<HTMLElement>(null);
  const [subscribers, setSubscribers] = useState<PodcastSubscriber[]>([]);
  const [subscriberTotal, setSubscriberTotal] = useState(0);
  const [subscribersLoading, setSubscribersLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!radio?.id) {
      setSubscribers([]);
      setSubscriberTotal(0);
      return;
    }
    setSubscribersLoading(true);
    void getPodcastSubscribers(radio.id, -1, 20)
      .then((result) => {
        if (!alive) return;
        setSubscribers(result.subscribers);
        setSubscriberTotal(result.total);
      })
      .catch(() => {
        if (!alive) return;
        setSubscribers([]);
        setSubscriberTotal(0);
      })
      .finally(() => {
        if (alive) setSubscribersLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [radio?.id]);

  const openProgram = async (song: Song) => {
    if (!song.programId) return;
    setProgram(null);
    setProgramLoading(true);
    setProgramError("");
    try {
      setProgram(await getPodcastProgramDetail(song.programId));
    } catch (cause) {
      setProgramError(
        cause instanceof Error ? cause.message : "节目详情加载失败",
      );
    } finally {
      setProgramLoading(false);
    }
  };

  const closeProgram = () => {
    if (programLoading) return;
    setProgram(null);
    setProgramError("");
  };
  const programOpen =
    programLoading || Boolean(program) || Boolean(programError);
  useModalBehavior(programOpen, programSurfaceRef, closeProgram);

  return (
    <Page>
      {!radio ? (
        loading ? (
          <LoadingState label="正在加载播客详情…" />
        ) : (
          <div className="empty">播客不存在</div>
        )
      ) : (
        <>
          <BackButton />
          <section className="detail-hero">
            <img
              className="detail-cover"
              src={sizedImage(radio.picUrl, 480)}
              alt=""
            />
            <div className="detail-copy">
              <span className="detail-kind">
                <Radio size={13} /> 电台
              </span>
              <h1>{radio.name}</h1>
              <div className="detail-alias">
                {radio.djName}
                {radio.category ? ` · ${radio.category}` : ""}
              </div>
              <p>{radio.description || "暂无电台介绍"}</p>
              <div className="detail-meta">
                <span>{radio.programCount || programs.length} 期节目</span>
                <span>{radio.subscriberCount} 人订阅</span>
              </div>
              <div className="detail-actions">
                <button
                  className={`btn ${radio.subscribed ? "active" : "primary"}`}
                  onClick={() => void toggleSubscription()}
                >
                  <Heart
                    size={15}
                    fill={radio.subscribed ? "currentColor" : "none"}
                  />
                  {radio.subscribed ? "已订阅" : "订阅电台"}
                </button>
                <button
                  className="btn"
                  onClick={() =>
                    void openComments(
                      {
                        type: "program",
                        id: String(programs[0]?.programId ?? radio.id),
                        title: programs[0]?.name ?? radio.name,
                        subtitle: radio.name,
                        coverUrl: programs[0]?.picUrl ?? radio.picUrl,
                      },
                      true,
                    )
                  }
                  disabled={!programs[0]?.programId}
                >
                  <MessageCircle size={15} /> 节目评论
                </button>
              </div>
            </div>
          </section>
          <section className="podcast-subscribers-section">
            <div className="list-header">
              <h3>
                <Users size={16} /> 订阅者
              </h3>
              <span className="count">
                {subscriberTotal || subscribers.length} 人
              </span>
            </div>
            {subscribersLoading ? (
              <LoadingState label="正在加载订阅者…" />
            ) : subscribers.length ? (
              <div className="podcast-subscribers-grid">
                {subscribers.map((subscriber) => (
                  <div className="podcast-subscriber" key={subscriber.userId}>
                    {subscriber.avatarUrl ? (
                      <img
                        src={sizedImage(subscriber.avatarUrl, 100)}
                        alt=""
                        loading="lazy"
                      />
                    ) : (
                      <span>
                        <Users size={15} />
                      </span>
                    )}
                    <div>
                      <strong>{subscriber.nickname}</strong>
                      {subscriber.signature && (
                        <small>{subscriber.signature}</small>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty">暂无订阅者数据</div>
            )}
          </section>
          <SongList
            songs={programs}
            title="节目列表"
            emptyText="暂无节目"
            onOpenProgram={(song) => void openProgram(song)}
          />
        </>
      )}
      {programOpen && (
        <div
          className="modal-backdrop podcast-program-backdrop"
          onClick={closeProgram}
        >
          <section
            ref={programSurfaceRef}
            className="podcast-program-dialog"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="节目详情"
          >
            <header className="podcast-program-head">
              <div>
                <span className="detail-kind">
                  <Radio size={13} /> 节目详情
                </span>
                <h2>
                  {program?.name ??
                    (programLoading ? "正在加载节目…" : "节目详情")}
                </h2>
              </div>
              <button
                className="icon-button"
                title="关闭"
                onClick={closeProgram}
                disabled={programLoading}
              >
                <X size={17} />
              </button>
            </header>
            {programLoading ? (
              <LoadingState label="正在加载节目详情…" />
            ) : program ? (
              <div className="podcast-program-content">
                {program.coverUrl && (
                  <img src={sizedImage(program.coverUrl, 480)} alt="" />
                )}
                <div className="podcast-program-copy">
                  <div className="podcast-program-meta">
                    {program.radioName && (
                      <span>
                        <Radio size={13} /> {program.radioName}
                      </span>
                    )}
                    {program.djName && <span>{program.djName}</span>}
                    {program.publishTime > 0 && (
                      <span>
                        <CalendarDays size={13} />{" "}
                        {new Date(program.publishTime).toLocaleDateString(
                          "zh-CN",
                        )}
                      </span>
                    )}
                    {program.duration > 0 && (
                      <span>
                        <Clock3 size={13} />{" "}
                        {Math.round(program.duration / 60000)} 分钟
                      </span>
                    )}
                  </div>
                  <p>{program.description || "暂无节目介绍"}</p>
                  <div className="podcast-program-actions">
                    <button
                      className="btn"
                      onClick={() =>
                        program.song &&
                        usePlayerStore
                          .getState()
                          .playSong(program.song, [program.song])
                      }
                      disabled={!program.song}
                    >
                      播放节目
                    </button>
                    <button
                      className="btn"
                      onClick={() =>
                        void openComments(
                          {
                            type: "program",
                            id: String(program.id),
                            title: program.name,
                            subtitle: program.radioName,
                            coverUrl: program.coverUrl,
                          },
                          true,
                        )
                      }
                    >
                      <MessageCircle size={15} /> 评论
                      {program.commentCount ? ` · ${program.commentCount}` : ""}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="podcast-program-error">
                {programError || "节目详情暂时不可用"}
              </div>
            )}
          </section>
        </div>
      )}
    </Page>
  );
}
