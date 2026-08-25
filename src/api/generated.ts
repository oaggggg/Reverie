/* eslint-disable @typescript-eslint/consistent-type-imports */
// Generated from NeteaseCloudMusicApi/module. Run `npm run generate:api`.
import { request, type RequestOptions } from "./client.ts";

export type ApiParam = string | number | boolean;
export type ApiParams = Record<string, ApiParam | null | undefined>;
export type ApiRequestOptions = RequestOptions;
export type ApiResponse<T = unknown> = T & { code?: number };

export const API_ENDPOINTS = {
  aidj_content_rcmd: "/aidj/content/rcmd",
  album: "/album",
  album_detail: "/album/detail",
  album_detail_dynamic: "/album/detail/dynamic",
  album_list: "/album/list",
  album_list_style: "/album/list/style",
  album_new: "/album/new",
  album_newest: "/album/newest",
  album_privilege: "/album/privilege",
  album_songsaleboard: "/album/songsaleboard",
  album_sub: "/album/sub",
  album_sublist: "/album/sublist",
  api: "/api",
  artist_album: "/artist/album",
  artist_desc: "/artist/desc",
  artist_detail: "/artist/detail",
  artist_detail_dynamic: "/artist/detail/dynamic",
  artist_fans: "/artist/fans",
  artist_follow_count: "/artist/follow/count",
  artist_list: "/artist/list",
  artist_mv: "/artist/mv",
  artist_new_mv: "/artist/new/mv",
  artist_new_song: "/artist/new/song",
  artist_songs: "/artist/songs",
  artist_sub: "/artist/sub",
  artist_sublist: "/artist/sublist",
  artist_top_song: "/artist/top/song",
  artist_video: "/artist/video",
  artists: "/artists",
  audio_match: "/audio/match",
  banner: "/banner",
  batch: "/batch",
  broadcast_category_region_get: "/broadcast/category/region/get",
  broadcast_channel_collect_list: "/broadcast/channel/collect/list",
  broadcast_channel_currentinfo: "/broadcast/channel/currentinfo",
  broadcast_channel_list: "/broadcast/channel/list",
  broadcast_sub: "/broadcast/sub",
  calendar: "/calendar",
  chart_detail: "/chart/detail",
  chart_song_detail: "/chart/song/detail",
  check_music: "/check/music",
  cloud: "/cloud",
  cloud_import: "/cloud/import",
  cloud_match: "/cloud/match",
  cloudsearch: "/cloudsearch",
  comment: "/comment",
  comment_album: "/comment/album",
  comment_dj: "/comment/dj",
  comment_event: "/comment/event",
  comment_floor: "/comment/floor",
  comment_hot: "/comment/hot",
  comment_hug_list: "/comment/hug/list",
  comment_like: "/comment/like",
  comment_music: "/comment/music",
  comment_mv: "/comment/mv",
  comment_new: "/comment/new",
  comment_playlist: "/comment/playlist",
  comment_video: "/comment/video",
  creator_authinfo_get: "/creator/authinfo/get",
  daily_signin: "/daily_signin",
  digitalAlbum_detail: "/digitalAlbum/detail",
  digitalAlbum_ordering: "/digitalAlbum/ordering",
  digitalAlbum_purchased: "/digitalAlbum/purchased",
  digitalAlbum_sales: "/digitalAlbum/sales",
  dj_banner: "/dj/banner",
  dj_category_excludehot: "/dj/category/excludehot",
  dj_category_recommend: "/dj/category/recommend",
  dj_catelist: "/dj/catelist",
  dj_detail: "/dj/detail",
  dj_difm_all_style_channel: "/dj/difm/all/style/channel",
  dj_difm_channel_subscribe: "/dj/difm/channel/subscribe",
  dj_difm_channel_unsubscribe: "/dj/difm/channel/unsubscribe",
  dj_difm_playing_tracks_list: "/dj/difm/playing/tracks/list",
  dj_difm_subscribe_channels_get: "/dj/difm/subscribe/channels/get",
  dj_hot: "/dj/hot",
  dj_paygift: "/dj/paygift",
  dj_personalize_recommend: "/dj/personalize/recommend",
  dj_program: "/dj/program",
  dj_program_detail: "/dj/program/detail",
  dj_program_toplist: "/dj/program/toplist",
  dj_program_toplist_hours: "/dj/program/toplist/hours",
  dj_radio_hot: "/dj/radio/hot",
  dj_recommend: "/dj/recommend",
  dj_recommend_type: "/dj/recommend/type",
  dj_sub: "/dj/sub",
  dj_sublist: "/dj/sublist",
  dj_subscriber: "/dj/subscriber",
  dj_today_perfered: "/dj/today/perfered",
  dj_toplist: "/dj/toplist",
  dj_toplist_hours: "/dj/toplist/hours",
  dj_toplist_newcomer: "/dj/toplist/newcomer",
  dj_toplist_pay: "/dj/toplist/pay",
  dj_toplist_popular: "/dj/toplist/popular",
  djRadio_top: "/djRadio/top",
  eapi_decrypt: "/eapi/decrypt",
  event: "/event",
  event_del: "/event/del",
  event_forward: "/event/forward",
  fanscenter_basicinfo_age_get: "/fanscenter/basicinfo/age/get",
  fanscenter_basicinfo_gender_get: "/fanscenter/basicinfo/gender/get",
  fanscenter_basicinfo_province_get: "/fanscenter/basicinfo/province/get",
  fanscenter_overview_get: "/fanscenter/overview/get",
  fanscenter_trend_list: "/fanscenter/trend/list",
  fm_trash: "/fm_trash",
  follow: "/follow",
  get_userids: "/get/userids",
  history_recommend_songs: "/history/recommend/songs",
  history_recommend_songs_detail: "/history/recommend/songs/detail",
  homepage_block_page: "/homepage/block/page",
  homepage_dragon_ball: "/homepage/dragon/ball",
  hot_topic: "/hot/topic",
  hug_comment: "/hug/comment",
  inner_version: "/inner/version",
  lbs_city_code: "/lbs/city/code",
  like: "/like",
  likelist: "/likelist",
  listen_data_realtime_report: "/listen/data/realtime/report",
  listen_data_report: "/listen/data/report",
  listen_data_today_song: "/listen/data/today/song",
  listen_data_total: "/listen/data/total",
  listen_data_year_report: "/listen/data/year/report",
  listentogether_accept: "/listentogether/accept",
  listentogether_end: "/listentogether/end",
  listentogether_heatbeat: "/listentogether/heatbeat",
  listentogether_play_command: "/listentogether/play/command",
  listentogether_room_check: "/listentogether/room/check",
  listentogether_room_create: "/listentogether/room/create",
  listentogether_status: "/listentogether/status",
  listentogether_sync_list_command: "/listentogether/sync/list/command",
  listentogether_sync_playlist_get: "/listentogether/sync/playlist/get",
  login_qr_check: "/login/qr/check",
  login_qr_create: "/login/qr/create",
  login_qr_key: "/login/qr/key",
  login_status: "/login/status",
  lyric: "/lyric",
  lyric_new: "/lyric/new",
  mlog_music_rcmd: "/mlog/music/rcmd",
  mlog_to_video: "/mlog/to/video",
  mlog_url: "/mlog/url",
  msg_comments: "/msg/comments",
  msg_forwards: "/msg/forwards",
  msg_notices: "/msg/notices",
  msg_private: "/msg/private",
  msg_private_history: "/msg/private/history",
  msg_recentcontact: "/msg/recentcontact",
  music_first_listen_info: "/music/first/listen/info",
  musician_cloudbean: "/musician/cloudbean",
  musician_cloudbean_obtain: "/musician/cloudbean/obtain",
  musician_data_overview: "/musician/data/overview",
  musician_play_trend: "/musician/play/trend",
  musician_sign: "/musician/sign",
  musician_tasks: "/musician/tasks",
  musician_tasks_new: "/musician/tasks/new",
  mv_all: "/mv/all",
  mv_detail: "/mv/detail",
  mv_detail_info: "/mv/detail/info",
  mv_exclusive_rcmd: "/mv/exclusive/rcmd",
  mv_first: "/mv/first",
  mv_sub: "/mv/sub",
  mv_sublist: "/mv/sublist",
  mv_url: "/mv/url",
  personal_fm: "/personal_fm",
  personal_fm_mode: "/personal/fm/mode",
  personalized: "/personalized",
  personalized_djprogram: "/personalized/djprogram",
  personalized_mv: "/personalized/mv",
  personalized_newsong: "/personalized/newsong",
  personalized_privatecontent: "/personalized/privatecontent",
  personalized_privatecontent_list: "/personalized/privatecontent/list",
  pl_count: "/pl/count",
  playlist_category_list: "/playlist/category/list",
  playlist_catlist: "/playlist/catlist",
  playlist_cover_update: "/playlist/cover/update",
  playlist_create: "/playlist/create",
  playlist_delete: "/playlist/delete",
  playlist_desc_update: "/playlist/desc/update",
  playlist_detail: "/playlist/detail",
  playlist_detail_dynamic: "/playlist/detail/dynamic",
  playlist_detail_rcmd_get: "/playlist/detail/rcmd/get",
  playlist_highquality_tags: "/playlist/highquality/tags",
  playlist_hot: "/playlist/hot",
  playlist_import_name_task_create: "/playlist/import/name/task/create",
  playlist_import_task_status: "/playlist/import/task/status",
  playlist_mylike: "/playlist/mylike",
  playlist_name_update: "/playlist/name/update",
  playlist_order_update: "/playlist/order/update",
  playlist_privacy: "/playlist/privacy",
  playlist_subscribe: "/playlist/subscribe",
  playlist_subscribers: "/playlist/subscribers",
  playlist_tags_update: "/playlist/tags/update",
  playlist_track_add: "/playlist/track/add",
  playlist_track_all: "/playlist/track/all",
  playlist_track_delete: "/playlist/track/delete",
  playlist_tracks: "/playlist/tracks",
  playlist_update: "/playlist/update",
  playlist_update_playcount: "/playlist/update/playcount",
  playlist_video_recent: "/playlist/video/recent",
  playmode_intelligence_list: "/playmode/intelligence/list",
  playmode_song_vector: "/playmode/song/vector",
  program_recommend: "/program/recommend",
  radio_sport_get: "/radio/sport/get",
  recent_listen_list: "/recent/listen/list",
  recommend_resource: "/recommend/resource",
  recommend_songs: "/recommend/songs",
  recommend_songs_dislike: "/recommend/songs/dislike",
  record_recent_album: "/record/recent/album",
  record_recent_dj: "/record/recent/dj",
  record_recent_playlist: "/record/recent/playlist",
  record_recent_song: "/record/recent/song",
  record_recent_video: "/record/recent/video",
  record_recent_voice: "/record/recent/voice",
  related_allvideo: "/related/allvideo",
  related_playlist: "/related/playlist",
  resource_like: "/resource/like",
  sati_resource_list: "/sati/resource/list",
  sati_resource_list_more: "/sati/resource/list/more",
  sati_resource_sub: "/sati/resource/sub",
  sati_resource_sub_list: "/sati/resource/sub/list",
  sati_tag_list: "/sati/tag/list",
  sati_timescene_resources_get: "/sati/timescene/resources/get",
  scrobble: "/scrobble",
  search: "/search",
  search_default: "/search/default",
  search_hot: "/search/hot",
  search_hot_detail: "/search/hot/detail",
  search_match: "/search/match",
  search_multimatch: "/search/multimatch",
  search_suggest: "/search/suggest",
  send_album: "/send/album",
  send_playlist: "/send/playlist",
  send_song: "/send/song",
  send_text: "/send/text",
  setting: "/setting",
  share_resource: "/share/resource",
  sheet_list: "/sheet/list",
  sheet_preview: "/sheet/preview",
  sign_happy_info: "/sign/happy/info",
  signin_progress: "/signin/progress",
  simi_artist: "/simi/artist",
  simi_mv: "/simi/mv",
  simi_playlist: "/simi/playlist",
  simi_song: "/simi/song",
  simi_user: "/simi/user",
  song_chorus: "/song/chorus",
  song_creators: "/song/creators",
  song_detail: "/song/detail",
  song_downlist: "/song/downlist",
  song_download_url: "/song/download/url",
  song_download_url_v1: "/song/download/url/v1",
  song_dynamic_cover: "/song/dynamic/cover",
  song_like_check: "/song/like/check",
  song_lyrics_mark: "/song/lyrics/mark",
  song_lyrics_mark_add: "/song/lyrics/mark/add",
  song_lyrics_mark_del: "/song/lyrics/mark/del",
  song_lyrics_mark_user_page: "/song/lyrics/mark/user/page",
  song_monthdownlist: "/song/monthdownlist",
  song_music_detail: "/song/music/detail",
  song_order_update: "/song/order/update",
  song_purchased: "/song/purchased",
  song_red_count: "/song/red/count",
  song_singledownlist: "/song/singledownlist",
  song_url: "/song/url",
  song_url_v1: "/song/url/v1",
  song_wiki_summary: "/song/wiki/summary",
  starpick_comments_summary: "/starpick/comments/summary",
  style_album: "/style/album",
  style_artist: "/style/artist",
  style_detail: "/style/detail",
  style_list: "/style/list",
  style_playlist: "/style/playlist",
  style_preference: "/style/preference",
  style_song: "/style/song",
  summary_annual: "/summary/annual",
  threshold_detail_get: "/threshold/detail/get",
  top_album: "/top/album",
  top_artists: "/top/artists",
  top_list: "/top/list",
  top_mv: "/top/mv",
  top_playlist: "/top/playlist",
  top_playlist_highquality: "/top/playlist/highquality",
  top_song: "/top/song",
  topic_detail: "/topic/detail",
  topic_detail_event_hot: "/topic/detail/event/hot",
  topic_sublist: "/topic/sublist",
  toplist: "/toplist",
  toplist_artist: "/toplist/artist",
  toplist_detail: "/toplist/detail",
  toplist_detail_v2: "/toplist/detail/v2",
  ugc_album_get: "/ugc/album/get",
  ugc_artist_get: "/ugc/artist/get",
  ugc_artist_search: "/ugc/artist/search",
  ugc_detail: "/ugc/detail",
  ugc_mv_get: "/ugc/mv/get",
  ugc_song_get: "/ugc/song/get",
  ugc_user_devote: "/ugc/user/devote",
  user_account: "/user/account",
  user_audio: "/user/audio",
  user_binding: "/user/binding",
  user_cloud: "/user/cloud",
  user_cloud_del: "/user/cloud/del",
  user_cloud_detail: "/user/cloud/detail",
  user_comment_history: "/user/comment/history",
  user_detail: "/user/detail",
  user_detail_new: "/user/detail/new",
  user_dj: "/user/dj",
  user_event: "/user/event",
  user_follow_mixed: "/user/follow/mixed",
  user_followeds: "/user/followeds",
  user_follows: "/user/follows",
  user_level: "/user/level",
  user_medal: "/user/medal",
  user_mutualfollow_get: "/user/mutualfollow/get",
  user_playlist: "/user/playlist",
  user_playlist_collect: "/user/playlist/collect",
  user_playlist_create: "/user/playlist/create",
  user_record: "/user/record",
  user_social_status: "/user/social/status",
  user_social_status_rcmd: "/user/social/status/rcmd",
  user_social_status_support: "/user/social/status/support",
  user_subcount: "/user/subcount",
  video_category_list: "/video/category/list",
  video_detail: "/video/detail",
  video_detail_info: "/video/detail/info",
  video_group: "/video/group",
  video_group_list: "/video/group/list",
  video_sub: "/video/sub",
  video_timeline_all: "/video/timeline/all",
  video_timeline_recommend: "/video/timeline/recommend",
  video_url: "/video/url",
  vip_growthpoint: "/vip/growthpoint",
  vip_growthpoint_details: "/vip/growthpoint/details",
  vip_growthpoint_get: "/vip/growthpoint/get",
  vip_info: "/vip/info",
  vip_info_v2: "/vip/info/v2",
  vip_tasks: "/vip/tasks",
  vip_timemachine: "/vip/timemachine",
  voice_delete: "/voice/delete",
  voice_detail: "/voice/detail",
  voice_lyric: "/voice/lyric",
  voice_upload: "/voice/upload",
  voicelist_detail: "/voicelist/detail",
  voicelist_list: "/voicelist/list",
  voicelist_list_search: "/voicelist/list/search",
  voicelist_search: "/voicelist/search",
  voicelist_trans: "/voicelist/trans",
  weblog: "/weblog",
  yunbei: "/yunbei",
  yunbei_expense: "/yunbei/expense",
  yunbei_info: "/yunbei/info",
  yunbei_rcmd_song: "/yunbei/rcmd/song",
  yunbei_rcmd_song_history: "/yunbei/rcmd/song/history",
  yunbei_receipt: "/yunbei/receipt",
  yunbei_sign: "/yunbei/sign",
  yunbei_task_finish: "/yunbei/task/finish",
  yunbei_tasks: "/yunbei/tasks",
  yunbei_tasks_todo: "/yunbei/tasks/todo",
  yunbei_today: "/yunbei/today",
} as const;

