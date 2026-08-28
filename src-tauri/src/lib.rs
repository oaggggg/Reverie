#[cfg(debug_assertions)]
use std::path::PathBuf;
use std::path::Path;
use std::sync::Mutex;
use tauri::{webview::PageLoadEvent, AppHandle, Manager, Window};
use tauri_plugin_shell::{
    process::{CommandChild, CommandEvent},
    ShellExt,
};

// NCM API 服务器进程
struct ApiServer(Mutex<Option<CommandChild>>);

const API_PORT: u16 = 3939;
const API_HOST: &str = "127.0.0.1";

/// 开发模式防白屏：dev 窗口加载 devUrl（tauri.conf.json 的 devUrl，
/// 两处需保持一致）失败时页面是 ERR_CONNECTION_REFUSED 白屏且不会
/// 自行恢复。这里在启动前等待 vite 就绪，并对失败加载自动重试。
#[cfg(debug_assertions)]
mod dev_guard {
    use std::net::TcpStream;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::time::Duration;

    pub const DEV_URL: &str = "http://127.0.0.1:5173";
    /// vite 不可达时的重导航上限：超过后放弃并显示错误页，不再无限白屏。
    const MAX_NAV_RETRIES: usize = 60;

    static NAV_RETRIES: AtomicUsize = AtomicUsize::new(0);

    fn reachable() -> bool {
        let addr = "127.0.0.1:5173".parse().expect("static dev addr");
        TcpStream::connect_timeout(&addr, Duration::from_millis(400)).is_ok()
    }

    /// 阻塞等待 dev server 就绪（最多 ~40s）。tauri CLI 通常已保证
    /// 就绪，这里兜住手动启动 app.exe、vite 重启竞态、孤儿窗口重开等
    /// 仍然会撞上"先起窗、后起服务"的场景。
    pub fn wait_for_dev_server() {
        for _ in 0..200 {
            if reachable() {
                return;
            }
            std::thread::sleep(Duration::from_millis(200));
        }
        log::warn!("dev server {DEV_URL} 在 40s 内未就绪，仍继续启动");
    }

    /// 页面加载结束后调用：vite 可达则复位重试计数并放行显示；
    /// 不可达则延迟 1s 重新导航（错误页对用户无意义），超过上限才
    /// 放行显示连接错误页。返回 true 表示可以显示窗口。
    pub fn on_page_finished(webview: &tauri::Webview) -> bool {
        if reachable() {
            NAV_RETRIES.store(0, Ordering::Relaxed);
            return true;
        }
        if NAV_RETRIES.load(Ordering::Relaxed) >= MAX_NAV_RETRIES {
            log::error!("dev server {DEV_URL} 持续不可达，停止重试");
            return true;
        }
        NAV_RETRIES.fetch_add(1, Ordering::Relaxed);
        let w = webview.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(1000));
            if let Ok(url) = tauri::Url::parse(DEV_URL) {
                let _ = w.navigate(url);
            }
        });
        false
    }
}

/// 每次启动随机生成的共享密钥：本地 sidecar 只接受携带该密钥的请求，
/// 防止用户浏览器中的任意网页跨域驱动本机 API。
struct ApiAuthToken(String);

/// 正常关闭时置位，阻止 Terminated 事件触发重启。
static SHUTTING_DOWN: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);
/// sidecar 意外退出只允许自动重启一次，防止崩溃循环。
static RESTARTED: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

