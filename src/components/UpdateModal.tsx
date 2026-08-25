import { usePlayerStore } from "../store/playerStore";
import { renderReleaseNotes } from "../utils/notes";
import { ArrowRight } from "lucide-react";
import { useOriginTransition } from "../utils/originTransition";
import { useModalBehavior } from "../utils/modalBehavior";

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  return mb >= 100 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`;
}

export default function UpdateModal() {
  const showUpdate = usePlayerStore((s) => s.showUpdate);
  const updatePhase = usePlayerStore((s) => s.updatePhase);
  const updateVersion = usePlayerStore((s) => s.updateVersion);
  const updateNotes = usePlayerStore((s) => s.updateNotes);
  const updateProgress = usePlayerStore((s) => s.updateProgress);
  const updateTransferred = usePlayerStore((s) => s.updateTransferred);
  const updateTotal = usePlayerStore((s) => s.updateTotal);
  const updateSpeed = usePlayerStore((s) => s.updateSpeed);
  const updateErrorStage = usePlayerStore((s) => s.updateErrorStage);
  const updateError = usePlayerStore((s) => s.updateError);
  const startUpdate = usePlayerStore((s) => s.startUpdate);
  const checkUpdate = usePlayerStore((s) => s.checkUpdate);
  const installUpdate = usePlayerStore((s) => s.installUpdate);
  const dismissUpdate = usePlayerStore((s) => s.dismissUpdate);
  const transition = useOriginTransition<HTMLDivElement>(
    showUpdate,
    "update",
    220,
  );
  const downloading = updatePhase === "downloading";
  const downloaded = updatePhase === "downloaded";
  const installing = updatePhase === "installing";
  useModalBehavior(showUpdate, transition.surfaceRef, () => {
    if (!downloaded && !installing) dismissUpdate();
  });

  if (!transition.rendered) return null;

  const failed = updatePhase === "error";

  return (
    <div
      className={`modal-backdrop ${transition.backdropClassName}`}
      onClick={downloaded || installing ? undefined : dismissUpdate}
    >
      <div
        ref={transition.surfaceRef}
        className={`modal update-modal ${transition.surfaceClassName}`}
        role="dialog"
        aria-modal="true"
        aria-label="应用更新"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>
          {installing
            ? "正在安装更新"
            : downloaded
              ? "更新已就绪"
              : failed
                ? "更新失败"
                : downloading
                  ? "正在下载更新"
                  : "发现新版本"}
        </h2>

        <div className="update-versions">
          <span className="ver-old">v{__APP_VERSION__}</span>
          <span className="ver-arrow">
            <ArrowRight size={16} />
          </span>
          <span className="ver-new">v{updateVersion}</span>
        </div>

        {failed ? (
          <p className="update-error" role="alert">
            {updateError || "更新操作失败，请稍后重试。"}
          </p>
        ) : installing ? (
          <p className="sub">安装程序正在启动，请不要重复操作。</p>
        ) : updateNotes ? (
          <div
            className="update-notes"
            dangerouslySetInnerHTML={{
              __html: renderReleaseNotes(updateNotes),
            }}
          />
        ) : (
          <p className="sub">新版本已发布，点击「更新」即可下载安装。</p>
        )}

        {(downloading || downloaded) && (
          <div className="update-progress">
            <div className="update-progress-bar">
              <i style={{ width: `${Math.max(2, updateProgress)}%` }} />
            </div>
            <div className="update-progress-meta">
              <span>{updateProgress}%</span>
              <span>
                {formatSize(updateTransferred)} / {formatSize(updateTotal)}
              </span>
              {updateSpeed > 0 && <span>{formatSize(updateSpeed)}/s</span>}
            </div>
          </div>
        )}

        <div className="update-actions">
          {installing ? (
            <span className="update-installing-hint">正在启动安装程序…</span>
          ) : downloaded ? (
            <>
              <button className="btn" onClick={dismissUpdate}>
                稍后再说
              </button>
              <button className="btn primary" onClick={installUpdate}>
                立即重启安装
              </button>
            </>
          ) : downloading ? (
            <button className="btn" onClick={dismissUpdate}>
              后台下载
            </button>
          ) : failed ? (
            <>
              <button className="btn" onClick={dismissUpdate}>
                关闭
              </button>
              <button
                className="btn primary"
                onClick={() => {
                  if (updateErrorStage === "install") installUpdate();
                  else if (updateVersion) startUpdate();
                  else checkUpdate(true);
                }}
              >
                {updateErrorStage === "install"
                  ? "重试安装"
                  : updateVersion
                    ? "重试下载"
                    : "重新检查"}
              </button>
            </>
          ) : (
            <>
              <button className="btn" onClick={dismissUpdate}>
                取消
              </button>
              <button className="btn primary" onClick={startUpdate}>
                更新
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