export type ApiName = keyof typeof API_ENDPOINTS;

export const EXCLUDED_API_NAMES = [
  "activate_init_profile",
  "avatar_upload",
  "captcha_sent",
  "captcha_verify",
  "cellphone_existence_check",
  "countries_code_list",
  "login",
  "login_cellphone",
  "login_refresh",
  "logout",
  "nickname_check",
  "rebind",
  "register_anonimous",
  "register_cellphone",
  "user_bindingcellphone",
  "user_replacephone",
  "user_social_status_edit",
  "user_update",
  "verify_getQr",
  "verify_qrcodestatus",
] as const;

export async function callApi<T = unknown>(
  name: ApiName,
  params: ApiParams = {},
  cacheBust = true,
  options: ApiRequestOptions = {},
): Promise<T> {
  return request<T>(API_ENDPOINTS[name], params, cacheBust, options);
}

export function aidj_content_rcmd<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("aidj_content_rcmd", params, true, options);
}

export function album<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("album", params, true, options);
}

export function album_detail<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("album_detail", params, true, options);
}

export function album_detail_dynamic<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("album_detail_dynamic", params, true, options);
}

export function album_list<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("album_list", params, true, options);
}

export function album_list_style<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("album_list_style", params, true, options);
}

export function album_new<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("album_new", params, true, options);
}

