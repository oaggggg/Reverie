import { useEffect } from "react";
import {
  CalendarDays,
  Clock3,
  Headphones,
  RefreshCw,
  Trophy,
} from "lucide-react";
import { useListenReportsStore } from "../store/listenReportsStore.ts";
import { LoadingState, Page, PageHeader } from "./Page";

type Period = "week" | "month" | "year";

const PERIODS: Array<{ id: Period; label: string }> = [
  { id: "week", label: "本周" },
  { id: "month", label: "本月" },
  { id: "year", label: "本年" },
];

function annualEntries(value: unknown): Array<[string, string]> {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const nested =
    source.data &&
    typeof source.data === "object" &&
    !Array.isArray(source.data)
      ? (source.data as Record<string, unknown>)
      : source;
  return Object.entries(nested)
    .filter(([, item]) => ["string", "number", "boolean"].includes(typeof item))
    .slice(0, 8)
    .map(([key, item]) => [key, String(item)]);
}

export default function ListenReportsPage() {
  const period = useListenReportsStore((s) => s.period);
  const total = useListenReportsStore((s) => s.total);
  const report = useListenReportsStore((s) => s.report);
  const today = useListenReportsStore((s) => s.today);
  const timeMachine = useListenReportsStore((s) => s.timeMachine);
  const annual = useListenReportsStore((s) => s.annual);
  const loading = useListenReportsStore((s) => s.loading);
  const error = useListenReportsStore((s) => s.error);
  const load = useListenReportsStore((s) => s.load);
  useEffect(() => {
    void load();
  }, [load]);
  const minutes = Math.round(
    (total?.duration ?? report?.duration ?? 0) / 60000,
  );
  return (
    <Page>
      <PageHeader
        title="听歌报告"
        subtitle="今日、近期与年度听歌数据"
        actions={
          <div className="page-action-row">
            <div
              className="segmented-control"
              role="tablist"
              aria-label="报告周期"
            >
              {PERIODS.map((item) => (
                <button
                  key={item.id}
                  role="tab"
                  aria-selected={period === item.id}
                  className={period === item.id ? "active" : ""}
                  onClick={() => void load(item.id)}
                  disabled={loading}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button
              className="icon-button"
              title="刷新"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw size={17} className={loading ? "spin" : ""} />
            </button>
          </div>
        }
      />
      {loading && !total ? (
        <LoadingState label="正在加载听歌报告…" />
      ) : (
        <>
          <div className="listen-report-summary">
            <div>
              <Clock3 size={17} />
              <span>累计时长</span>
              <strong>{minutes.toLocaleString("zh-CN")} 分钟</strong>
            </div>
            <div>
              <Headphones size={17} />
              <span>累计歌曲</span>
              <strong>
                {(total?.songCount ?? report?.songCount ?? 0).toLocaleString(
                  "zh-CN",
                )}
              </strong>
            </div>
            <div>
              <CalendarDays size={17} />
              <span>近期播放</span>
              <strong>
                {(report?.playCount ?? 0).toLocaleString("zh-CN")} 次
              </strong>
            </div>
          </div>
          <section className="listen-report-section">
            <div className="listen-report-head">
              <h2>今日播放排行</h2>
              <span>{today.length} 首</span>
            </div>
            {today.map((song) => (
              <div className="listen-report-row" key={song.id}>
                <strong>{song.name}</strong>
                <span>{song.artists}</span>
                <b>{song.count} 次</b>
              </div>
            ))}
          </section>
          {period === "year" && annual && (
            <section className="listen-report-section">
              <div className="listen-report-head">
                <h2>年度报告详情</h2>
                <span>{new Date().getFullYear()} 年</span>
              </div>
              {annualEntries(annual).length ? (
                annualEntries(annual).map(([key, value]) => (
                  <div className="listen-report-row" key={key}>
                    <strong>{key}</strong>
                    <span />
                    <b>{value}</b>
                  </div>
                ))
              ) : (
                <div className="empty">年度报告暂无可展示的摘要</div>
              )}
            </section>
          )}
          <section className="listen-report-section">
            <div className="listen-report-head">
              <h2>
                <Trophy size={16} />
                会员时光机
              </h2>
              <span>{timeMachine.length} 条</span>
            </div>
            {timeMachine.map((item, index) => (
              <div className="listen-report-row" key={`${item.date}-${index}`}>
                <strong>{item.songName}</strong>
                <span>
                  {item.artistName} · {item.date}
                </span>
                <b>{item.count} 次</b>
              </div>
            ))}
          </section>
        </>
      )}
      {error && (
        <div className="listen-report-error" role="alert">
          {error}
        </div>
      )}
    </Page>
  );
}