fn generate_auth_token() -> String {
    let mut bytes = [0u8; 32];
    getrandom::getrandom(&mut bytes).expect("OS RNG failed");
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn sanitize_api_log(line: &[u8]) -> String {
    let text = String::from_utf8_lossy(line);
    let Some(start) = text.find("cookie=") else {
        return text.into_owned();
    };
    let value_start = start + "cookie=".len();
    let value_end = text[value_start..]
        .find('&')
        .map(|offset| value_start + offset)
        .unwrap_or(text.len());
    format!("{}[redacted]{}", &text[..value_start], &text[value_end..])
}

// 窗口控制命令
#[tauri::command]
fn minimize_window(window: Window) {
    if let Err(error) = window.minimize() {
        log::error!("Failed to minimize the main window: {error}");
    }
}

#[tauri::command]
fn maximize_window(window: Window) {
    let result = if window.is_maximized().unwrap_or(false) {
        window.unmaximize()
    } else {
        window.maximize()
    };
    if let Err(error) = result {
        log::error!("Failed to toggle maximize the main window: {error}");
    }
}

#[tauri::command]
fn close_window(window: Window) {
    if let Err(error) = window.close() {
        log::error!("Failed to close the main window: {error}");
    }
}

#[tauri::command]
fn is_maximized(window: Window) -> bool {
    window.is_maximized().unwrap_or(false)
}

#[tauri::command]
fn get_api_auth_token(token: tauri::State<ApiAuthToken>) -> String {
    token.0.clone()
}

/// 下载文件名白名单：只允许常见音频格式，杜绝渲染层被攻破后写任意可执行文件。
const ALLOWED_DOWNLOAD_EXTENSIONS: [&str; 8] =
    ["mp3", "flac", "ape", "wav", "m4a", "aac", "ogg", "wma"];

#[tauri::command]
fn save_download_file(
    path: String,
    data: Vec<u8>,
    append: Option<bool>,
) -> Result<(), String> {
    use std::io::Write;
    use std::path::{Component, PathBuf};

    let target = PathBuf::from(&path);
    if !target.is_absolute() {
        return Err("下载路径必须是绝对路径".into());
    }
    // 拒绝 ".." / "." 穿越组件，防止写到配置目录之外。
    if target
        .components()
        .any(|c| matches!(c, Component::ParentDir | Component::CurDir))
    {
        return Err("下载路径包含非法目录组件".into());
    }
    if !target
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .map_or(false, |extension| {
            ALLOWED_DOWNLOAD_EXTENSIONS.contains(&extension.as_str())
        })
    {
        return Err("不支持的下载文件类型".into());
    }

    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("创建下载目录失败: {e}"))?;
    }
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create(true)
        .append(append.unwrap_or(false))
        .truncate(!append.unwrap_or(false))
        .open(&target)
        .map_err(|e| format!("打开歌曲文件失败: {e}"))?;
    file.write_all(&data).map_err(|e| format!("写入歌曲文件失败: {e}"))
}

// 检查端口是否被占用
fn is_port_available(port: u16) -> bool {
    !port_check::is_port_reachable(format!("127.0.0.1:{}", port))
}

/// Wallpaper Engine（Steam 创意工坊 app 431960）壁纸条目。
#[derive(serde::Serialize)]
struct WallpaperEngineItem {
    id: String,
    title: String,
    /// "video"（本地视频，可直接 <video> 播放）或 "web"（网页壁纸，iframe 加载）。
    kind: String,
    /// 可渲染文件的本机绝对路径。
    path: String,
    /// 预览图绝对路径，可能为空。
    preview: String,
}

/// 从注册表读取 Steam 安装目录（Steam 可装在任意盘符，
/// 例如 D:\Steam，不能只依赖 ProgramFiles 环境变量）。
#[cfg(windows)]
fn steam_install_from_registry() -> Option<PathBuf> {
    use winreg::enums::*;
    use winreg::RegKey;
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok(key) = hkcu.open_subkey("Software\\Valve\\Steam") {
        if let Ok(path) = key.get_value::<String, _>("SteamPath") {
            if !path.trim().is_empty() {
                return Some(PathBuf::from(path));
            }
        }
    }
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    if let Ok(key) = hklm.open_subkey("SOFTWARE\\WOW6432Node\\Valve\\Steam") {
        if let Ok(path) = key.get_value::<String, _>("InstallPath") {
            if !path.trim().is_empty() {
                return Some(PathBuf::from(path));
            }
        }
    }
    None
}