export function album_newest<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("album_newest", params, true, options);
}

export function album_privilege<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("album_privilege", params, true, options);
}

export function album_songsaleboard<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("album_songsaleboard", params, true, options);
}

export function album_sub<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("album_sub", params, true, options);
}

export function album_sublist<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("album_sublist", params, true, options);
}

export function api<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("api", params, true, options);
}

export function artist_album<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("artist_album", params, true, options);
}

export function artist_desc<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("artist_desc", params, true, options);
}

export function artist_detail<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("artist_detail", params, true, options);
}

export function artist_detail_dynamic<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("artist_detail_dynamic", params, true, options);
}

export function artist_fans<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("artist_fans", params, true, options);
}

export function artist_follow_count<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("artist_follow_count", params, true, options);
}

export function artist_list<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("artist_list", params, true, options);
}

export function artist_mv<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("artist_mv", params, true, options);
}

export function artist_new_mv<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("artist_new_mv", params, true, options);
}

export function artist_new_song<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("artist_new_song", params, true, options);
}

export function artist_songs<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("artist_songs", params, true, options);
}

export function artist_sub<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("artist_sub", params, true, options);
}

export function artist_sublist<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("artist_sublist", params, true, options);
}

export function artist_top_song<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("artist_top_song", params, true, options);
}

