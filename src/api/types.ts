export interface Song {
  id: number;
  name: string;
  /** Joined artist names, e.g. "周杰伦" */
  artists: string;
  artistNames: string[];
  artistIds?: number[];
  album: string;
  albumId: number;
  picUrl: string;
  /** duration in milliseconds */
  duration: number;
  /** 0 = free, 1 = VIP, 4/8 = digital album etc. */
  fee: number;
  mvId?: number;
  /** Present when the playable song represents a podcast program. */
  programId?: number;
}

/** Official Netease Cloud Music playback quality levels. */
export type PlaybackQuality =
  | "standard"
  | "higher"
  | "exhigh"
  | "lossless"
  | "hires"
  | "jyeffect"
  | "jymaster";

export interface LyricLine {
  time: number;
  text: string;
  translation?: string;
}

export interface PlaylistInfo {
  id: number;
  name: string;
  coverImgUrl: string;
  trackCount: number;
  description?: string;
  creatorId?: number;
  creatorName?: string;
  subscribed?: boolean;
  privacy?: number;
  tags?: string[];
}

export interface PlaylistCategory {
  id: number;
  name: string;
  category: number;
  hot: boolean;
  resourceCount: number;
}

export interface StyleTag {
  id: number;
  name: string;
  parentId?: number;
}

export interface StyleDetail {
  id: number;
  name: string;
  description: string;
  coverUrl: string;
}

export interface TopicInfo {
  id: number;
  title: string;
  description: string;
  coverUrl: string;
  participateCount: number;
  shareCount: number;
}

export interface TopicEvent {
  id: string;
  text: string;
  creatorName: string;
  creatorAvatar: string;
  time: number;
  likedCount: number;
  commentCount: number;
}

export interface FirstListenInfo {
  songId: number;
  firstTime: number;
  playCount: number;
  description: string;
}

export interface SongSheet {
  id: string;
  name: string;
  type: string;
  coverUrl: string;
  previewUrl: string;
  description: string;
}

export interface SongAvailability {
  songId: number;
  available: boolean;
  message: string;
}

export interface PlaylistDynamicStats {
  playCount: number;
  subscribedCount: number;
  commentCount: number;
  shareCount: number;
  followed: boolean;
}

export interface ArtistInfo {
  id: number;
  name: string;
  picUrl: string;
  alias: string[];
  briefDesc: string;
  followed: boolean;
  musicSize: number;
  albumSize: number;
}

export interface AlbumInfo {
  id: number;
  name: string;
  picUrl: string;
  artistNames: string;
  artistIds: number[];
  description: string;
  publishTime: number;
  size: number;
  subscribed: boolean;
}

export interface AlbumPrivilege {
  songId: number;
  maxBitrate: number;
  standard: boolean;
  lossless: boolean;
  highRes: boolean;
  dolby: boolean;
  spatialAudio: boolean;
}

export interface CommentInfo {
  id: number;
  content: string;
  time: number;
  liked: boolean;
  likedCount: number;
  replyCount: number;
  owner: boolean;
  userId: number;
  nickname: string;
  avatarUrl: string;
  repliedTo?: {
    userId: number;
    nickname: string;
    content: string;
  };
}

export type CommentResourceType =
  "song" | "mv" | "playlist" | "album" | "program" | "video" | "event";

export type CommentSort = "recommended" | "hot" | "new";

export interface CommentResource {
  type: CommentResourceType;
  id: string;
  title: string;
  subtitle?: string;
  coverUrl?: string;
  threadId?: string;
}

export interface RadioInfo {
  id: number;
  name: string;
  picUrl: string;
  description: string;
  programCount: number;
  subscriberCount: number;
  subscribed: boolean;
  category: string;
  djName: string;
}

export interface SocialUser {
  userId: number;
  nickname: string;
  avatarUrl: string;
  signature: string;
  followed: boolean;
  follows: number;
  followeds: number;
}

