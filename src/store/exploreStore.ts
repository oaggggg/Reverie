import { create } from "zustand";
import {
  createPlaylist as apiCreatePlaylist,
  deletePlaylist as apiDeletePlaylist,
  deleteSongComment,
  followUser,
  likeEvent,
  forwardEvent,
  getAlbum,
  getArtist,
  getEvents,
  getFollowers,
  getFollows,
  getRadioDetail,
  getRadioHome,
  getSongComments,
  getMixedFollows,
  getMutualFollow,
  type FollowScene,
  getUserEvents,
  deleteEvent as apiDeleteEvent,
  likeSongComment,
  sendSongComment,
  subscribeAlbum,
  subscribeArtist,
  subscribePlaylist,
  subscribeRadio,
  updatePlaylistBatch as apiUpdatePlaylistBatch,
  publishPlaylist as apiPublishPlaylist,
} from "../api/extended";
import type {
  AlbumInfo,
  ArtistInfo,
  CommentInfo,
  PlaylistInfo,
  RadioInfo,
  SocialEvent,
  SocialUser,
  Song,
  SearchMediaInfo,
} from "../api/types";
import { usePlayerStore } from "./playerStore";

type CommentSort = "hot" | "new";
type SocialTab = "events" | "myEvents" | "follows" | "followers";

interface ExploreState {
  loading: boolean;
  album: AlbumInfo | null;
  albumSongs: Song[];
  artist: ArtistInfo | null;
  artistSongs: Song[];
  artistAlbums: AlbumInfo[];
  artistVideos: SearchMediaInfo[];
  commentSong: Song | null;
  comments: CommentInfo[];
  commentTotal: number;
  commentPage: number;
  commentHasMore: boolean;
  commentSort: CommentSort;
  radios: RadioInfo[];
  subscribedRadios: RadioInfo[];
  currentRadio: RadioInfo | null;
  radioPrograms: Song[];
  socialTab: SocialTab;
  follows: SocialUser[];
  followers: SocialUser[];
  events: SocialEvent[];
  myEvents: SocialEvent[];
  followScene: FollowScene;
  mutualFollow: Record<number, boolean | undefined>;

  openAlbum: (id: number) => Promise<void>;
  toggleAlbumSubscription: () => Promise<void>;
  openArtist: (id: number) => Promise<void>;
  toggleArtistSubscription: () => Promise<void>;
  openComments: (song: Song) => Promise<void>;
  setCommentSort: (sort: CommentSort) => Promise<void>;
  loadMoreComments: () => Promise<void>;
  submitComment: (content: string) => Promise<boolean>;
  toggleCommentLike: (comment: CommentInfo) => Promise<void>;
  removeComment: (comment: CommentInfo) => Promise<void>;
  loadRadios: () => Promise<void>;
  openRadio: (id: number) => Promise<void>;
  toggleRadioSubscription: (radio?: RadioInfo) => Promise<void>;
  setSocialTab: (tab: SocialTab) => void;
  setFollowScene: (scene: FollowScene) => Promise<void>;
  checkMutualFollow: (userId: number) => Promise<boolean>;
  loadSocial: (navigate?: boolean) => Promise<void>;
  toggleFollow: (user: SocialUser) => Promise<void>;
  toggleEventLike: (event: SocialEvent) => Promise<void>;
  forwardEvent: (event: SocialEvent, forwards: string) => Promise<boolean>;
  deleteEvent: (event: SocialEvent) => Promise<boolean>;
  createPlaylist: (name: string, privacy: number) => Promise<boolean>;
  updatePlaylist: (
    playlist: PlaylistInfo,
    name: string,
    description: string,
    tags?: string,
    publishPrivate?: boolean,
  ) => Promise<boolean>;
  deletePlaylist: (playlist: PlaylistInfo) => Promise<boolean>;
  togglePlaylistSubscription: (playlist: PlaylistInfo) => Promise<boolean>;
}

function showView(
  view: "album" | "artist" | "comments" | "radio" | "radioDetail" | "social",
) {
  const player = usePlayerStore.getState();
  const previous = player.activeView;
  player.setPage("browse");
  player.setSearchOpen(false);
  usePlayerStore.setState({
    activeView: view,
    prevView: previous === view ? player.prevView : previous,
  });
}