export function artist_video<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("artist_video", params, true, options);
}

export function artists<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("artists", params, true, options);
}

export function audio_match<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("audio_match", params, true, options);
}

export function banner<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("banner", params, true, options);
}

export function batch<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("batch", params, true, options);
}

export function broadcast_category_region_get<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("broadcast_category_region_get", params, true, options);
}

export function broadcast_channel_collect_list<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("broadcast_channel_collect_list", params, true, options);
}

export function broadcast_channel_currentinfo<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("broadcast_channel_currentinfo", params, true, options);
}

export function broadcast_channel_list<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("broadcast_channel_list", params, true, options);
}

export function broadcast_sub<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("broadcast_sub", params, true, options);
}

export function calendar<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("calendar", params, true, options);
}

export function chart_detail<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("chart_detail", params, true, options);
}

export function chart_song_detail<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("chart_song_detail", params, true, options);
}

export function check_music<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("check_music", params, true, options);
}

export function cloud<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("cloud", params, true, options);
}

export function cloud_import<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("cloud_import", params, true, options);
}

export function cloud_match<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("cloud_match", params, true, options);
}

export function cloudsearch<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("cloudsearch", params, true, options);
}

export function comment<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("comment", params, true, options);
}

export function comment_album<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("comment_album", params, true, options);
}

export function comment_dj<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("comment_dj", params, true, options);
}

export function comment_event<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("comment_event", params, true, options);
}

export function comment_floor<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("comment_floor", params, true, options);
}

export function comment_hot<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("comment_hot", params, true, options);
}

export function comment_hug_list<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("comment_hug_list", params, true, options);
}

export function comment_like<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("comment_like", params, true, options);
}

