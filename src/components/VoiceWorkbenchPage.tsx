import { useEffect, useRef, useState } from "react";
import {
  FileAudio,
  FileText,
  LoaderCircle,
  Mic2,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  WandSparkles,
} from "lucide-react";
import { useVoiceStore } from "../store/voiceStore.ts";
import { sizedImage } from "../utils/image";
import { LoadingState, Page, PageHeader } from "./Page";
import VoiceDetailDialog from "./VoiceDetailDialog.tsx";

export default function VoiceWorkbenchPage() {
  const lists = useVoiceStore((state) => state.lists);
  const selectedList = useVoiceStore((state) => state.selectedList);
  const voices = useVoiceStore((state) => state.voices);
  const search = useVoiceStore((state) => state.search);
  const loading = useVoiceStore((state) => state.loading);
  const uploading = useVoiceStore((state) => state.uploading);
  const busyId = useVoiceStore((state) => state.busyId);
  const error = useVoiceStore((state) => state.error);
  const activeVoice = useVoiceStore((state) => state.activeVoice);
  const activeLyric = useVoiceStore((state) => state.activeLyric);
  const detailLoading = useVoiceStore((state) => state.detailLoading);
  const loadLists = useVoiceStore((state) => state.loadLists);
  const selectList = useVoiceStore((state) => state.selectList);
  const searchCurrentList = useVoiceStore((state) => state.searchCurrentList);
  const upload = useVoiceStore((state) => state.upload);
  const remove = useVoiceStore((state) => state.remove);
  const transcribe = useVoiceStore((state) => state.transcribe);
  const openDetail = useVoiceStore((state) => state.openDetail);
  const closeDetail = useVoiceStore((state) => state.closeDetail);
  const setSearch = useVoiceStore((state) => state.setSearch);
  const fileRef = useRef<HTMLInputElement>(null);
  const [songName, setSongName] = useState("");

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  const chooseFile = (file: File | undefined) => {
    if (!file) return;
    void upload(file, songName);
    setSongName("");
  };

  return (
    <Page>
      <PageHeader
        title="声音工作台"
        subtitle="管理声音列表、上传音频并提交歌词转写"
        actions={
          <button
            className="icon-button"
            title="刷新列表"
            onClick={() => void loadLists(search)}
          >
            <RefreshCw size={17} />
          </button>
        }
      />
      <div className="voice-workbench-layout">
        <aside className="voice-list-sidebar">
          <div className="voice-sidebar-head">
            <strong>我的声音列表</strong>
            <span>{lists.length}</span>
          </div>
          {loading && !lists.length ? (
            <LoadingState label="加载中…" />
          ) : lists.length ? (
            lists.map((list) => (
              <button
                key={list.id}
                className={`voice-list-item ${selectedList?.id === list.id ? "active" : ""}`}
                onClick={() => void selectList(list)}
              >
                {list.coverUrl ? (
                  <img src={sizedImage(list.coverUrl, 80)} alt="" />
                ) : (
                  <span className="voice-list-placeholder">
                    <Mic2 size={15} />
                  </span>
                )}
                <span>
                  <strong>{list.name}</strong>
                  <small>{list.voiceCount} 条声音</small>
                </span>
              </button>
            ))
          ) : (
            <div className="empty">暂无声音列表</div>
          )}
        </aside>
        <section className="voice-workbench-main">
          <div className="voice-toolbar">
            <div className="voice-search">
              <Search size={15} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void searchCurrentList();
                }}
                placeholder="搜索声音"
              />
            </div>
            <input
              className="voice-name-input"
              value={songName}
              onChange={(event) => setSongName(event.target.value)}
              placeholder="上传名称（可选）"
            />
            <button
              className="primary-button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              <Upload size={16} />
              {uploading ? "上传中…" : "上传声音"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="audio/*"
              hidden
              onChange={(event) => {
                chooseFile(event.target.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
          </div>
          {!selectedList ? (
            <div className="voice-empty-panel">
              <FileAudio size={24} />
              <strong>选择声音列表</strong>
              <span>从左侧选择列表后管理声音</span>
            </div>
          ) : loading ? (
            <LoadingState label="正在加载声音…" />
          ) : voices.length ? (
            <div className="voice-items">
              {voices.map((voice) => (
                <article className="voice-item" key={voice.id}>
                  {voice.coverUrl ? (
                    <img src={sizedImage(voice.coverUrl, 100)} alt="" />
                  ) : (
                    <span className="voice-cover-placeholder">
                      <Mic2 size={17} />
                    </span>
                  )}
                  <div className="voice-item-meta">
                    <strong>{voice.name}</strong>
                    <span>{voice.voiceListName || selectedList.name}</span>
                    <small>
                      {voice.playCount.toLocaleString("zh-CN")} 次播放 ·{" "}
                      {voice.status || "未标记状态"}
                    </small>
                  </div>
                  <div className="voice-item-actions">
                    <button
                      className="icon-button"
                      title="查看声音详情"
                      onClick={() => void openDetail(voice)}
                    >
                      <FileText size={16} />
                    </button>
                    <button
                      className="icon-button"
                      title="提交歌词转写"
                      onClick={() => void transcribe(voice)}
                      disabled={busyId === voice.id || voice.transcribed}
                    >
                      <WandSparkles size={16} />
                    </button>
                    <button
                      className="icon-button danger"
                      title="删除声音"
                      onClick={() => void remove(voice.id)}
                      disabled={busyId === voice.id}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {voice.transcribed && (
                    <span className="voice-transcribed">已转写</span>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="voice-empty-panel">
              <LoaderCircle size={22} />
              <span>暂无声音</span>
            </div>
          )}
          {error && (
            <div className="voice-error" role="alert">
              {error}
            </div>
          )}
        </section>
      </div>
      <VoiceDetailDialog
        open={Boolean(activeVoice)}
        voice={activeVoice}
        lyric={activeLyric}
        loading={detailLoading}
        onClose={closeDetail}
      />
    </Page>
  );
}
