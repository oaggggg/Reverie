import { useCallback, useEffect, useRef, useState } from "react";
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
  Library,
  LibraryBig,
  Monitor,
  Moon,
  Podcast,
  Search,
  Sun,
  Users,
} from "lucide-react";
import UserMenu from "./UserMenu";
import { sizedImage } from "../utils/image";
import {
  captureInteractionOrigin,
  useOriginTransition,
} from "../utils/originTransition";

interface NavItem {
  view: View;
  label: string;
  icon: ReactElement;
  auth?: boolean;
}

const NAV: NavItem[] = [
  { view: "home", label: "首页", icon: <House size={17} /> },
  { view: "chart", label: "排行榜", icon: <BarChart3 size={17} /> },
  { view: "library", label: "音乐馆", icon: <Library size={17} /> },
  {
    view: "userlist",
    label: "我的歌单",
    icon: <LibraryBig size={17} />,
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
const SEARCH_DROPDOWN_CLOSE_MS = 160;
const SEARCH_DROPDOWN_CLOSE_FALLBACK_MS = SEARCH_DROPDOWN_CLOSE_MS + 120;

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
  const setShowLikes = usePlayerStore((s) => s.setShowLikes);
  const setShowRecent = usePlayerStore((s) => s.setShowRecent);
  const loadTopSongs = usePlayerStore((s) => s.loadTopSongs);
  const loadUserPlaylists = usePlayerStore((s) => s.loadUserPlaylists);
  const loadHome = usePlayerStore((s) => s.loadHome);
  const playSong = usePlayerStore((s) => s.playSong);
  const openSearch = useSearchStore((s) => s.openSearch);
  const hotTerms = useSearchStore((s) => s.hotTerms);
  const loadHotTerms = useSearchStore((s) => s.loadHotTerms);
  const openNotifications = useNotificationStore((s) => s.openNotifications);

  const searchRef = useRef<HTMLInputElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const searchTimerRef = useRef(0);
  const searchCloseTimerRef = useRef(0);
  const searchAfterCloseRef = useRef<(() => void) | undefined>(undefined);
  const [condensed, setCondensed] = useState(false);
  const [searchDropdownClosing, setSearchDropdownClosing] = useState(false);
  const searchTransition = useOriginTransition<HTMLDivElement>(
    searchOpen,
    "topnav-search",
    200,
  );

  const hasSearchDropdown =
    searching ||
    searchResults.length > 0 ||
    (!searchKeyword.trim() && (hotTerms.length > 0 || loggedIn)) ||
    Boolean(searchKeyword && !loggedIn);

  const finishSearchClose = useCallback(() => {
    window.clearTimeout(searchCloseTimerRef.current);
    searchCloseTimerRef.current = 0;
    // Keep the completed closing state mounted while the search capsule starts
    // its own exit animation; this prevents the dropdown from flashing back in.
    setSearchDropdownClosing(true);
    setSearchOpen(false);
    const afterClose = searchAfterCloseRef.current;
    searchAfterCloseRef.current = undefined;
    afterClose?.();
  }, [setSearchOpen]);

  const closeSearch = useCallback(
    (afterClose?: () => void) => {
      window.clearTimeout(searchCloseTimerRef.current);
      if (!searchOpen || !hasSearchDropdown) {
        setSearchDropdownClosing(false);
        setSearchOpen(false);
        searchAfterCloseRef.current = undefined;
        afterClose?.();
        return;
      }
      searchAfterCloseRef.current = afterClose;
      setSearchDropdownClosing(true);
      searchCloseTimerRef.current = window.setTimeout(() => {
        finishSearchClose();
      }, SEARCH_DROPDOWN_CLOSE_FALLBACK_MS);
    },
    [
      SEARCH_DROPDOWN_CLOSE_FALLBACK_MS,
      finishSearchClose,
      hasSearchDropdown,
      searchOpen,
      setSearchOpen,
    ],
  );

  useEffect(() => {
    if (!searchOpen) return;
    window.clearTimeout(searchCloseTimerRef.current);
    searchAfterCloseRef.current = undefined;
    setSearchDropdownClosing(false);
  }, [searchOpen]);

  // 组件卸载时清理关闭回退定时器，避免卸载后仍触发导航回调。
  useEffect(
    () => () => {
      window.clearTimeout(searchCloseTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!searchTransition.rendered) return;
    const frame = window.requestAnimationFrame(() => {
      searchRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [searchTransition.rendered]);

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
    }, 180);
    return () => window.clearTimeout(searchTimerRef.current);
  }, [searchKeyword, searchOpen, doSearch, loadHotTerms, loggedIn]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        closeSearch();
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [closeSearch]);

  const handleNav = (view: View, auth?: boolean) => {
    if (auth && !loggedIn) {
      setShowLogin(true);
      return;
    }
    setPage("browse");
    closeSearch();
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

  const openSearchPage = (value: string) => {
    const keyword = value.trim();
    if (!keyword) return;
    closeSearch(() => void openSearch(keyword, "songs"));
  };

  return (
    <nav
      className={`topnav ${condensed ? "is-condensed" : ""} ${searchTransition.rendered ? "search-open" : ""}`}
      ref={navRef}
    >
      <div className="topnav-items">
        {NAV.map((item) => (
          <button
            key={item.view}
            className={`topnav-item ${activeView === item.view ? "active" : ""}`}
            onPointerEnter={() => void preloadView(item.view)}
            onClick={() => handleNav(item.view, item.auth)}
            title={item.label}
            aria-label={item.label}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <div className="topnav-actions">
        {searchTransition.rendered ? (
          <div
            ref={searchTransition.surfaceRef}
            className={`search-wrap ${searchTransition.surfaceClassName}`}
          >
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
                    openSearchPage(e.currentTarget.value);
                  }
                  if (e.key === "Escape") {
                    closeSearch(() =>
                      usePlayerStore.setState({
                        searchKeyword: "",
                        searchResults: [],
                      }),
                    );
                  }
                }}
              />
            </div>
            {hasSearchDropdown || searchDropdownClosing ? (
              <div
                className={`search-dropdown ${searchDropdownClosing ? "search-dropdown-closing" : ""}`}
                onAnimationEnd={(event) => {
                  if (
                    searchDropdownClosing &&
                    event.animationName === "search-dropdown-out"
                  ) {
                    finishSearchClose();
                  }
                }}
              >
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
                          onClick={() => openSearchPage(term)}
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
                    {searchResults.length > 0 ? (
                      <>
                        <div className="search-dropdown-caption">歌曲匹配</div>
                        {searchResults.slice(0, 8).map((song) => (
                          <div
                            key={song.id}
                            className="search-dropdown-item"
                            onClick={() => {
                              playSong(song, searchResults);
                              closeSearch();
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
                          onClick={() => openSearchPage(searchKeyword)}
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
            data-origin-key="topnav-search"
            onClick={(event) => {
              captureInteractionOrigin("topnav-search", event.currentTarget);
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
          onClick={cycleTheme}
          title={`主题：${THEME_LABEL[theme]}`}
        >
          {THEME_ICON[theme]}
        </button>

        <button
          className="topnav-icon-btn"
          onPointerEnter={() => void import("./LikesModal")}
          onClick={() => setShowLikes(true)}
          title="我的喜欢"
        >
          <Heart size={17} />
        </button>

        <button
          className="topnav-icon-btn"
          onPointerEnter={() => void import("./RecentModal")}
          onClick={() => setShowRecent(true)}
          title="最近播放"
        >
          <History size={17} />
        </button>

        <button
          className="topnav-icon-btn"
          onPointerEnter={() => void import("./NotificationModal")}
          data-origin-key={loggedIn ? undefined : "login"}
          onClick={(event) => {
            if (!loggedIn) {
              captureInteractionOrigin("login", event.currentTarget);
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
            onClick={(event) => {
              captureInteractionOrigin("login", event.currentTarget);
              setShowLogin(true);
            }}
          >
            登录
          </button>
        )}
      </div>
    </nav>
  );
}