export function comment_music<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("comment_music", params, true, options);
}

export function comment_mv<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("comment_mv", params, true, options);
}

export function comment_new<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("comment_new", params, true, options);
}

export function comment_playlist<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("comment_playlist", params, true, options);
}

export function comment_video<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("comment_video", params, true, options);
}

export function creator_authinfo_get<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("creator_authinfo_get", params, true, options);
}

export function daily_signin<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("daily_signin", params, true, options);
}

export function digitalAlbum_detail<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("digitalAlbum_detail", params, true, options);
}

export function digitalAlbum_ordering<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("digitalAlbum_ordering", params, true, options);
}

export function digitalAlbum_purchased<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("digitalAlbum_purchased", params, true, options);
}

export function digitalAlbum_sales<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("digitalAlbum_sales", params, true, options);
}

export function dj_banner<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("dj_banner", params, true, options);
}

export function dj_category_excludehot<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("dj_category_excludehot", params, true, options);
}

export function dj_category_recommend<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("dj_category_recommend", params, true, options);
}

export function dj_catelist<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("dj_catelist", params, true, options);
}

export function dj_detail<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("dj_detail", params, true, options);
}

export function dj_difm_all_style_channel<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("dj_difm_all_style_channel", params, true, options);
}

export function dj_difm_channel_subscribe<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("dj_difm_channel_subscribe", params, true, options);
}

export function dj_difm_channel_unsubscribe<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("dj_difm_channel_unsubscribe", params, true, options);
}

export function dj_difm_playing_tracks_list<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("dj_difm_playing_tracks_list", params, true, options);
}

export function dj_difm_subscribe_channels_get<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("dj_difm_subscribe_channels_get", params, true, options);
}

export function dj_hot<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("dj_hot", params, true, options);
}

export function dj_paygift<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("dj_paygift", params, true, options);
}

export function dj_personalize_recommend<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("dj_personalize_recommend", params, true, options);
}

export function dj_program<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("dj_program", params, true, options);
}

export function dj_program_detail<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("dj_program_detail", params, true, options);
}

export function dj_program_toplist<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("dj_program_toplist", params, true, options);
}

export function dj_program_toplist_hours<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("dj_program_toplist_hours", params, true, options);
}

export function dj_radio_hot<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("dj_radio_hot", params, true, options);
}

export function dj_recommend<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("dj_recommend", params, true, options);
}

export function dj_recommend_type<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("dj_recommend_type", params, true, options);
}

export function dj_sub<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("dj_sub", params, true, options);
}

export function dj_sublist<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("dj_sublist", params, true, options);
}

export function dj_subscriber<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("dj_subscriber", params, true, options);
}

export function dj_today_perfered<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("dj_today_perfered", params, true, options);
}

export function dj_toplist<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("dj_toplist", params, true, options);
}

export function dj_toplist_hours<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("dj_toplist_hours", params, true, options);
}

export function dj_toplist_newcomer<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("dj_toplist_newcomer", params, true, options);
}

export function dj_toplist_pay<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("dj_toplist_pay", params, true, options);
}

export function dj_toplist_popular<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("dj_toplist_popular", params, true, options);
}

export function djRadio_top<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("djRadio_top", params, true, options);
}

export function eapi_decrypt<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("eapi_decrypt", params, true, options);
}

export function event<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("event", params, true, options);
}

export function event_del<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("event_del", params, true, options);
}

export function event_forward<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("event_forward", params, true, options);
}

export function fanscenter_basicinfo_age_get<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("fanscenter_basicinfo_age_get", params, true, options);
}

export function fanscenter_basicinfo_gender_get<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("fanscenter_basicinfo_gender_get", params, true, options);
}

export function fanscenter_basicinfo_province_get<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("fanscenter_basicinfo_province_get", params, true, options);
}

export function fanscenter_overview_get<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("fanscenter_overview_get", params, true, options);
}

export function fanscenter_trend_list<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("fanscenter_trend_list", params, true, options);
}

export function fm_trash<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("fm_trash", params, true, options);
}

export function follow<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("follow", params, true, options);
}

export function get_userids<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("get_userids", params, true, options);
}

export function history_recommend_songs<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("history_recommend_songs", params, true, options);
}

export function history_recommend_songs_detail<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("history_recommend_songs_detail", params, true, options);
}

export function homepage_block_page<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("homepage_block_page", params, true, options);
}

export function homepage_dragon_ball<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("homepage_dragon_ball", params, true, options);
}

export function hot_topic<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("hot_topic", params, true, options);
}

export function hug_comment<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("hug_comment", params, true, options);
}

export function inner_version<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("inner_version", params, true, options);
}

export function lbs_city_code<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("lbs_city_code", params, true, options);
}

export function like<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("like", params, true, options);
}

export function likelist<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("likelist", params, true, options);
}

export function listen_data_realtime_report<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("listen_data_realtime_report", params, true, options);
}

export function listen_data_report<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("listen_data_report", params, true, options);
}

export function listen_data_today_song<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("listen_data_today_song", params, true, options);
}

export function listen_data_total<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("listen_data_total", params, true, options);
}

export function listen_data_year_report<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("listen_data_year_report", params, true, options);
}

export function listentogether_accept<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("listentogether_accept", params, true, options);
}

export function listentogether_end<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("listentogether_end", params, true, options);
}

export function listentogether_heatbeat<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("listentogether_heatbeat", params, true, options);
}

export function listentogether_play_command<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("listentogether_play_command", params, true, options);
}

