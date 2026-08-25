import { create } from "zustand";
import {
  getHotSearchTerms,
  getDefaultSearchKeyword,
  getSearchSuggestions,
  searchContent,
} from "../api/search";
import { followUser } from "../api/extended";
import type {
  SearchCategory,
  SearchResultPage,
  SearchSuggestion,
} from "../api/types";
import { usePlayerStore } from "./playerStore";

const EMPTY_RESULT: SearchResultPage = {
  songs: [],
  albums: [],
  artists: [],
  playlists: [],
  radios: [],
  users: [],
  media: [],
  total: 0,
  hasMore: false,
};

interface SearchState {
  keyword: string;
  category: SearchCategory;
  result: SearchResultPage;
  loading: boolean;
  loadingMore: boolean;
  hotTerms: string[];
  defaultKeyword: string;
  suggestions: SearchSuggestion[];
  suggestionsLoading: boolean;
  openSearch: (keyword: string, category?: SearchCategory) => Promise<void>;
  setCategory: (category: SearchCategory) => Promise<void>;
  loadMore: () => Promise<void>;
  loadHotTerms: () => Promise<void>;
  loadDefaultKeyword: () => Promise<void>;
  loadSuggestions: (keyword: string) => Promise<void>;
  toggleFollow: (userId: number) => Promise<void>;
}

let requestToken = 0;
let suggestionToken = 0;
const PAGE_SIZE = 30;

function mergeResult(
  current: SearchResultPage,
  next: SearchResultPage,
): SearchResultPage {
  return {
    ...next,
    songs: [...current.songs, ...next.songs],
    albums: [...current.albums, ...next.albums],
    artists: [...current.artists, ...next.artists],
    playlists: [...current.playlists, ...next.playlists],
    radios: [...current.radios, ...next.radios],
    users: [...current.users, ...next.users],
    media: [...current.media, ...next.media],
  };
}

function showSearchView() {
  const player = usePlayerStore.getState();
  const previous = player.activeView;
  player.setPage("browse");
  player.setSearchOpen(false);
  usePlayerStore.setState({
    activeView: "search",
    prevView: previous === "search" ? player.prevView : previous,
  });
}

export const useSearchStore = create<SearchState>()((set, get) => ({
  keyword: "",
  category: "songs",
  result: EMPTY_RESULT,
  loading: false,
  loadingMore: false,
  hotTerms: [],
  defaultKeyword: "",
  suggestions: [],
  suggestionsLoading: false,

  openSearch: async (rawKeyword, category = get().category) => {
    const keyword = rawKeyword.trim();
    showSearchView();
    usePlayerStore.setState({ searchKeyword: keyword });
    if (!keyword) {
      set({ keyword: "", category, result: EMPTY_RESULT, loading: false });
      await get().loadHotTerms();
      return;
    }
    const token = ++requestToken;
    set({ keyword, category, result: EMPTY_RESULT, loading: true });
    try {
      const result = await searchContent(keyword, category, PAGE_SIZE, 0);
      if (token !== requestToken) return;
      set({ result, loading: false });
    } catch {
      if (token !== requestToken) return;
      set({ loading: false });
      usePlayerStore.getState().toast("搜索失败，请稍后重试", "error");
    }
  },

  setCategory: async (category) => {
    if (category === get().category) return;
    const keyword = get().keyword;
    if (!keyword) {
      set({ category, result: EMPTY_RESULT });
      return;
    }
    await get().openSearch(keyword, category);
  },

  loadMore: async () => {
    const { keyword, category, result, loading, loadingMore } = get();
    if (!keyword || !result.hasMore || loading || loadingMore) return;
    const token = requestToken;
    set({ loadingMore: true });
    try {
      const next = await searchContent(
        keyword,
        category,
        PAGE_SIZE,
        result.songs.length +
          result.albums.length +
          result.artists.length +
          result.playlists.length +
          result.radios.length +
          result.users.length +
          result.media.length,
      );
      if (token !== requestToken) return;
      set({ result: mergeResult(result, next), loadingMore: false });
    } catch {
      if (token !== requestToken) return;
      set({ loadingMore: false });
      usePlayerStore.getState().toast("加载更多搜索结果失败", "error");
    }
  },

  loadHotTerms: async () => {
    if (get().hotTerms.length) return;
    try {
      set({ hotTerms: await getHotSearchTerms() });
    } catch {
      set({ hotTerms: [] });
    }
  },

  loadDefaultKeyword: async () => {
    if (get().defaultKeyword) return;
    try {
      set({ defaultKeyword: await getDefaultSearchKeyword() });
    } catch {
      set({ defaultKeyword: "" });
    }
  },

  loadSuggestions: async (keyword) => {
    const value = keyword.trim();
    const token = ++suggestionToken;
    if (!value) {
      set({ suggestions: [], suggestionsLoading: false });
      return;
    }
    set({ suggestionsLoading: true });
    try {
      const suggestions = await getSearchSuggestions(value);
      if (token !== suggestionToken) return;
      set({ suggestions, suggestionsLoading: false });
    } catch {
      if (token !== suggestionToken) return;
      set({ suggestions: [], suggestionsLoading: false });
    }
  },

  toggleFollow: async (userId) => {
    const user = get().result.users.find((item) => item.userId === userId);
    if (!user) return;
    const followed = !user.followed;
    try {
      await followUser(userId, followed);
      set((state) => ({
        result: {
          ...state.result,
          users: state.result.users.map((item) =>
            item.userId === userId ? { ...item, followed } : item,
          ),
        },
      }));
    } catch {
      usePlayerStore.getState().toast("关注操作失败", "error");
    }
  },
}));