export interface SocialEvent {
  id: number;
  type: number;
  time: number;
  text: string;
  user: SocialUser;
  commentCount: number;
  forwardCount: number;
  likedCount: number;
  liked: boolean;
  resourceTitle?: string;
  resourceType?: "song" | "album" | "playlist" | "other";
  resourceId?: number;
  threadId?: string;
}

export interface UserProfile {
  userId: number;
  nickname: string;
  avatarUrl: string;
  signature?: string;
  vipType: number;
  badgeUrl?: string;
}

export interface QrCreateResult {
  qrimg: string;
  qrurl: string;
}

export type PlayMode = "sequence" | "one" | "shuffle";

export type View =
  | "home"
  | "search"
  | "profile"
  | "collection"
  | "notifications"
  | "chart"
  | "fm"
  | "userlist"
  | "playlist"
  | "likes"
  | "recent"
  | "album"
  | "artist"
  | "comments"
  | "radio"
  | "radioDetail"
  | "social"
  | "cloud"
  | "yunbei"
  | "commentHistory"
  | "listenTogether"
  | "voiceWorkbench"
  | "lyricsMark"
  | "digitalAlbum"
  | "musician"
  | "sati"
  | "broadcast"
  | "ugc"
  | "listenReports"
  | "videos"
  | "fans"
  | "style"
  | "topics"
  | "library"
  | "calendar"
  | "privateDj";

export type SearchCategory =
  | "songs"
  | "lyrics"
  | "albums"
  | "artists"
  | "playlists"
  | "radios"
  | "users"
  | "mvs"
  | "videos";

export type CollectionCategory = "albums" | "artists" | "mvs" | "radios";

export interface SearchMediaInfo {
  id: string;
  name: string;
  coverUrl: string;
  creatorName: string;
  duration: number;
  playCount: number;
  kind: "mv" | "video";
}

export interface SearchSuggestion {
  keyword: string;
  type: string;
  source: string;
}

export interface MediaDetail extends SearchMediaInfo {
  description: string;
  publishTime: number;
  tags: string[];
  artistIds: number[];
  commentCount: number;
  subCount: number;
}
export interface MediaStats {
  likedCount: number;
  shareCount: number;
  commentCount: number;
  subCount: number;
  liked: boolean;
  subscribed: boolean;
}

export interface YunbeiTask {
  id: number;
  name: string;
  description: string;
  point: number;
  status: "todo" | "done" | "claimed";
  userTaskId?: number;
  depositCode?: string;
}

export interface YunbeiLedgerEntry {
  id: string;
  title: string;
  amount: number;
  time: number;
  type: "income" | "expense";
}

export interface YunbeiOverview {
  balance: number;
  todayEarned: number;
  signed: boolean;
  signDays: number;
}

export type RecentCategory =
  "songs" | "listen" | "albums" | "playlists" | "radios" | "videos" | "voices";

export interface RecentAlbum {
  id: number;
  name: string;
  coverUrl: string;
  artistName: string;
  time: number;
}

export interface RecentPlaylist {
  id: number;
  name: string;
  coverUrl: string;
  creatorName: string;
  time: number;
}

export interface RecentRadio {
  id: number;
  name: string;
  coverUrl: string;
  creatorName: string;
  time: number;
}

export interface RecommendHistoryDay {
  date: string;
  displayDate: string;
  songCount: number;
}

export interface UserCommentHistoryItem {
  id: number;
  content: string;
  time: number;
  resourceTitle: string;
  resourceType?: string;
  resourceId?: number;
}

export interface SongCreatorInfo {
  userId: number;
  name: string;
  role: string;
}

export interface SongChorusInfo {
  start: number;
  end: number;
}

export interface SongMetadata {
  summary: string;
  creators: SongCreatorInfo[];
  chorus: SongChorusInfo[];
  musicDetail?: SongMusicDetail;
  redCount?: number;
}

export interface SongMusicDetail {
  songId: number;
  level: string;
  bitrate: number;
  format: string;
  size: number;
  url?: string;
}

export interface ListenTogetherRoom {
  roomId: string;
  inviterId?: number;
  ownerId?: number;
  status: string;
  memberCount: number;
  maxMemberCount: number;
  createdAt: number;
}

