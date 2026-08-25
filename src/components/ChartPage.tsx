import { useEffect } from "react";
import { ArrowLeft, Play } from "lucide-react";
import { useChartStore } from "../store/chartStore";
import { usePlayerStore } from "../store/playerStore";
import { sizedImage } from "../utils/image";
import { Page, PageHeader } from "./Page";

/** 卡片网格里最多展示多少个官方榜单 */
const MAX_CARDS = 8;
/** 每张卡片预览的歌曲行数 */
const PREVIEW_ROWS = 5;

export default function ChartPage() {
  const charts = useChartStore((s) => s.charts);
  const loading = useChartStore((s) => s.loading);
  const cardSongs = useChartStore((s) => s.cardSongs);
  const cardLoading = useChartStore((s) => s.cardLoading);
  const selectedId = useChartStore((s) => s.selectedId);
  const detailSongs = useChartStore((s) => s.songs);
  const songsLoading = useChartStore((s) => s.songsLoading);
  const load = useChartStore((s) => s.load);
  const loadCard = useChartStore((s) => s.loadCard);
  const select = useChartStore((s) => s.select);
  const playSong = usePlayerStore((s) => s.playSong);

  useEffect(() => {
    if (!charts.length) void load();
  }, [charts.length, load]);

  // 榜单目录就绪后错峰拉取各卡片歌曲，避免瞬时并发
  useEffect(() => {
    if (!charts.length) return;
    let cancelled = false;
    charts.slice(0, MAX_CARDS).forEach((chart, index) => {
      setTimeout(() => {
        if (!cancelled) void loadCard(chart.id);
      }, index * 250);
    });
    return () => {
      cancelled = true;
    };
  }, [charts, loadCard]);

  const playChart = async (id: number) => {
    const cached = cardSongs[id];
    if (cached?.length) {
      playSong(cached[0]!, cached);
      return;
    }
    await loadCard(id);
    const songs = useChartStore.getState().cardSongs[id] ?? [];
    if (songs.length) playSong(songs[0]!, songs);
    else usePlayerStore.getState().toast("榜单暂无歌曲", "info");
  };
  const selectedChart = charts.find((chart) => chart.id === selectedId);

  return (
    <Page>
      <PageHeader title="排行榜" subtitle="官方榜单 · 每天更新" />
      {selectedChart ? (
        <section className="chart-detail">
          <div className="chart-detail-head">
            <button
              className="icon-button"
              title="返回榜单目录"
              onClick={() => void select(0)}
            >
              <ArrowLeft size={17} />
            </button>
            {selectedChart.coverUrl ? (
              <img src={sizedImage(selectedChart.coverUrl, 180)} alt="" />
            ) : null}
            <div>
              <h2>{selectedChart.name}</h2>
              <p>
                {selectedChart.description ||
                  selectedChart.updateFrequency ||
                  "官方榜单"}
              </p>
            </div>
            <button
              className="btn primary"
              onClick={() =>
                detailSongs.length && playSong(detailSongs[0]!, detailSongs)
              }
            >
              <Play size={15} /> 播放全部
            </button>
          </div>
          {songsLoading ? (
            <div className="loading-hint">正在加载榜单歌曲…</div>
          ) : detailSongs.length ? (
            <ol className="chart-detail-list">
              {detailSongs.map((song, index) => (
                <li key={song.id} onClick={() => playSong(song, detailSongs)}>
                  <b>{index + 1}</b>
                  <span>{song.name}</span>
                  <small>{song.artists}</small>
                </li>
              ))}
            </ol>
          ) : (
            <div className="empty">暂无歌曲</div>
          )}
        </section>
      ) : loading && !charts.length ? (
        <div className="loading-hint">正在加载榜单…</div>
      ) : charts.length ? (
        <div className="chart-card-grid">
          {charts.slice(0, MAX_CARDS).map((chart) => {
            const songs = cardSongs[chart.id] ?? [];
            const isLoading = cardLoading[chart.id] ?? false;
            return (
              <section
                className="chart-card"
                key={chart.id}
                title={chart.description || chart.name}
              >
                <header className="chart-card-head">
                  {chart.coverUrl ? (
                    <button
                      className="chart-cover-button"
                      title="查看详细榜单"
                      onClick={() => void select(chart.id)}
                    >
                      <img
                        src={sizedImage(chart.coverUrl, 160)}
                        alt=""
                        loading="lazy"
                      />
                    </button>
                  ) : null}
                  <div className="chart-card-title">
                    <h3>{chart.name}</h3>
                    {chart.updateFrequency ? (
                      <small>{chart.updateFrequency}</small>
                    ) : null}
                  </div>
                  <button
                    className="icon-btn"
                    title={`播放全部${chart.trackCount ? `（${chart.trackCount} 首）` : ""}`}
                    onClick={() => void playChart(chart.id)}
                    disabled={isLoading && !songs.length}
                  >
                    <Play size={16} fill="currentColor" />
                  </button>
                </header>
                {isLoading && !songs.length ? (
                  <div className="chart-card-loading">加载中…</div>
                ) : songs.length ? (
                  <ol className="chart-card-list">
                    {songs.slice(0, PREVIEW_ROWS).map((song, index) => (
                      <li
                        key={song.id}
                        onClick={() => playSong(song, songs)}
                        title={`${song.name} · ${song.artists}`}
                      >
                        <b className={index < 3 ? "top" : ""}>{index + 1}</b>
                        <span className="t">{song.name}</span>
                        <span className="a">{song.artists}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="chart-card-loading">暂无歌曲</div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="empty">暂无榜单数据</div>
      )}
    </Page>
  );
}
