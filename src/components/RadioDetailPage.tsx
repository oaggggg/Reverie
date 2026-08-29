import {
  Heart,
  MessageCircle,
  Radio,
} from "lucide-react";
import { useExploreStore } from "../store/exploreStore";
import { useCommentStore } from "../store/commentStore";
import { sizedImage } from "../utils/image";
import { LoadingState, Page } from "./Page";
import SongList from "./SongList";
import BackButton from "./BackButton";

export default function RadioDetailPage() {
  const radio = useExploreStore((s) => s.currentRadio);
  const programs = useExploreStore((s) => s.radioPrograms);
  const loading = useExploreStore((s) => s.loading);
  const toggleSubscription = useExploreStore((s) => s.toggleRadioSubscription);
  const openComments = useCommentStore((s) => s.openResourceComments);

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
          <SongList
            songs={programs}
            title="节目列表"
            emptyText="暂无节目"
          />
        </>
      )}
    </Page>
  );
}
