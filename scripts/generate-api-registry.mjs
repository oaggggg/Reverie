import { readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoDir = dirname(scriptDir);
const moduleDir = join(
  repoDir,
  "node_modules",
  "NeteaseCloudMusicApi",
  "module",
);
const outputFile = join(repoDir, "src", "api", "generated.ts");

// These modules are deliberately outside the product scope: authentication
// remains QR-only and account credential/profile mutation is not exposed.
const excluded = new Set([
  "activate_init_profile",
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
  "user_replacephone",
  "verify_getQr",
  "verify_qrcodestatus",
  "user_bindingcellphone",
  "user_update",
  "user_social_status_edit",
  "avatar_upload",
  "cloud",
  "cloud_import",
  "cloud_match",
  "digitalAlbum_detail",
  "digitalAlbum_ordering",
  "digitalAlbum_purchased",
  "digitalAlbum_sales",
  "listen_data_realtime_report",
  "listen_data_report",
  "listen_data_today_song",
  "listen_data_total",
  "listen_data_year_report",
  "summary_annual",
  "user_record",
  "song_lyrics_mark",
  "song_lyrics_mark_add",
  "song_lyrics_mark_del",
  "song_lyrics_mark_user_page",
  "musician_cloudbean",
  "musician_cloudbean_obtain",
  "musician_data_overview",
  "musician_play_trend",
  "musician_sign",
  "musician_tasks",
  "musician_tasks_new",
  "sati_resource_list",
  "sati_resource_list_more",
  "sati_resource_sub",
  "sati_resource_sub_list",
  "sati_tag_list",
  "sati_timescene_resources_get",
  "ugc_album_get",
  "ugc_artist_get",
  "ugc_artist_search",
  "ugc_detail",
  "ugc_mv_get",
  "ugc_song_get",
  "ugc_user_devote",
  "yunbei",
  "yunbei_expense",
  "yunbei_info",
  "yunbei_rcmd_song",
  "yunbei_rcmd_song_history",
  "yunbei_receipt",
  "yunbei_sign",
  "yunbei_task_finish",
  "yunbei_tasks",
  "yunbei_tasks_todo",
  "yunbei_today",
  "voice_delete",
  "voice_detail",
  "voice_lyric",
  "voice_upload",
  "voicelist_detail",
  "voicelist_list",
  "voicelist_list_search",
  "voicelist_search",
  "voicelist_trans",
  "artist_video",
  "related_allvideo",
  "broadcast_category_region_get",
  "broadcast_channel_collect_list",
  "broadcast_channel_currentinfo",
  "broadcast_channel_list",
  "broadcast_sub",
  "radio_sport_get",
  "dj_difm_all_style_channel",
  "dj_difm_channel_subscribe",
  "dj_difm_channel_unsubscribe",
  "dj_difm_playing_tracks_list",
  "dj_difm_subscribe_channels_get",
]);

const names = (await readdir(moduleDir))
  .filter((file) => file.endsWith(".js"))
  .map((file) => file.slice(0, -3))
  .sort((a, b) => a.localeCompare(b));
const included = names.filter((name) => !excluded.has(name));

const specialRoutes = {
  daily_signin: "/daily_signin",
  fm_trash: "/fm_trash",
  personal_fm: "/personal_fm",
};
const routeFor = (name) =>
  specialRoutes[name] ?? `/${name.replaceAll("_", "/")}`;
const quote = (value) => JSON.stringify(value);
const lines = [
  "/* eslint-disable @typescript-eslint/consistent-type-imports */",
  "// Generated from NeteaseCloudMusicApi/module. Run `npm run generate:api`.",
  'import { request, type RequestOptions } from "./client.ts";',
  "",
  "export type ApiParam = string | number | boolean;",
  "export type ApiParams = Record<string, ApiParam | null | undefined>;",
  "export type ApiRequestOptions = RequestOptions;",
  "export type ApiResponse<T = unknown> = T & { code?: number };",
  "",
  "export const API_ENDPOINTS = {",
  ...included.map((name) => `  ${name}: ${quote(routeFor(name))},`),
  "} as const;",
  "",
  "export type ApiName = keyof typeof API_ENDPOINTS;",
  "",
  "export const EXCLUDED_API_NAMES = [",
  ...[...excluded].sort().map((name) => `  ${quote(name)},`),
  "] as const;",
  "",
  "export async function callApi<T = unknown>(",
  "  name: ApiName,",
  "  params: ApiParams = {},",
  "  cacheBust = true,",
  "  options: ApiRequestOptions = {},",
  "): Promise<T> {",
  "  return request<T>(API_ENDPOINTS[name], params, cacheBust, options);",
  "}",
  "",
  ...included.flatMap((name) => [
    `export function ${name}<T = unknown>(params: ApiParams = {}, options: ApiRequestOptions = {}): Promise<T> {`,
    `  return callApi<T>(${quote(name)}, params, true, options);`,
    "}",
    "",
  ]),
  `export const API_ENDPOINT_COUNT = ${included.length};`,
  `export const EXCLUDED_API_COUNT = ${excluded.size};`,
  `export const API_MODULE_COUNT = ${names.length};`,
  "",
];

await writeFile(outputFile, `${lines.join("\n")}\n`, "utf8");
console.log(
  `Generated ${relative(repoDir, outputFile)} with ${included.length} included and ${excluded.size} excluded modules (${names.length} total).`,
);
