import { useEffect, useRef, useState } from "react";
import { usePlayerStore } from "../store/playerStore";
import { useSearchStore } from "../store/searchStore";
import { useNotificationStore } from "../store/notificationStore";
import type { ThemePreference } from "../store/playerStore";
import type { View } from "../api/types";
import type { ReactElement } from "react";
import {
  BarChart3,
  Bell,
  Disc3,
  Heart,
  History,
  House,
  ListMusic,
  Monitor,
  Moon,
  Podcast,
  LibraryBig,
  Search,
  Sun,
  Users,
} from "lucide-react";
import UserMenu from "./UserMenu";
import { sizedImage } from "../utils/image";

interface NavItem {
  view: View;
  label: string;
  icon: ReactElement;
  auth?: boolean;
}

const NAV: NavItem[] = [
  { view: "home", label: "首页", icon: <House size={17} /> },
  { view: "chart", label: "排行榜", icon: <BarChart3 size={17} /> },
  { view: "library", label: "音乐馆", icon: <LibraryBig size={17} /> },
  {
    view: "userlist",
    label: "我的歌单",
    icon: <ListMusic size={17} />,
    auth: true,
  },
  { view: "radio", label: "播客", icon: <Podcast size={16} />, auth: true },
  { view: "social", label: "动态", icon: <Users size={16} />, auth: true },
];

const THEME_ORDER: ThemePreference[] = ["system", "light", "dark"];
const THEME_ICON = {
  system: <Monitor size={17} />,
  light: <Sun size={17} />,
  dark: <Moon size={17} />,
};
const THEME_LABEL = { system: "跟随系统", light: "浅色", dark: "深色" };

const preloadView = (view: View) => {
  switch (view) {
    case "chart":
      return import("./ChartPage");
    case "videos":
      return import("./VideoPage");
    case "search":
      return import("./SearchPage");
    case "userlist":
      return import("./UserListPage");
    case "radio":
      return import("./RadioPage");
    case "social":
      return import("./SocialPage");
    case "cloud":
      return import("./CloudPage");
    case "yunbei":
      return import("./YunbeiPage");
    case "vip":
      return import("./VipPage");
    case "commentHistory":
      return import("./CommentHistoryPage");
    case "downloadHistory":
      return import("./DownloadHistoryPage");
    case "listenTogether":
      return import("./ListenTogetherPage");
    case "voiceWorkbench":
      return import("./VoiceWorkbenchPage");
    case "lyricsMark":
      return import("./LyricsMarkPage");
    case "digitalAlbum":
      return import("./DigitalAlbumPage");
    case "musician":
      return import("./MusicianPage");
    case "sati":
      return import("./SatiPage");
    case "broadcast":
      return import("./BroadcastPage");
    case "ugc":
      return import("./UgcPage");
    case "listenReports":
      return import("./ListenReportsPage");
    case "fans":
      return import("./FansPage");
    case "style":
      return import("./StylePage");
    case "topics":
      return import("./TopicPage");
    case "library":
      return import("./LibraryPage");
    case "calendar":
      return import("./CalendarPage");
    case "privateDj":
      return import("./PrivateDjPage");
    case "likes":
      return import("./LikesPage");
    case "recent":
      return import("./RecentPage");
    case "notifications":
      return import("./NotificationPage");
    default:
      return Promise.resolve();
  }
};