export function listentogether_room_check<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("listentogether_room_check", params, true, options);
}

export function listentogether_room_create<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("listentogether_room_create", params, true, options);
}

export function listentogether_status<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("listentogether_status", params, true, options);
}

export function listentogether_sync_list_command<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("listentogether_sync_list_command", params, true, options);
}

export function listentogether_sync_playlist_get<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("listentogether_sync_playlist_get", params, true, options);
}

export function login_qr_check<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("login_qr_check", params, true, options);
}

export function login_qr_create<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("login_qr_create", params, true, options);
}

export function login_qr_key<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("login_qr_key", params, true, options);
}

export function login_status<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("login_status", params, true, options);
}

export function lyric<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("lyric", params, true, options);
}

export function lyric_new<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("lyric_new", params, true, options);
}

export function mlog_music_rcmd<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("mlog_music_rcmd", params, true, options);
}

export function mlog_to_video<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("mlog_to_video", params, true, options);
}

export function mlog_url<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("mlog_url", params, true, options);
}

export function msg_comments<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("msg_comments", params, true, options);
}

export function msg_forwards<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("msg_forwards", params, true, options);
}

export function msg_notices<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("msg_notices", params, true, options);
}

export function msg_private<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("msg_private", params, true, options);
}

export function msg_private_history<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("msg_private_history", params, true, options);
}

export function msg_recentcontact<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("msg_recentcontact", params, true, options);
}

export function music_first_listen_info<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("music_first_listen_info", params, true, options);
}

export function musician_cloudbean<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("musician_cloudbean", params, true, options);
}

export function musician_cloudbean_obtain<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("musician_cloudbean_obtain", params, true, options);
}

export function musician_data_overview<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("musician_data_overview", params, true, options);
}

export function musician_play_trend<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("musician_play_trend", params, true, options);
}

export function musician_sign<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("musician_sign", params, true, options);
}

export function musician_tasks<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("musician_tasks", params, true, options);
}

export function musician_tasks_new<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("musician_tasks_new", params, true, options);
}

export function mv_all<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("mv_all", params, true, options);
}

export function mv_detail<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("mv_detail", params, true, options);
}

export function mv_detail_info<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("mv_detail_info", params, true, options);
}

export function mv_exclusive_rcmd<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("mv_exclusive_rcmd", params, true, options);
}

export function mv_first<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("mv_first", params, true, options);
}

export function mv_sub<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("mv_sub", params, true, options);
}

export function mv_sublist<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("mv_sublist", params, true, options);
}

export function mv_url<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("mv_url", params, true, options);
}

export function personal_fm<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("personal_fm", params, true, options);
}

export function personal_fm_mode<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("personal_fm_mode", params, true, options);
}

export function personalized<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("personalized", params, true, options);
}

export function personalized_djprogram<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("personalized_djprogram", params, true, options);
}

export function personalized_mv<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("personalized_mv", params, true, options);
}

export function personalized_newsong<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("personalized_newsong", params, true, options);
}

export function personalized_privatecontent<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("personalized_privatecontent", params, true, options);
}

export function personalized_privatecontent_list<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("personalized_privatecontent_list", params, true, options);
}

export function pl_count<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("pl_count", params, true, options);
}

export function playlist_category_list<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("playlist_category_list", params, true, options);
}

export function playlist_catlist<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("playlist_catlist", params, true, options);
}

export function playlist_cover_update<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("playlist_cover_update", params, true, options);
}

export function playlist_create<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("playlist_create", params, true, options);
}

export function playlist_delete<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("playlist_delete", params, true, options);
}

export function playlist_desc_update<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("playlist_desc_update", params, true, options);
}

export function playlist_detail<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("playlist_detail", params, true, options);
}

export function playlist_detail_dynamic<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("playlist_detail_dynamic", params, true, options);
}

export function playlist_detail_rcmd_get<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("playlist_detail_rcmd_get", params, true, options);
}

export function playlist_highquality_tags<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("playlist_highquality_tags", params, true, options);
}

export function playlist_hot<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("playlist_hot", params, true, options);
}

export function playlist_import_name_task_create<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("playlist_import_name_task_create", params, true, options);
}

export function playlist_import_task_status<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("playlist_import_task_status", params, true, options);
}

export function playlist_mylike<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("playlist_mylike", params, true, options);
}

export function playlist_name_update<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("playlist_name_update", params, true, options);
}

export function playlist_order_update<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("playlist_order_update", params, true, options);
}

export function playlist_privacy<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("playlist_privacy", params, true, options);
}

export function playlist_subscribe<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("playlist_subscribe", params, true, options);
}

export function playlist_subscribers<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("playlist_subscribers", params, true, options);
}

export function playlist_tags_update<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("playlist_tags_update", params, true, options);
}

export function playlist_track_add<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("playlist_track_add", params, true, options);
}

export function playlist_track_all<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("playlist_track_all", params, true, options);
}

export function playlist_track_delete<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("playlist_track_delete", params, true, options);
}

export function playlist_tracks<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("playlist_tracks", params, true, options);
}

export function playlist_update<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("playlist_update", params, true, options);
}

export function playlist_update_playcount<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("playlist_update_playcount", params, true, options);
}

export function playlist_video_recent<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("playlist_video_recent", params, true, options);
}

export function playmode_intelligence_list<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("playmode_intelligence_list", params, true, options);
}

export function playmode_song_vector<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("playmode_song_vector", params, true, options);
}