/// 解析 Steam 库根目录：注册表安装位置 + 默认位置 + libraryfolders.vdf
/// 登记的其它库。
fn steam_library_roots() -> Vec<PathBuf> {
    let mut roots: Vec<PathBuf> = Vec::new();
    fn push(roots: &mut Vec<PathBuf>, path: PathBuf) {
        if path.is_dir() && !roots.contains(&path) {
            roots.push(path);
        }
    }
    // 注册表最可靠：无论装在哪个盘都能拿到（值形如 d:/steam）。
    #[cfg(windows)]
    if let Some(path) = steam_install_from_registry() {
        push(&mut roots, path);
    }
    if let Ok(program_files) = std::env::var("ProgramFiles(x86)") {
        push(&mut roots, Path::new(&program_files).join("Steam"));
    }
    push(&mut roots, PathBuf::from("C:\\Program Files (x86)\\Steam"));
    // libraryfolders.vdf 用 "path"  "D:\\..." 逐行列出所有库；主库的
    // vdf 一定存在，逐个候选目录尝试读取直到命中。
    let candidates = roots.clone();
    for root in candidates {
        let vdf = root.join("steamapps").join("libraryfolders.vdf");
        let Ok(content) = std::fs::read_to_string(&vdf) else {
            continue;
        };
        for line in content.lines() {
            let trimmed = line.trim();
            if let Some(rest) = trimmed.strip_prefix("\"path\"") {
                let path = rest.trim().trim_matches('"');
                if !path.is_empty() {
                    push(&mut roots, PathBuf::from(path));
                }
            }
        }
        break;
    }
    roots
}

/// 扫描 Wallpaper Engine 创意工坊，返回播放页能直接渲染的 mp4 视频壁纸。
/// web / scene 等其它类型一律不获取。
fn scan_wallpaper_engine_items() -> Vec<WallpaperEngineItem> {
    let mut items = Vec::new();
    for root in steam_library_roots() {
        let workshop = root
            .join("steamapps")
            .join("workshop")
            .join("content")
            .join("431960");
        let Ok(entries) = std::fs::read_dir(&workshop) else {
            continue;
        };
        for entry in entries.flatten() {
            let dir = entry.path();
            if !dir.is_dir() {
                continue;
            }
            let Ok(raw) = std::fs::read_to_string(dir.join("project.json")) else {
                continue;
            };
            let Ok(project) = serde_json::from_str::<serde_json::Value>(&raw) else {
                continue;
            };
            let kind = match project.get("type").and_then(|v| v.as_str()) {
                Some("video") => "video",
                // 仅获取视频壁纸；网页/其它类型不纳入。
                _ => continue,
            };
            let file = project.get("file").and_then(|v| v.as_str()).unwrap_or("");
            if file.is_empty() {
                continue;
            }
            // project.json 里的路径写的是正斜杠，Windows 下 Path::join 兼容。
            let path = dir.join(file);
            if !path.is_file() {
                continue;
            }
            // 视频壁纸仅支持 mp4（清晰度/分辨率不限）；webm 等其它
            // 容器 WebView 解码兼容性差，交给官方运行时。
            if !path
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| e.eq_ignore_ascii_case("mp4"))
                .unwrap_or(false)
            {
                continue;
            }
            let title = project
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .trim()
                .to_string();
            let title = if title.is_empty() {
                dir.file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default()
            } else {
                title
            };
            let preview = project
                .get("preview")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let preview_path = dir.join(preview);
            let preview = if !preview.is_empty() && preview_path.is_file() {
                preview_path.to_string_lossy().to_string()
            } else {
                String::new()
            };
            let id = dir
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            items.push(WallpaperEngineItem {
                id,
                title,
                kind: kind.to_string(),
                path: path.to_string_lossy().to_string(),
                preview,
            });
        }
    }
    items.sort_by(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase()));
    items
}

/// 扫描并把每个壁纸涉及的文件在运行时加入 asset 协议白名单。
/// Steam 库可能装在任意盘符，静态 scope 无法穷举，逐文件放行最精确。
#[tauri::command]
fn list_wallpaper_engine_wallpapers(app: tauri::AppHandle) -> Vec<WallpaperEngineItem> {
    let items = scan_wallpaper_engine_items();
    let scope = app.asset_protocol_scope();
    for item in &items {
        let _ = scope.allow_file(Path::new(&item.path));
        if !item.preview.is_empty() {
            let _ = scope.allow_file(Path::new(&item.preview));
        }
    }
    items
}

