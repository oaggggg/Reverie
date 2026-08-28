import { useEffect } from "react";
import { Play, RefreshCw } from "lucide-react";
import { useChartStore } from "../store/chartStore";
import { usePlayerStore } from "../store/playerStore";
import { sizedImage } from "../utils/image";
import { Page, PageHeader } from "./Page";
import BackButton from "./BackButton";
import SongList from "./SongList";

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

  // 榜单目录就绪后并发拉取各卡片歌曲：本地 sidecar 并发无压力，
  // 接口层已有缓存与去重；旧的 250ms 错峰让最后一张卡晚 1.75s 才开始
  useEffect(() => {
    if (!charts.length) return;
    charts.slice(0, MAX_CARDS).forEach((chart) => {
      void loadCard(chart.id);
    });
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
  const refreshCharts = () => {
    if (selectedId) return;
    void load();
  };

  return (
    <Page>
      <PageHeader
        title="排行榜"
        subtitle="官方榜单 · 每天更新"
        actions={
          !selectedChart ? (
            <button
              className="icon-btn"
              title="刷新榜单"
              aria-label="刷新榜单"
              onClick={refreshCharts}
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? "spin" : ""} />
            </button>
          ) : null
        }
      />
      {selectedChart ? (
        <section className="chart-detail">
          {/* 与歌单/专辑/电台详情页统一的 detail-hero 布局 */}
          <BackButton onClick={() => void select(0)} />
          <section
            className={`detail-hero${selectedChart.coverUrl ? "" : " no-cover"}`}
            aria-label="榜单信息"
          >
            {selectedChart.coverUrl ? (
              <img
                className="detail-cover"
                src={sizedImage(selectedChart.coverUrl, 480)}
                alt=""
              />
            ) : null}
            <div className="detail-copy">
              <span className="detail-kind">官方榜单</span>
              <h1>{selectedChart.name}</h1>
              <p>
                {selectedChart.description ||
                  selectedChart.updateFrequency ||
                  "官方榜单"}
              </p>
              <div className="detail-meta">
                {selectedChart.trackCount > 0 && (
                  <span>{selectedChart.trackCount} 首</span>
                )}
                {selectedChart.updateFrequency && (
                  <span>{selectedChart.updateFrequency}</span>
                )}
              </div>
              <div className="detail-actions">
                <button
                  className="btn primary"
                  onClick={() =>
                    detailSongs.length && playSong(detailSongs[0]!, detailSongs)
                  }
                  disabled={!detailSongs.length}
                >
                  <Play size={15} /> 播放全部
                </button>
              </div>
            </div>
          </section>
          <div className="chart-detail-songs">
            <SongList
              songs={detailSongs}
              title="榜单歌曲"
              loading={songsLoading}
              emptyText="暂无歌曲"
              showCover
            />
          </div>
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