function toastError(message: string) {
  usePlayerStore.getState().toast(message, "error");
}

export const useExploreStore = create<ExploreState>()((set, get) => ({
  loading: false,
  album: null,
  albumSongs: [],
  artist: null,
  artistSongs: [],
  artistAlbums: [],
  artistVideos: [],
  commentSong: null,
  comments: [],
  commentTotal: 0,
  commentPage: 1,
  commentHasMore: false,
  commentSort: "hot",
  radios: [],
  subscribedRadios: [],
  currentRadio: null,
  radioPrograms: [],
  socialTab: "events",
  follows: [],
  followers: [],
  events: [],
  myEvents: [],
  followScene: 0,
  mutualFollow: {},

  openAlbum: async (id) => {
    if (!id) return;
    showView("album");
    set({ loading: true, album: null, albumSongs: [] });
    try {
      const result = await getAlbum(id);
      set({ album: result.album, albumSongs: result.songs });
    } catch {
      toastError("加载专辑失败");
    } finally {
      set({ loading: false });
    }
  },
  toggleAlbumSubscription: async () => {
    const album = get().album;
    if (!album) return;
    const next = !album.subscribed;
    try {
      await subscribeAlbum(album.id, next);
      set({ album: { ...album, subscribed: next } });
      usePlayerStore
        .getState()
        .toast(next ? "已收藏专辑" : "已取消收藏专辑", "success");
    } catch {
      toastError("专辑收藏操作失败");
    }
  },
  openArtist: async (id) => {
    if (!id) return;
    showView("artist");
    set({
      loading: true,
      artist: null,
      artistSongs: [],
      artistAlbums: [],
      artistVideos: [],
    });
    try {
      const result = await getArtist(id);
      set({
        artist: result.artist,
        artistSongs: result.songs,
        artistAlbums: result.albums,
        artistVideos: result.videos,
      });
    } catch {
      toastError("加载歌手详情失败");
    } finally {
      set({ loading: false });
    }
  },
  toggleArtistSubscription: async () => {
    const artist = get().artist;
    if (!artist) return;
    const next = !artist.followed;
    try {
      await subscribeArtist(artist.id, next);
      set({ artist: { ...artist, followed: next } });
      usePlayerStore
        .getState()
        .toast(next ? "已收藏歌手" : "已取消收藏歌手", "success");
    } catch {
      toastError("歌手收藏操作失败");
    }
  },
  openComments: async (song) => {
    set({
      loading: true,
      commentSong: song,
      comments: [],
      commentPage: 1,
      commentSort: "hot",
      commentHasMore: false,
    });
    try {
      const result = await getSongComments(song.id, 1, 2);
      set({
        comments: result.comments,
        commentTotal: result.total,
        commentHasMore: result.hasMore,
      });
    } catch {
      toastError("加载评论失败");
    } finally {
      set({ loading: false });
    }
  },
  setCommentSort: async (sort) => {
    const song = get().commentSong;
    if (!song || sort === get().commentSort) return;
    set({ loading: true, commentSort: sort, commentPage: 1, comments: [], commentHasMore: false });
    try {
      const result = await getSongComments(song.id, 1, sort === "hot" ? 2 : 3);
      set({
        comments: result.comments,
        commentTotal: result.total,
        commentHasMore: result.hasMore,
      });
    } catch {
      toastError("加载评论失败");
    } finally {
      set({ loading: false });
    }
  },
  loadMoreComments: async () => {
    const { commentSong, commentPage, commentSort, commentHasMore, loading } =
      get();
    if (!commentSong || !commentHasMore || loading) return;
    const nextPage = commentPage + 1;
    set({ loading: true });
    try {
      const result = await getSongComments(
        commentSong.id,
        nextPage,
        commentSort === "hot" ? 2 : 3,
      );
      set((state) => ({
        comments: [...state.comments, ...result.comments],
        commentPage: nextPage,
        commentHasMore: result.hasMore,
      }));
    } catch {
      toastError("加载更多评论失败");
    } finally {
      set({ loading: false });
    }
  },
  submitComment: async (content) => {
    const song = get().commentSong;
    if (!song || !content.trim()) return false;
    try {
      await sendSongComment(song.id, content.trim());
      const result = await getSongComments(
        song.id,
        1,
        get().commentSort === "hot" ? 2 : 3,
      );
      set({
        comments: result.comments,
        commentTotal: result.total,
        commentPage: 1,
      });
      usePlayerStore.getState().toast("评论已发布", "success");
      return true;
    } catch {
      toastError("发布评论失败");
      return false;
    }
  },
  toggleCommentLike: async (comment) => {
    const song = get().commentSong;
    if (!song) return;
    const next = !comment.liked;
    try {
      await likeSongComment(song.id, comment.id, next);
      set((state) => ({
        comments: state.comments.map((item) =>
          item.id === comment.id
            ? {
                ...item,
                liked: next,
                likedCount: Math.max(0, item.likedCount + (next ? 1 : -1)),
              }
            : item,
        ),
      }));
    } catch {
      toastError("评论点赞失败");
    }
  },
  removeComment: async (comment) => {
    const song = get().commentSong;
    if (!song) return;
    try {
      await deleteSongComment(song.id, comment.id);
      set((state) => ({
        comments: state.comments.filter((item) => item.id !== comment.id),
        commentTotal: Math.max(0, state.commentTotal - 1),
      }));
      usePlayerStore.getState().toast("评论已删除", "success");
    } catch {
      toastError("删除评论失败");
    }
  },
  loadRadios: async () => {
    showView("radio");
    set({ loading: true });
    try {
      const result = await getRadioHome();
      const subscribedRadios = result.subscribed.map((radio) => ({
        ...radio,
        subscribed: true,
      }));
      const subscribedIds = new Set(subscribedRadios.map((radio) => radio.id));
      set({
        radios: result.recommended.map((radio) => ({
          ...radio,
          subscribed: radio.subscribed || subscribedIds.has(radio.id),
        })),
        subscribedRadios,
      });
    } catch {
      toastError("加载播客与电台失败");
    } finally {
      set({ loading: false });
    }
  },
  openRadio: async (id) => {
    showView("radioDetail");
    set({ loading: true, currentRadio: null, radioPrograms: [] });
    try {
      const result = await getRadioDetail(id);
      const subscribed = get().subscribedRadios.some(
        (radio) => radio.id === id,
      );
      set({
        currentRadio: {
          ...result.radio,
          subscribed: result.radio.subscribed || subscribed,
        },
        radioPrograms: result.programs,
      });
    } catch {
      toastError("加载电台详情失败");
    } finally {
      set({ loading: false });
    }
  },
  toggleRadioSubscription: async (target) => {
    const radio = target ?? get().currentRadio;
    if (!radio) return;
    const next = !radio.subscribed;
    try {
      await subscribeRadio(radio.id, next);
      set((state) => ({
        currentRadio:
          state.currentRadio?.id === radio.id
            ? { ...state.currentRadio, subscribed: next }
            : state.currentRadio,
        radios: state.radios.map((item) =>
          item.id === radio.id ? { ...item, subscribed: next } : item,
        ),
        subscribedRadios: next
          ? [{ ...radio, subscribed: true }, ...state.subscribedRadios]
          : state.subscribedRadios.filter((item) => item.id !== radio.id),
      }));
      usePlayerStore
        .getState()
        .toast(next ? "已订阅电台" : "已取消订阅电台", "success");
    } catch {
      toastError("电台订阅操作失败");
    }
  },
  setSocialTab: (tab) => set({ socialTab: tab }),
  setFollowScene: async (scene) => {
    if (scene === get().followScene) return;
    set({ followScene: scene });
    await get().loadSocial();
  },
  checkMutualFollow: async (userId) => {
    if (!userId) return false;
    const cached = get().mutualFollow[userId];
    if (cached !== undefined) return cached;
    try {
      const mutual = await getMutualFollow(userId);
      set((state) => ({ mutualFollow: { ...state.mutualFollow, [userId]: mutual } }));
      return mutual;
    } catch {
      toastError("查询互相关注失败");
      return false;
    }
  },
  loadSocial: async (navigate = true) => {
    const uid = usePlayerStore.getState().profile?.userId;
    if (!uid) return;
    if (navigate) showView("social");
    set({ loading: true });
    try {
      const [events, myEvents, mixed, followers] = await Promise.all([
        getEvents(),
        getUserEvents(uid).catch(() => []),
        getMixedFollows(get().followScene).catch(async () => ({
          users: await getFollows(uid),
          cursor: 0,
          more: false,
        })),
        getFollowers(uid),
      ]);
      set({ events, myEvents, follows: mixed.users, followers });
    } catch {
      toastError("加载社交动态失败");
    } finally {
      set({ loading: false });
    }
  },
  toggleFollow: async (user) => {
    const next = !user.followed;
    try {
      await followUser(user.userId, next);
      const update = (items: SocialUser[]) =>
        items.map((item) =>
          item.userId === user.userId ? { ...item, followed: next } : item,
        );
      set((state) => ({
        follows: update(state.follows),
        followers: update(state.followers),
      }));
      usePlayerStore
        .getState()
        .toast(
          next ? `已关注 ${user.nickname}` : `已取消关注 ${user.nickname}`,
          "success",
        );
    } catch {
      toastError("关注操作失败");
    }
  },
  toggleEventLike: async (event) => {
    if (!event.threadId) return;
    const next = !event.liked;
    try {
      await likeEvent(event.id, event.threadId, next);
      set((state) => ({
        events: state.events.map((item) =>
          item.id === event.id
            ? {
                ...item,
                liked: next,
                likedCount: Math.max(0, item.likedCount + (next ? 1 : -1)),
              }
            : item,
        ),
      }));
    } catch {
      toastError("动态点赞操作失败");
    }
  },
  forwardEvent: async (event, forwards) => {
    const uid = usePlayerStore.getState().profile?.userId ?? 0;
    if (!uid || !event.id) return false;
    try {
      await forwardEvent(event.id, uid, forwards);
      usePlayerStore.getState().toast("动态已转发", "success");
      return true;
    } catch {
      toastError("动态转发失败");
      return false;
    }
  },
  deleteEvent: async (event) => {
    if (!event.id) return false;
    try {
      await apiDeleteEvent(event.id);
      set((state) => ({
        events: state.events.filter((item) => item.id !== event.id),
        myEvents: state.myEvents.filter((item) => item.id !== event.id),
      }));
      usePlayerStore.getState().toast("动态已删除", "success");
      return true;
    } catch {
      toastError("删除动态失败");
      return false;
    }
  },
  createPlaylist: async (name, privacy) => {
    try {
      await apiCreatePlaylist(name.trim(), privacy);
      await usePlayerStore.getState().loadUserPlaylists();
      usePlayerStore.getState().toast("歌单已创建", "success");
      return true;
    } catch {
      toastError("创建歌单失败");
      return false;
    }
  },
  updatePlaylist: async (playlist, name, description, tags = "", publishPrivate = false) => {
    try {
      await apiUpdatePlaylistBatch(
        playlist.id,
        name.trim(),
        description.trim(),
        tags.trim(),
      );
      if (publishPrivate && playlist.privacy === 10) {
        await apiPublishPlaylist(playlist.id);
      }
      if (usePlayerStore.getState().playlistId === playlist.id) {
        usePlayerStore.setState({
          playlistName: name.trim(),
          playlistDescription: description.trim(),
        });
      }
      await usePlayerStore.getState().loadUserPlaylists();
      usePlayerStore.getState().toast("歌单已更新", "success");
      return true;
    } catch {
      toastError("更新歌单失败");
      return false;
    }
  },
  deletePlaylist: async (playlist) => {
    try {
      await apiDeletePlaylist(playlist.id);
      if (usePlayerStore.getState().playlistId === playlist.id) {
        usePlayerStore.getState().closePlaylist();
      }
      await usePlayerStore.getState().loadUserPlaylists();
      usePlayerStore.getState().toast("歌单已删除", "success");
      return true;
    } catch {
      toastError("删除歌单失败");
      return false;
    }
  },
  togglePlaylistSubscription: async (playlist) => {
    const next = !playlist.subscribed;
    try {
      await subscribePlaylist(playlist.id, next);
      if (usePlayerStore.getState().playlistId === playlist.id) {
        usePlayerStore.setState({ playlistSubscribed: next });
      }
      await usePlayerStore.getState().loadUserPlaylists();
      usePlayerStore
        .getState()
        .toast(next ? "已收藏歌单" : "已取消收藏歌单", "success");
      return true;
    } catch {
      toastError("歌单收藏操作失败");
      return false;
    }
  },
}));