export interface ListenTogetherState {
  room: ListenTogetherRoom | null;
  inRoom?: boolean;
  currentSongId: number;
  playing: boolean;
  progress: number;
  playlist: Song[];
}

export interface VoiceListInfo {
  id: number;
  name: string;
  coverUrl: string;
  description: string;
  voiceCount: number;
  subscribed: boolean;
}

export interface VoiceItem {
  id: number;
  name: string;
  description: string;
  coverUrl: string;
  duration: number;
  playCount: number;
  voiceListId?: number;
  voiceListName: string;
  status: string;
  transcribed: boolean;
  createdAt: number;
}

export interface PlaylistImportTaskStatus {
  id: string;
  status: "pending" | "running" | "success" | "failed";
  progress: number;
  message: string;
  playlistId?: number;
  playlistName?: string;
}

export interface LyricMark {
  id: string;
  songId: number;
  songName: string;
  originalLyricsText: string;
  translateLyricsText: string;
  translateType: number;
  startTimeStamp: number;
  createdAt: number;
}

export interface DigitalAlbum {
  id: number;
  name: string;
  artistName: string;
  coverUrl: string;
  description: string;
  price: number;
  sales: number;
  purchased: boolean;
  songs: Song[];
}
export interface DigitalAlbumRank extends DigitalAlbum {
  rank: number;
  score: number;
}

export interface MusicianOverview {
  songCount: number;
  playCount: number;
  fanCount: number;
  commentCount: number;
  cloudbean: number;
}

export interface MusicianTrendPoint {
  date: string;
  count: number;
}

export interface MusicianTask {
  id: number;
  name: string;
  description: string;
  reward: number;
  status: string;
  userMissionId?: number;
  period?: string;
}

export interface SatiTag {
  id: string;
  name: string;
}
export interface SatiResource {
  id: number;
  name: string;
  description: string;
  coverUrl: string;
  duration: number;
  subscribed: boolean;
  playCount: number;
  audioUrl: string;
}

export interface BroadcastCategory {
  id: number;
  name: string;
}
export interface BroadcastChannel {
  id: number;
  name: string;
  description: string;
  coverUrl: string;
  subscribed: boolean;
  categoryName: string;
  regionName: string;
  currentSong?: Song;
}
export interface ChartSummary {
  id: number;
  name: string;
  coverUrl: string;
  updateFrequency: string;
  description: string;
  trackCount: number;
}

export interface ChartCity {
  id: string;
  name: string;
  parentId?: string;
  children: ChartCity[];
}

export interface DimensionChartDetail {
  chartCode: string;
  targetId: string;
  targetType: string;
  name: string;
  description: string;
  updateTime: number;
  songCount: number;
}

export interface UgcResource {
  kind: "song" | "album" | "artist" | "mv";
  id: number;
  name: string;
  description: string;
  coverUrl: string;
  extra: string;
}
export interface UgcContribution {
  id: string;
  type: number;
  title: string;
  status: string;
  createTime: number;
  description: string;
}
export interface UgcDevote {
  count: number;
  points: number;
  yunbei: number;
}
export interface ListenTotal {
  duration: number;
  songCount: number;
  playCount: number;
}
export interface CreatorAuthInfo {
  authenticated: boolean;
  name: string;
  description: string;
  level: number;
}
export interface FansOverview {
  total: number;
  todayAdded: number;
  todayLost: number;
  growth: number;
}
export interface FansTrendPoint {
  date: string;
  count: number;
}
export interface ListenReport extends ListenTotal {
  startDate: string;
  endDate: string;
}
export interface ListenTodaySong {
  id: number;
  name: string;
  artists: string;
  count: number;
  coverUrl: string;
}
export interface VipTimeMachineEntry {
  date: string;
  songName: string;
  artistName: string;
  count: number;
}
export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  startTime: number;
  endTime: number;
  eventType: string;
  category: string;
  coverUrl: string;
  resourceId: number;
  resourceType: string;
  resourceUrl: string;
}
export interface PodcastProgramDetail {
  id: number;
  name: string;
  description: string;
  coverUrl: string;
  radioName: string;
  djName: string;
  publishTime: number;
  duration: number;
  commentCount: number;
  song: Song | null;
}
export interface ArtistFan {
  userId: number;
  nickname: string;
  avatarUrl: string;
  followed: boolean;
  signature: string;
}
export interface SigninProgress {
  moduleId: string;
  title: string;
  description: string;
  current: number;
  total: number;
  completed: boolean;
  reward: string;
}