export default function TopNav() {
  const activeView = usePlayerStore((s) => s.activeView);
  const loggedIn = usePlayerStore((s) => s.loggedIn);
  const theme = usePlayerStore((s) => s.theme);
  const searchOpen = usePlayerStore((s) => s.searchOpen);
  const searchKeyword = usePlayerStore((s) => s.searchKeyword);
  const searching = usePlayerStore((s) => s.searching);
  const searchResults = usePlayerStore((s) => s.searchResults);

  const setActiveView = usePlayerStore((s) => s.setActiveView);
  const setPage = usePlayerStore((s) => s.setPage);
  const setTheme = usePlayerStore((s) => s.setTheme);
  const setSearchOpen = usePlayerStore((s) => s.setSearchOpen);
  const doSearch = usePlayerStore((s) => s.doSearch);
  const setShowLogin = usePlayerStore((s) => s.setShowLogin);
  const loadTopSongs = usePlayerStore((s) => s.loadTopSongs);
  const loadUserPlaylists = usePlayerStore((s) => s.loadUserPlaylists);
  const loadHome = usePlayerStore((s) => s.loadHome);
  const playSong = usePlayerStore((s) => s.playSong);
  const openSearch = useSearchStore((s) => s.openSearch);
  const hotTerms = useSearchStore((s) => s.hotTerms);
  const loadHotTerms = useSearchStore((s) => s.loadHotTerms);
  const suggestions = useSearchStore((s) => s.suggestions);
  const suggestionsLoading = useSearchStore((s) => s.suggestionsLoading);
  const loadSuggestions = useSearchStore((s) => s.loadSuggestions);
  const openNotifications = useNotificationStore((s) => s.openNotifications);

  const searchRef = useRef<HTMLInputElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const searchTimerRef = useRef(0);
  const [condensed, setCondensed] = useState(false);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    const onPageScroll = (event: Event) => {
      const { scrollTop = 0 } = (event as CustomEvent<{ scrollTop?: number }>)
        .detail;
      setCondensed((current) => {
        if (current) return scrollTop >= 4;
        return scrollTop > 18;
      });
    };
    window.addEventListener("reverie:page-scroll", onPageScroll);
    return () =>
      window.removeEventListener("reverie:page-scroll", onPageScroll);
  }, []);

  useEffect(() => {
    window.clearTimeout(searchTimerRef.current);
    if (!searchOpen) return;
    const keyword = searchKeyword.trim();
    if (!keyword) {
      usePlayerStore.setState({ searchResults: [], searching: false });
      // 空输入时展示热搜
      if (loggedIn) void loadHotTerms();
      return;
    }
    searchTimerRef.current = window.setTimeout(() => {
      void doSearch(keyword);
      void loadSuggestions(keyword);
    }, 180);
    return () => window.clearTimeout(searchTimerRef.current);
  }, [searchKeyword, searchOpen, doSearch, loadSuggestions, loadHotTerms, loggedIn]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [setSearchOpen]);

  const handleNav = (view: View, auth?: boolean) => {
    if (auth && !loggedIn) {
      setShowLogin(true);
      return;
    }
    setPage("browse");
    setSearchOpen(false);
    if (view === activeView) return;
    switch (view) {
      case "home":
        loadHome();
        break;
      case "chart":
        loadTopSongs();
        break;
      case "userlist":
        loadUserPlaylists();
        break;
      case "radio":
      case "social":
      case "cloud":
      case "yunbei":
        setActiveView(view);
        break;
      default:
        setActiveView(view);
    }
  };

  const cycleTheme = () => {
    const i = THEME_ORDER.indexOf(theme);
    setTheme(THEME_ORDER[(i + 1) % THEME_ORDER.length]);
  };

  return (
    <nav
      className={`topnav ${condensed ? "is-condensed" : ""} ${searchOpen ? "search-open" : ""}`}
      ref={navRef}
    >
      <div className="topnav-items">
        {NAV.map((item) => (
          <button
            key={item.view}
            className={`topnav-item ${activeView === item.view && !searchOpen ? "active" : ""}`}
            onPointerEnter={() => void preloadView(item.view)}
            onClick={() => handleNav(item.view, item.auth)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <div className="topnav-actions">
        {searchOpen ? (
          <div className="search-wrap">
            <div className="search-capsule">
              <Search size={15} />
              <input
                ref={searchRef}
                placeholder="搜索歌曲 / 歌手 / 专辑…"
                value={searchKeyword}
                onChange={(e) =>
                  usePlayerStore.setState({ searchKeyword: e.target.value })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    window.clearTimeout(searchTimerRef.current);
                    void openSearch(e.currentTarget.value, "songs");
                  }
                  if (e.key === "Escape") {
                    setSearchOpen(false);
                    usePlayerStore.setState({
                      searchKeyword: "",
                      searchResults: [],
                    });
                  }
                }}
              />
            </div>
            {searching ||
            searchResults.length > 0 ||
            suggestions.length > 0 ||
            suggestionsLoading ||
            (!searchKeyword.trim() && (hotTerms.length > 0 || loggedIn)) ||
            (searchKeyword && !loggedIn) ? (
              <div className="search-dropdown">
                {searching ? (
                  <div className="loading-hint">搜索中…</div>
                ) : !loggedIn ? (
                  <div className="search-login-hint">
                    <span>登录后即可搜索音乐，请点击右上角「登录」</span>
                  </div>
                ) : !searchKeyword.trim() ? (
                  // 空输入：展示热搜榜
                  <>
                    <div className="search-dropdown-caption">热搜</div>
                    {hotTerms.length ? (
                      hotTerms.slice(0, 10).map((term, index) => (
                        <button
                          key={term}
                          className="search-hot-item"
                          onClick={() => void openSearch(term, "songs")}
                        >
                          <span
                            className={`hot-rank ${index < 3 ? "top" : ""}`}
                          >
                            {index + 1}
                          </span>
                          <strong>{term}</strong>
                        </button>
                      ))
                    ) : (
                      <div className="loading-hint">正在加载热搜…</div>
                    )}
                  </>
                ) : (
                  <>
                    {suggestionsLoading || suggestions.length > 0 ? (
                      <>
                        <div className="search-dropdown-caption">搜索建议</div>
                        {suggestionsLoading ? (
                          <div className="loading-hint">正在获取建议…</div>
                        ) : (
                          suggestions.slice(0, 6).map((suggestion) => (
                            <button
                              key={`${suggestion.keyword}-${suggestion.type}`}
                              className="search-suggest-item"
                              onClick={() =>
                                void openSearch(suggestion.keyword, "songs")
                              }
                            >
                              <strong>{suggestion.keyword}</strong>
                              <small>
                                {suggestion.type}
                                {suggestion.source ? ` · ${suggestion.source}` : ""}
                              </small>
                            </button>
                          ))
                        )}
                      </>
                    ) : null}
                    {searchResults.length > 0 ? (
                      <>
                        <div className="search-dropdown-caption">歌曲匹配</div>
                        {searchResults.slice(0, 8).map((song) => (
                          <div
                            key={song.id}
                            className="search-dropdown-item"
                            onClick={() => {
                              playSong(song, searchResults);
                              setSearchOpen(false);
                            }}
                          >
                            {song.picUrl ? (
                              <img src={sizedImage(song.picUrl, 80)} alt="" />
                            ) : (
                              <span className="song-ph">
                                <Disc3 size={16} />
                              </span>
                            )}
                            <div className="meta">
                              <div className="t">{song.name}</div>
                              <div className="a">{song.artists}</div>
                            </div>
                          </div>
                        ))}
                        <button
                          className="search-view-all"
                          onClick={() => void openSearch(searchKeyword, "songs")}
                        >
                          查看全部搜索结果
                        </button>
                      </>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
          </div>
        ) : (
          <button
            className="topnav-icon-btn"
            onClick={() => {
              // reopen clean: don't keep the previous search content
              setSearchOpen(true);
              setPage("browse");
              usePlayerStore.setState({
                searchKeyword: "",
                searchResults: [],
                searching: false,
              });
            }}
            title="搜索"
          >
            <Search size={17} />
          </button>
        )}

        <button
          className="topnav-icon-btn"
          onPointerEnter={() => void preloadView("likes")}
          onClick={cycleTheme}
          title={`主题：${THEME_LABEL[theme]}`}
        >
          {THEME_ICON[theme]}
        </button>

        <button
          className="topnav-icon-btn"
          onPointerEnter={() => void preloadView("recent")}
          onClick={() => {
            setPage("browse");
            setActiveView("likes");
          }}
          title="我的喜欢"
        >
          <Heart size={17} />
        </button>

        <button
          className="topnav-icon-btn"
          onClick={() => {
            setPage("browse");
            setActiveView("recent");
          }}
          title="最近播放"
        >
          <History size={17} />
        </button>

        <button
          className="topnav-icon-btn"
          onPointerEnter={() => void preloadView("notifications")}
          onClick={() => {
            if (!loggedIn) {
              setShowLogin(true);
              return;
            }
            void openNotifications();
          }}
          title="消息中心"
        >
          <Bell size={17} />
        </button>

        {loggedIn ? (
          <UserMenu />
        ) : (
          <button
            className="topnav-login"
            onPointerEnter={() => void import("./LoginModal")}
            onClick={() => setShowLogin(true)}
          >
            登录
          </button>
        )}
      </div>
    </nav>
  );
}
