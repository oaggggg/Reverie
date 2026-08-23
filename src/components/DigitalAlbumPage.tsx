import { useEffect, useState } from "react";
import {
  Album,
  BarChart3,
  BadgeCheck,
  Coins,
  CreditCard,
  Search,
  ShoppingBag,
} from "lucide-react";
import { useDigitalAlbumStore } from "../store/digitalAlbumStore.ts";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import {
  getDigitalAlbumSalesBoard,
  getDigitalAlbumStyleLibrary,
  type DigitalAlbumSalesPeriod,
  type DigitalAlbumStyleArea,
} from "../api/digitalAlbum.ts";
import type { DigitalAlbum, DigitalAlbumRank } from "../api/types.ts";
import { sizedImage } from "../utils/image";
import { LoadingState, Page, PageHeader } from "./Page";

export default function DigitalAlbumPage() {
  const detail = useDigitalAlbumStore((state) => state.detail);
  const purchased = useDigitalAlbumStore((state) => state.purchased);
  const loading = useDigitalAlbumStore((state) => state.loading);
  const ordering = useDigitalAlbumStore((state) => state.ordering);
  const error = useDigitalAlbumStore((state) => state.error);
  const loadDetail = useDigitalAlbumStore((state) => state.loadDetail);
  const loadPurchased = useDigitalAlbumStore((state) => state.loadPurchased);
  const order = useDigitalAlbumStore((state) => state.order);
  const [id, setId] = useState("");
  const [payment, setPayment] = useState<"balance" | "alipay" | "wxpay">(
    "balance",
  );
  const [boardPeriod, setBoardPeriod] = useState<DigitalAlbumSalesPeriod>("daily");
  const [board, setBoard] = useState<DigitalAlbumRank[]>([]);
  const [boardLoading, setBoardLoading] = useState(false);
  const [styleArea, setStyleArea] = useState<DigitalAlbumStyleArea>("Z_H");
  const [styleAlbums, setStyleAlbums] = useState<DigitalAlbum[]>([]);
  const [styleLoading, setStyleLoading] = useState(false);
  const [styleMore, setStyleMore] = useState(false);
  const styleMoreRef = useInfiniteScroll(
    () => void loadStyleLibrary(styleArea, styleAlbums.length),
    styleLoading || !styleMore,
  );

  const loadBoard = async (period = boardPeriod) => {
    setBoardLoading(true);
    try {
      setBoard(await getDigitalAlbumSalesBoard(period, period === "year" ? new Date().getFullYear() : undefined));
    } catch {
      setBoard([]);
    } finally {
      setBoardLoading(false);
    }
  };

  useEffect(() => {
    void loadPurchased();
    void loadBoard();
  }, [loadPurchased]);

  const loadStyleLibrary = async (area = styleArea, offset = 0) => {
    setStyleLoading(true);
    try {
      const albums = await getDigitalAlbumStyleLibrary(area, 30, offset);
      setStyleAlbums((current) => offset ? [...current, ...albums.filter((item) => !current.some((entry) => entry.id === item.id))] : albums);
      setStyleMore(albums.length >= 30);
    } catch {
      if (!offset) setStyleAlbums([]);
      setStyleMore(false);
    } finally {
      setStyleLoading(false);
    }
  };

  useEffect(() => {
    void loadStyleLibrary(styleArea, 0);
    // The area is the only input that should reload this list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleArea]);

  return (
    <Page>
      <PageHeader
        title="数字专辑"
        subtitle="查看专辑详情、销量与已购内容"
        actions={<ShoppingBag size={18} />}
      />
      <section className="digital-album-search">
        <div className="digital-album-input">
          <Search size={15} />
          <input
            value={id}
            inputMode="numeric"
            onChange={(event) => setId(event.target.value)}
            placeholder="输入数字专辑 ID"
            onKeyDown={(event) => {
              if (event.key === "Enter") void loadDetail(Number(id));
            }}
          />
        </div>
        <button
          className="primary-button"
          onClick={() => void loadDetail(Number(id))}
        >
          <Search size={15} />
          查询
        </button>
      </section>
      <section className="digital-album-board">
        <div className="digital-album-section-head">
          <h2><BarChart3 size={17} /> 销量榜</h2>
          <div className="collection-tabs" role="tablist" aria-label="数字专辑销量周期">
            {(["daily", "week", "year", "total"] as const).map((period) => (
              <button key={period} className={boardPeriod === period ? "active" : ""} onClick={() => { setBoardPeriod(period); void loadBoard(period); }} disabled={boardLoading}>
                {period === "daily" ? "日榜" : period === "week" ? "周榜" : period === "year" ? "年榜" : "总榜"}
              </button>
            ))}
          </div>
        </div>
        {boardLoading ? (
          <LoadingState label="正在加载销量榜…" />
        ) : board.length ? (
          <div className="digital-album-board-grid">
            {board.slice(0, 20).map((album) => (
              <button className="digital-album-board-card" key={album.id} onClick={() => { setId(String(album.id)); void loadDetail(album.id); }}>
                <b>{album.rank}</b>
                {album.coverUrl ? <img src={sizedImage(album.coverUrl, 180)} alt="" /> : <span><Album size={20} /></span>}
                <div><strong>{album.name}</strong><small>{album.artistName || "数字专辑"}</small></div>
                <em>{album.score.toLocaleString("zh-CN")}</em>
              </button>
            ))}
          </div>
        ) : <div className="digital-album-empty">暂无销量榜数据</div>}
      </section>
      <section className="digital-album-style-library">
        <div className="digital-album-section-head">
          <h2><Album size={17} /> 语种风格馆</h2>
          <div className="collection-tabs" role="tablist" aria-label="数字专辑语种">
            {([
              ["Z_H", "华语"],
              ["E_A", "欧美"],
              ["KR", "韩国"],
              ["JP", "日本"],
            ] as const).map(([area, label]) => (
              <button key={area} className={styleArea === area ? "active" : ""} onClick={() => setStyleArea(area)} disabled={styleLoading}>{label}</button>
            ))}
          </div>
        </div>
        {styleLoading && !styleAlbums.length ? (
          <LoadingState label="正在加载风格馆…" />
        ) : styleAlbums.length ? (
          <div className="digital-album-grid">
            {styleAlbums.map((album) => (
              <button className="digital-album-card" key={album.id} onClick={() => { setId(String(album.id)); void loadDetail(album.id); }}>
                {album.coverUrl ? <img src={sizedImage(album.coverUrl, 180)} alt="" /> : <span><Album size={24} /></span>}
                <strong>{album.name}</strong>
                <small>{album.artistName || "数字专辑"}</small>
              </button>
            ))}
          </div>
        ) : <div className="digital-album-empty">暂无该语种的数字专辑</div>}
        {styleMore && <div ref={styleMoreRef} className="load-more-sentinel" />}
      </section>
      {detail && (
        <section className="digital-album-detail">
          <div className="digital-album-hero">
            {detail.coverUrl ? (
              <img src={sizedImage(detail.coverUrl, 360)} alt="" />
            ) : (
              <span>
                <Album size={36} />
              </span>
            )}
            <div>
              <h2>{detail.name}</h2>
              <p>{detail.artistName || "未知艺术家"}</p>
              <div className="digital-album-stats">
                <span>
                  <Coins size={14} />¥{detail.price.toFixed(2)}
                </span>
                <span>
                  <BadgeCheck size={14} />
                  {detail.sales.toLocaleString("zh-CN")} 份
                </span>
              </div>
            </div>
          </div>
          <p className="digital-album-description">
            {detail.description || "暂无专辑介绍"}
          </p>
          {detail.purchased ? (
            <div className="digital-album-owned">
              <BadgeCheck size={16} />
              已购买
            </div>
          ) : (
            <div className="digital-album-order">
              <select
                value={payment}
                onChange={(event) =>
                  setPayment(event.target.value as typeof payment)
                }
              >
                <option value="balance">云贝/余额</option>
                <option value="alipay">支付宝</option>
                <option value="wxpay">微信支付</option>
              </select>
              <button
                className="primary-button"
                onClick={() => void order(payment)}
                disabled={ordering}
              >
                <CreditCard size={15} />
                {ordering ? "提交中…" : "购买"}
              </button>
            </div>
          )}
        </section>
      )}
      <section className="digital-album-purchased">
        <div className="digital-album-section-head">
          <h2>我的已购专辑</h2>
          <span>{purchased.length} 张</span>
        </div>
        {loading && !purchased.length ? (
          <LoadingState label="正在加载已购专辑…" />
        ) : purchased.length ? (
          <div className="digital-album-grid">
            {purchased.map((album) => (
              <button
                className="digital-album-card"
                key={album.id}
                onClick={() => {
                  setId(String(album.id));
                  void loadDetail(album.id);
                }}
              >
                {album.coverUrl ? (
                  <img src={sizedImage(album.coverUrl, 180)} alt="" />
                ) : (
                  <span>
                    <Album size={24} />
                  </span>
                )}
                <strong>{album.name}</strong>
                <small>{album.artistName}</small>
              </button>
            ))}
          </div>
        ) : (
          <div className="digital-album-empty">暂无已购数字专辑</div>
        )}
      </section>
      {error && (
        <div className="digital-album-error" role="alert">
          {error}
        </div>
      )}
    </Page>
  );
}
