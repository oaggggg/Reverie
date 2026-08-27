import { useEffect, useState } from "react";
import { Heart, Radio, RefreshCw } from "lucide-react";
import type { BroadcastCategory, RadioInfo } from "../api/types";
import { getPodcastCategories, getPodcastCategoryRecommendations, getPodcastHotRadios } from "../api/broadcast";
import { useExploreStore } from "../store/exploreStore";
import { sizedImage } from "../utils/image";
import { LoadingState, Page, PageHeader } from "./Page";

function PodcastGrid({ radios }: { radios: RadioInfo[] }) {
  const openRadio = useExploreStore((s) => s.openRadio);
  const toggle = useExploreStore((s) => s.toggleRadioSubscription);
  return <div className="media-grid podcast-grid">{radios.map((radio) => <article className="media-card podcast-card" key={radio.id} onClick={() => void openRadio(radio.id)}><div className="card-cover"><img src={sizedImage(radio.picUrl, 360)} alt="" loading="lazy" /><button className={`media-favorite ${radio.subscribed ? "active" : ""}`} title={radio.subscribed ? "取消订阅" : "订阅播客"} onClick={(e) => { e.stopPropagation(); void toggle(radio); }}><Heart size={15} fill={radio.subscribed ? "currentColor" : "none"} /></button></div><strong>{radio.name}</strong><span>{radio.category || radio.djName || `${radio.programCount} 期节目`}</span></article>)}</div>;
}

export default function RadioPage() {
  const recommended = useExploreStore((s) => s.radios);
  const subscribed = useExploreStore((s) => s.subscribedRadios);
  const loading = useExploreStore((s) => s.loading);
  const loadRadios = useExploreStore((s) => s.loadRadios);
  const [categories, setCategories] = useState<BroadcastCategory[]>([]);
  const [hot, setHot] = useState<RadioInfo[]>([]);
  const [categoryId, setCategoryId] = useState(0);
  const [categoryItems, setCategoryItems] = useState<RadioInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const loadBase = async () => { setBusy(true); try { const [cats, hotItems] = await Promise.all([getPodcastCategories(), getPodcastHotRadios()]); setCategories(cats); setHot(hotItems); } finally { setBusy(false); } };
  useEffect(() => { void loadRadios(); void loadBase(); }, [loadRadios]);
  const selectCategory = async (id: number) => { setCategoryId(id); if (!id) return; setBusy(true); try { setCategoryItems(await getPodcastCategoryRecommendations(id)); } finally { setBusy(false); } };
  const refresh = async () => { await loadRadios(); await loadBase(); if (categoryId) await selectCategory(categoryId); };
  const featured = categoryId ? categoryItems : (hot.length ? hot : recommended);
  return <Page><PageHeader title="播客" subtitle="发现和收听播客节目" actions={<button className="btn" onClick={() => void refresh()} disabled={busy}><RefreshCw size={15} className={busy ? "spin" : ""} /> 刷新</button>} /><main className="podcast-page"><nav className="podcast-category-strip" role="tablist"><button className={!categoryId ? "active" : ""} onClick={() => setCategoryId(0)}><Radio size={14} /> 精选</button>{categories.map((category) => <button key={category.id} className={categoryId === category.id ? "active" : ""} onClick={() => void selectCategory(category.id)}>{category.name}</button>)}</nav><section className="content-section podcast-section"><div className="list-header"><h3>{categoryId ? "分类播客" : "精选播客"}</h3><span className="count">{featured.length} 个</span></div>{busy ? <LoadingState label="正在加载播客…" /> : featured.length ? <PodcastGrid radios={featured} /> : loading ? <LoadingState label="正在加载播客…" /> : <div className="empty">暂无播客内容</div>}</section>{subscribed.length > 0 && <section className="content-section podcast-section"><div className="list-header"><h3>我的订阅</h3><span className="count">{subscribed.length} 个</span></div><PodcastGrid radios={subscribed} /></section>}</main></Page>;
}