export interface HappySignInfo {
  content: string;
  author: string;
  imageUrl: string;
  date: string;
}
export interface DifmChannel {
  id: number;
  name: string;
  description: string;
  coverUrl: string;
  source: number;
  subscribed: boolean;
}
export interface PrivateDjItem {
  id: string;
  kind: "song" | "program";
  title: string;
  subtitle: string;
  coverUrl: string;
  programId: number;
  audioUrl: string;
  song: Song | null;
}
export interface PodcastProgramRank {
  id: number;
  name: string;
  description: string;
  coverUrl: string;
  radioName: string;
  djName: string;
  score: number;
  song: Song | null;
}
export interface PodcastSubscriber {
  userId: number;
  nickname: string;
  avatarUrl: string;
  signature: string;
  time: number;
}

export interface SearchResultPage {
  songs: Song[];
  albums: AlbumInfo[];
  artists: ArtistInfo[];
  playlists: PlaylistInfo[];
  radios: RadioInfo[];
  users: SocialUser[];
  media: SearchMediaInfo[];
  total: number;
  hasMore: boolean;
}

export interface CollectionResultPage {
  albums: AlbumInfo[];
  artists: ArtistInfo[];
  media: SearchMediaInfo[];
  radios: RadioInfo[];
  total: number;
  hasMore: boolean;
}

export interface CloudSong extends Song {
  cloudId: number;
  fileName: string;
  fileSize: number;
  bitrate: number;
  addTime: number;
  matchedSongId?: number;
}

export type NotificationCategory =
  "private" | "comments" | "mentions" | "notices";

export interface MessageUser {
  userId: number;
  nickname: string;
  avatarUrl: string;
}

export interface PrivateConversation {
  user: MessageUser;
  preview: string;
  time: number;
  unreadCount: number;
}

export type PrivateAttachmentType = "song" | "playlist" | "album";

export interface PrivateAttachment {
  type: PrivateAttachmentType;
  id: number;
  title: string;
}

export interface PrivateMessage {
  id: string;
  fromUserId: number;
  toUserId: number;
  content: string;
  time: number;
  resourceTitle?: string;
  resourceType?: PrivateAttachmentType;
  resourceId?: number;
}

export interface NotificationItem {
  id: string;
  user: MessageUser | null;
  title: string;
  content: string;
  time: number;
  resourceTitle?: string;
}

export interface SearchResponse {
  result?: { songs?: unknown[]; songCount?: number };
  code?: number;
}

export interface SongDetailResponse {
  songs?: unknown[];
  code?: number;
}

export interface LyricResponse {
  code?: number;
  lrc?: { lyric?: string; version?: number };
  tlyric?: { lyric?: string; version?: number };
  nolyric?: boolean;
}

export interface SongUrlResponse {
  code?: number;
  data?: Array<{
    id?: number;
    url?: string | null;
    br?: number;
    type?: string;
    code?: number;
    message?: string;
    msg?: string;
    freeTrialInfo?: {
      start?: number;
      end?: number;
      startTime?: number;
      endTime?: number;
    } | null;
  }>;
}

export interface QrKeyResponse {
  code?: number;
  data?: { unikey?: string };
}

export interface QrCreateResponse {
  code?: number;
  data?: { qrimg?: string; qrurl?: string };
}

export interface QrCheckResponse {
  code?: number;
  message?: string;
  cookie?: string;
  nickname?: string;
  avatarUrl?: string;
}

export interface LoginStatusResponse {
  code?: number;
  data?: { code?: number; profile?: unknown; account?: unknown };
  profile?: unknown;
  account?: unknown;
}