export function program_recommend<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("program_recommend", params, true, options);
}

export function radio_sport_get<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("radio_sport_get", params, true, options);
}

export function recent_listen_list<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("recent_listen_list", params, true, options);
}

export function recommend_resource<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("recommend_resource", params, true, options);
}

export function recommend_songs<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("recommend_songs", params, true, options);
}

export function recommend_songs_dislike<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("recommend_songs_dislike", params, true, options);
}

export function record_recent_album<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("record_recent_album", params, true, options);
}

export function record_recent_dj<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("record_recent_dj", params, true, options);
}

export function record_recent_playlist<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("record_recent_playlist", params, true, options);
}

export function record_recent_song<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("record_recent_song", params, true, options);
}

export function record_recent_video<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("record_recent_video", params, true, options);
}

export function record_recent_voice<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("record_recent_voice", params, true, options);
}

export function related_allvideo<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("related_allvideo", params, true, options);
}

export function related_playlist<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("related_playlist", params, true, options);
}

export function resource_like<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("resource_like", params, true, options);
}

export function sati_resource_list<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("sati_resource_list", params, true, options);
}

export function sati_resource_list_more<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("sati_resource_list_more", params, true, options);
}

export function sati_resource_sub<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("sati_resource_sub", params, true, options);
}

export function sati_resource_sub_list<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("sati_resource_sub_list", params, true, options);
}

export function sati_tag_list<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("sati_tag_list", params, true, options);
}

export function sati_timescene_resources_get<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("sati_timescene_resources_get", params, true, options);
}

export function scrobble<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("scrobble", params, true, options);
}

export function search<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("search", params, true, options);
}

export function search_default<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("search_default", params, true, options);
}

export function search_hot<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("search_hot", params, true, options);
}

export function search_hot_detail<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("search_hot_detail", params, true, options);
}

export function search_match<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("search_match", params, true, options);
}

export function search_multimatch<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("search_multimatch", params, true, options);
}

export function search_suggest<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("search_suggest", params, true, options);
}

export function send_album<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("send_album", params, true, options);
}

export function send_playlist<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("send_playlist", params, true, options);
}

export function send_song<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("send_song", params, true, options);
}

export function send_text<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("send_text", params, true, options);
}

export function setting<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("setting", params, true, options);
}

export function share_resource<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("share_resource", params, true, options);
}

export function sheet_list<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("sheet_list", params, true, options);
}

export function sheet_preview<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("sheet_preview", params, true, options);
}

export function sign_happy_info<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("sign_happy_info", params, true, options);
}

export function signin_progress<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("signin_progress", params, true, options);
}

export function simi_artist<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("simi_artist", params, true, options);
}

export function simi_mv<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("simi_mv", params, true, options);
}

export function simi_playlist<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("simi_playlist", params, true, options);
}

export function simi_song<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("simi_song", params, true, options);
}

export function simi_user<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("simi_user", params, true, options);
}

export function song_chorus<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("song_chorus", params, true, options);
}

export function song_creators<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("song_creators", params, true, options);
}

export function song_detail<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("song_detail", params, true, options);
}

export function song_downlist<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("song_downlist", params, true, options);
}

export function song_download_url<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("song_download_url", params, true, options);
}

export function song_download_url_v1<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("song_download_url_v1", params, true, options);
}

export function song_dynamic_cover<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("song_dynamic_cover", params, true, options);
}

export function song_like_check<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("song_like_check", params, true, options);
}

export function song_lyrics_mark<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("song_lyrics_mark", params, true, options);
}

export function song_lyrics_mark_add<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("song_lyrics_mark_add", params, true, options);
}

export function song_lyrics_mark_del<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("song_lyrics_mark_del", params, true, options);
}

export function song_lyrics_mark_user_page<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("song_lyrics_mark_user_page", params, true, options);
}

export function song_monthdownlist<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("song_monthdownlist", params, true, options);
}

export function song_music_detail<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("song_music_detail", params, true, options);
}

export function song_order_update<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("song_order_update", params, true, options);
}

export function song_purchased<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("song_purchased", params, true, options);
}

export function song_red_count<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("song_red_count", params, true, options);
}

export function song_singledownlist<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("song_singledownlist", params, true, options);
}

export function song_url<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("song_url", params, true, options);
}

export function song_url_v1<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("song_url_v1", params, true, options);
}

export function song_wiki_summary<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("song_wiki_summary", params, true, options);
}

export function starpick_comments_summary<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("starpick_comments_summary", params, true, options);
}

export function style_album<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("style_album", params, true, options);
}

export function style_artist<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("style_artist", params, true, options);
}

export function style_detail<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("style_detail", params, true, options);
}

export function style_list<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("style_list", params, true, options);
}

export function style_playlist<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("style_playlist", params, true, options);
}

export function style_preference<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("style_preference", params, true, options);
}

export function style_song<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("style_song", params, true, options);
}

export function summary_annual<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("summary_annual", params, true, options);
}

export function threshold_detail_get<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("threshold_detail_get", params, true, options);
}

export function top_album<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("top_album", params, true, options);
}

export function top_artists<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("top_artists", params, true, options);
}

export function top_list<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("top_list", params, true, options);
}

export function top_mv<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("top_mv", params, true, options);
}

export function top_playlist<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("top_playlist", params, true, options);
}

export function top_playlist_highquality<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("top_playlist_highquality", params, true, options);
}

export function top_song<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("top_song", params, true, options);
}

