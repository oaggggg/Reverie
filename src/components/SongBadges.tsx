import type { Song } from "../api/types";
import { isVipSong, songQualityBadge } from "../store/playerStore";

/**
 * 歌曲条目的两个官方数据标识：VIP 会员歌曲（fee 1/8）与该曲支持的
 * 最好音质（无损及以上）。无数据时不渲染，可在任意歌曲名后内联使用。
 */
export default function SongBadges({
  song,
}: {
  song: Song | null | undefined;
}) {
  if (!song) return null;
  const quality = songQualityBadge(song);
  return (
    <>
      {isVipSong(song) && (
        <span
          className="vip-badge"
          title={
            song.fee === 1
              ? "需要网易云音乐会员，非会员可试听 60 秒（如资源支持）"
              : "非会员可免费试听标准音质，高音质需要会员"
          }
        >
          VIP
        </span>
      )}
      {quality && (
        <span
          className={`song-tag ${quality.cls}`}
          title={`支持${quality.label}音质`}
        >
          {quality.label}
        </span>
      )}
    </>
  );
}
