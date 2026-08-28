import { useCallback, useEffect, useRef, useState } from "react";
import { qrCheck, qrCreate, qrKey } from "../api/client";
import { usePlayerStore } from "../store/playerStore";
import { RefreshCw } from "lucide-react";
import { useOriginTransition } from "../utils/originTransition";
import { useModalBehavior } from "../utils/modalBehavior";

type QrState =
  "loading" | "waiting" | "scanned" | "expired" | "success" | "error";

export default function LoginModal() {
  const showLogin = usePlayerStore((s) => s.showLogin);
  const setShowLogin = usePlayerStore((s) => s.setShowLogin);
  const applyLogin = usePlayerStore((s) => s.applyLogin);
  const toast = usePlayerStore((s) => s.toast);

  const [qrimg, setQrimg] = useState("");
  const [qrurl, setQrurl] = useState("");
  const [status, setStatus] = useState<QrState>("loading");
  const keyRef = useRef("");
  const timerRef = useRef<number | null>(null);
  const refreshRef = useRef<number | null>(null);
  const aliveRef = useRef(true);
  const pollRef = useRef<() => void>(() => {});
  const startQrGenRef = useRef(0);
  const transition = useOriginTransition<HTMLDivElement>(
    showLogin,
    "login",
    220,
  );
  useModalBehavior(showLogin, transition.surfaceRef, () => setShowLogin(false));

  const stopPolling = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (refreshRef.current) {
      clearTimeout(refreshRef.current);
      refreshRef.current = null;
    }
  };

  const startQr = useCallback(async () => {
    // Polling must not continue against the previous key: an expired one keeps
    // answering 800, which would queue a new refresh on every tick.
    const generation = ++startQrGenRef.current;
    stopPolling();
    setStatus("loading");
    try {
      const key = await qrKey();
      if (generation !== startQrGenRef.current) return;
      keyRef.current = key;
      const { qrimg: img, qrurl: url } = await qrCreate(key);
      if (!aliveRef.current || generation !== startQrGenRef.current) return;
      setQrimg(img);
      setQrurl(url);
      setStatus("waiting");
      timerRef.current = window.setInterval(() => {
        if (aliveRef.current) pollRef.current();
      }, 2200);
    } catch {
      if (generation !== startQrGenRef.current) return;
      setStatus("error");
      toast("获取二维码失败，请检查网络", "error");
    }
  }, [toast]);

  const poll = useCallback(async () => {
    if (!keyRef.current) return;
    try {
      const res = await qrCheck(keyRef.current);
      const code = res.code;
      if (code === 803) {
        stopPolling();
        setStatus("success");
        const ok = await applyLogin(res.cookie ?? "");
        if (ok) {
          toast("登录成功", "success");
          setTimeout(() => setShowLogin(false), 600);
        } else {
          setStatus("error");
          toast("登录信息校验失败，请重试", "error");
        }
      } else if (code === 800) {
        stopPolling();
        setStatus("expired");
        // auto-refresh
        refreshRef.current = window.setTimeout(() => {
          if (aliveRef.current) startQr();
        }, 1200);
      } else if (code === 802) {
        setStatus("scanned");
      } else if (code === 801) {
        setStatus("waiting");
      }
    } catch {
      /* transient network error: keep polling */
    }
  }, [applyLogin, startQr, toast, setShowLogin]);

  useEffect(() => {
    pollRef.current = poll;
  }, [poll]);

  useEffect(() => {
    if (!showLogin) {
      stopPolling();
      return;
    }
    // startQr installs the polling interval once it holds a fresh key.
    aliveRef.current = true;
    startQr();
    return () => {
      aliveRef.current = false;
      stopPolling();
    };
  }, [showLogin, startQr]);

  if (!transition.rendered) return null;

  const statusText: Record<QrState, string> = {
    loading: "正在生成二维码…",
    waiting: "请使用网易云音乐 App 扫码登录",
    scanned: "已扫码，请在手机上确认登录",
    expired: "二维码已过期，正在刷新…",
    success: "登录成功！",
    error: "获取二维码失败，请点击下方重试",
  };

  return (
    <div
      className={`modal-backdrop login-backdrop ${transition.backdropClassName}`}
      onClick={() => setShowLogin(false)}
    >
      <div
        ref={transition.surfaceRef}
        className={`modal ${transition.surfaceClassName}`}
        role="dialog"
        aria-modal="true"
        aria-label="扫码登录"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ textAlign: "center", marginBottom: 20 }}>扫码登录</h2>
        <div className="qr-box">
          <div className="qr-img-wrap">
            {qrimg ? (
              <img
                src={qrimg}
                alt="登录二维码"
                className={status === "expired" ? "qr-blurred" : ""}
                style={{ opacity: status === "error" ? 0.4 : 1 }}
              />
            ) : (
              <div
                style={{
                  width: 220,
                  height: 220,
                  borderRadius: 12,
                  background: "var(--bg-3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-faint)",
                }}
              >
                {status === "error" ? "二维码加载失败" : "加载中…"}
              </div>
            )}
            {status === "expired" && (
              <div className="qr-expired-tip">
                二维码已失效
                <br />
                正在刷新…
              </div>
            )}
          </div>
          <div className={`qr-status ${status === "success" ? "ok" : ""}`}>
            {statusText[status]}
          </div>
          {(status === "error" || status === "expired") && (
            <button className="btn" onClick={startQr}>
              <RefreshCw size={15} /> 刷新二维码
            </button>
          )}
          {qrurl && (
            <a
              href={qrurl}
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--accent-2)", fontSize: 12 }}
              onClick={(e) => {
                // open in external browser via window.open handler in main
                window.open(qrurl, "_blank");
                e.preventDefault();
              }}
            >
              无法扫码？点此在浏览器中打开
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