export function topic_detail<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("topic_detail", params, true, options);
}

export function topic_detail_event_hot<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("topic_detail_event_hot", params, true, options);
}

export function topic_sublist<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("topic_sublist", params, true, options);
}

export function toplist<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("toplist", params, true, options);
}

export function toplist_artist<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("toplist_artist", params, true, options);
}

export function toplist_detail<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("toplist_detail", params, true, options);
}

export function toplist_detail_v2<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("toplist_detail_v2", params, true, options);
}

export function ugc_album_get<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("ugc_album_get", params, true, options);
}

export function ugc_artist_get<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("ugc_artist_get", params, true, options);
}

export function ugc_artist_search<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("ugc_artist_search", params, true, options);
}

export function ugc_detail<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("ugc_detail", params, true, options);
}

export function ugc_mv_get<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("ugc_mv_get", params, true, options);
}

export function ugc_song_get<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("ugc_song_get", params, true, options);
}

export function ugc_user_devote<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("ugc_user_devote", params, true, options);
}

export function user_account<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("user_account", params, true, options);
}

export function user_audio<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("user_audio", params, true, options);
}

export function user_binding<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("user_binding", params, true, options);
}

export function user_cloud<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("user_cloud", params, true, options);
}

export function user_cloud_del<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("user_cloud_del", params, true, options);
}

export function user_cloud_detail<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("user_cloud_detail", params, true, options);
}

export function user_comment_history<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("user_comment_history", params, true, options);
}

export function user_detail<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("user_detail", params, true, options);
}

export function user_detail_new<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("user_detail_new", params, true, options);
}

export function user_dj<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("user_dj", params, true, options);
}

export function user_event<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("user_event", params, true, options);
}

export function user_follow_mixed<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("user_follow_mixed", params, true, options);
}

export function user_followeds<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("user_followeds", params, true, options);
}

export function user_follows<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("user_follows", params, true, options);
}

export function user_level<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("user_level", params, true, options);
}

export function user_medal<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("user_medal", params, true, options);
}

export function user_mutualfollow_get<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("user_mutualfollow_get", params, true, options);
}

export function user_playlist<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("user_playlist", params, true, options);
}

export function user_playlist_collect<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("user_playlist_collect", params, true, options);
}

export function user_playlist_create<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("user_playlist_create", params, true, options);
}

export function user_record<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("user_record", params, true, options);
}

export function user_social_status<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("user_social_status", params, true, options);
}

export function user_social_status_rcmd<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("user_social_status_rcmd", params, true, options);
}

export function user_social_status_support<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("user_social_status_support", params, true, options);
}

export function user_subcount<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("user_subcount", params, true, options);
}

export function video_category_list<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("video_category_list", params, true, options);
}

export function video_detail<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("video_detail", params, true, options);
}

export function video_detail_info<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("video_detail_info", params, true, options);
}

export function video_group<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("video_group", params, true, options);
}

export function video_group_list<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("video_group_list", params, true, options);
}

export function video_sub<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("video_sub", params, true, options);
}

export function video_timeline_all<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("video_timeline_all", params, true, options);
}

export function video_timeline_recommend<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("video_timeline_recommend", params, true, options);
}

export function video_url<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("video_url", params, true, options);
}

export function vip_growthpoint<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("vip_growthpoint", params, true, options);
}

export function vip_growthpoint_details<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("vip_growthpoint_details", params, true, options);
}

export function vip_growthpoint_get<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("vip_growthpoint_get", params, true, options);
}

export function vip_info<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("vip_info", params, true, options);
}

export function vip_info_v2<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("vip_info_v2", params, true, options);
}

export function vip_tasks<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("vip_tasks", params, true, options);
}

export function vip_timemachine<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("vip_timemachine", params, true, options);
}

export function voice_delete<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("voice_delete", params, true, options);
}

export function voice_detail<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("voice_detail", params, true, options);
}

export function voice_lyric<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("voice_lyric", params, true, options);
}

export function voice_upload<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("voice_upload", params, true, options);
}

export function voicelist_detail<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("voicelist_detail", params, true, options);
}

export function voicelist_list<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("voicelist_list", params, true, options);
}

export function voicelist_list_search<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("voicelist_list_search", params, true, options);
}

export function voicelist_search<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("voicelist_search", params, true, options);
}

export function voicelist_trans<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("voicelist_trans", params, true, options);
}

export function weblog<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("weblog", params, true, options);
}

export function yunbei<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("yunbei", params, true, options);
}

export function yunbei_expense<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("yunbei_expense", params, true, options);
}

export function yunbei_info<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("yunbei_info", params, true, options);
}

export function yunbei_rcmd_song<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("yunbei_rcmd_song", params, true, options);
}

export function yunbei_rcmd_song_history<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("yunbei_rcmd_song_history", params, true, options);
}

export function yunbei_receipt<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("yunbei_receipt", params, true, options);
}

export function yunbei_sign<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("yunbei_sign", params, true, options);
}

export function yunbei_task_finish<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("yunbei_task_finish", params, true, options);
}

export function yunbei_tasks<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("yunbei_tasks", params, true, options);
}

export function yunbei_tasks_todo<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("yunbei_tasks_todo", params, true, options);
}

export function yunbei_today<T = unknown>(
  params: ApiParams = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return callApi<T>("yunbei_today", params, true, options);
}

export const API_ENDPOINT_COUNT = 357;
export const EXCLUDED_API_COUNT = 20;
export const API_MODULE_COUNT = 377;