/// 用本实例的密钥探测占用端口的服务是否是"我们自己的 sidecar"。
/// 只有携带正确 x-reverie-auth 的 /reverie/health 才会返回 200；
/// 旧实例/无关进程都无法通过，避免盲目复用未知服务并泄露会话 cookie。
fn probe_sidecar_health(token: &str) -> bool {
    use std::io::{Read, Write};
    use std::net::TcpStream;

    let Ok(mut stream) = TcpStream::connect((API_HOST, API_PORT)) else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(std::time::Duration::from_secs(2)));
    let request = format!(
        "GET /reverie/health HTTP/1.1\r\nHost: {API_HOST}:{API_PORT}\r\nx-reverie-auth: {token}\r\nConnection: close\r\n\r\n"
    );
    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }
    let mut response = String::new();
    if stream.read_to_string(&mut response).is_err() {
        return false;
    }
    // 除了 HTTP 200，还必须返回 sidecar 健康检查的约定响应体 {"ok":true}：
    // 端口上若有对任何请求都回 200 的无关服务（如测试 mock），仅凭状态码
    // 会被误判成自己的 sidecar，导致全部请求拿到假数据。
    let status_ok =
        response.starts_with("HTTP/1.1 200") || response.starts_with("HTTP/1.0 200");
    let body_ok = response
        .split_once("\r\n\r\n")
        .map(|(_, body)| body.contains("\"ok\"") && body.contains("true"))
        .unwrap_or(false);
    status_ok && body_ok
}

