import { useExploreStore } from "../store/exploreStore";
import { usePlayerStore } from "../store/playerStore";

/**
 * 以弹窗形式打开歌手 / 专辑详情：只拉取数据、不切换页面视图，
 * 也不关闭任何已打开的弹窗——二级弹窗叠加在一级弹窗之上。
 */
export function openArtistModal(id: number) {
  if (!id) return;
  void useExploreStore.getState().loadArtist(id);
  usePlayerStore.getState().setShowArtistModal(true);
}

export function openAlbumModal(id: number) {
  if (!id) return;
  void useExploreStore.getState().loadAlbum(id);
  usePlayerStore.getState().setShowAlbumModal(true);
}