// 启动 NCM API 服务器
fn start_ncm_api_server(app: &AppHandle) -> Result<Option<CommandChild>, String> {
    let token = app.state::<ApiAuthToken>().0.clone();
    // 检查端口
    if !is_port_available(API_PORT) {
        // relaunch 更新后，旧实例的 sidecar 依赖 PARENT_PID 看门狗（最长 1s）退出，
        // 此刻端口可能仍被占用；短暂等待后复查。
        std::thread::sleep(std::time::Duration::from_millis(1200));
        if !is_port_available(API_PORT) {
            // 再给旧 sidecar 一点退出时间；期间反复用健康检查确认身份。
            for _ in 0..4 {
                if probe_sidecar_health(&token) {
                    log::warn!("Port {} in use by our API server, reusing it", API_PORT);
                    return Ok(None);
                }
                if is_port_available(API_PORT) {
                    break;
                }
                std::thread::sleep(std::time::Duration::from_millis(700));
            }
            if !probe_sidecar_health(&token) {
                return Err(format!(
                    "Port {} is occupied by an unknown process; refusing to send \
                     credentials to it. Close the process using port {} and restart.",
                    API_PORT, API_PORT
                ));
            }
            log::warn!("Port {} in use by our API server, reusing it", API_PORT);
            return Ok(None);
        }
    }

    #[cfg(debug_assertions)]
    let command = {
        let script = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .ok_or_else(|| "Cannot resolve project root".to_string())?
            .join("sidecar")
            .join("api-server.cjs");
        app.shell().command("node").arg(script)
    };

    #[cfg(not(debug_assertions))]
    let command = app
        .shell()
        .sidecar("reverie-api")
        .map_err(|e| format!("Cannot resolve API sidecar: {e}"))?;

    let (mut events, child) = command
        .env("PORT", API_PORT.to_string())
        .env("HOST", API_HOST)
        .env("PARENT_PID", std::process::id().to_string())
        .env("REVERIE_AUTH_TOKEN", &token)
        .env("REVERIE_ALLOW_UNAUTH", if cfg!(debug_assertions) { "1" } else { "0" })
        .spawn()
        .map_err(|e| format!("Failed to start API sidecar: {e}"))?;

    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = events.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    log::info!("API: {}", sanitize_api_log(&line));
                }
                CommandEvent::Stderr(line) => {
                    log::warn!("API: {}", sanitize_api_log(&line));
                }
                CommandEvent::Error(error) => log::error!("API sidecar error: {error}"),
                CommandEvent::Terminated(payload) => {
                    log::warn!("API sidecar exited with code {:?}", payload.code);
                    // sidecar 意外退出后重启一次，恢复所有 API 请求；
                    // 正常关闭流程会先置位 SHUTTING_DOWN，不会走到这里。
                    if SHUTTING_DOWN.load(std::sync::atomic::Ordering::SeqCst)
                        || RESTARTED.swap(true, std::sync::atomic::Ordering::SeqCst)
                    {
                        continue;
                    }
                    let handle = app_handle.clone();
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_millis(800));
                        match start_ncm_api_server(&handle) {
                            Ok(Some(child)) => {
                                if let Some(api) = handle.try_state::<ApiServer>() {
                                    if let Ok(mut guard) = api.0.lock() {
                                        *guard = Some(child);
                                    }
                                }
                                log::info!("API server restarted");
                            }
                            Ok(None) => log::info!("API server reused after restart"),
                            Err(error) => {
                                log::error!("Failed to restart API server: {error}")
                            }
                        }
                    });
                }
                _ => {}
            }
        }
    });

    log::info!("NCM API server started on {}:{}", API_HOST, API_PORT);
    Ok(Some(child))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(debug_assertions)]
    dev_guard::wait_for_dev_server();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .on_page_load(|webview, payload| {
            if payload.event() == PageLoadEvent::Finished {
                #[cfg(debug_assertions)]
                if !dev_guard::on_page_finished(webview) {
                    // dev server 不可达：已安排重导航，窗口保持隐藏，
                    // 避免把 ERR_CONNECTION_REFUSED 白屏闪给用户。
                    return;
                }
                if let Err(error) = webview.window().show() {
                    log::error!("Failed to show the main window: {error}");
                }
            }
        })
        .setup(|app| {
            // 日志插件始终启用：release 版保留 warn/error，避免生产环境零诊断。
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(if cfg!(debug_assertions) {
                        log::LevelFilter::Info
                    } else {
                        log::LevelFilter::Warn
                    })
                    .build(),
            )?;

            let token = generate_auth_token();
            app.manage(ApiAuthToken(token));

            // 启动 NCM API 服务器
            match start_ncm_api_server(app.handle()) {
                Ok(Some(child)) => {
                    app.manage(ApiServer(Mutex::new(Some(child))));
                    log::info!("API server started successfully");
                }
                Ok(None) => {
                    app.manage(ApiServer(Mutex::new(None)));
                    log::warn!("Reusing existing API server on port {}", API_PORT);
                }
                Err(e) => {
                    log::error!("Failed to start API server: {}", e);
                    return Err(Box::new(std::io::Error::new(std::io::ErrorKind::Other, e)));
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            minimize_window,
            maximize_window,
            close_window,
            is_maximized,
            get_api_auth_token,
            save_download_file,
            list_wallpaper_engine_wallpapers
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                // 置位关闭标记，阻止 sidecar Terminated 事件触发重启。
                SHUTTING_DOWN.store(true, std::sync::atomic::Ordering::SeqCst);
                // 清理 API 服务器
                if let Some(api_server) = window.app_handle().try_state::<ApiServer>() {
                    if let Ok(mut child) = api_server.0.lock() {
                        if let Some(process) = child.take() {
                            let _ = process.kill();
                            log::info!("API server stopped");
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 本机存在 Wallpaper Engine 工坊内容时，扫描必须能找到
    /// 视频/网页壁纸（覆盖 Steam 装在非默认盘符的场景）。
    #[test]
    fn scan_finds_workshop_wallpapers() {
        let roots = steam_library_roots();
        println!("steam roots: {:?}", roots);
        let has_workshop = roots.iter().any(|root| {
            root.join("steamapps")
                .join("workshop")
                .join("content")
                .join("431960")
                .is_dir()
        });
        let items = scan_wallpaper_engine_items();
        println!("scanned {} video/web wallpapers", items.len());
        for item in items.iter().take(8) {
            println!("  [{}] {} -> {}", item.kind, item.title, item.path);
        }
        if has_workshop {
            assert!(
                !items.is_empty(),
                "本机存在 Wallpaper Engine 工坊内容，但视频/网页壁纸扫描结果为空"
            );
        }
    }
}
