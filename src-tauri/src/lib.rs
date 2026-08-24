#[cfg(debug_assertions)]
use std::path::PathBuf;
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
fn save_download_file(path: String, data: Vec<u8>) -> Result<(), String> {
    let target = std::path::PathBuf::from(path);
    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("创建下载目录失败: {e}"))?;
    }
    std::fs::write(&target, data).map_err(|e| format!("写入歌曲文件失败: {e}"))
}

// 检查端口是否被占用
fn is_port_available(port: u16) -> bool {
    !port_check::is_port_reachable(format!("127.0.0.1:{}", port))
}

// 启动 NCM API 服务器
fn start_ncm_api_server(app: &AppHandle) -> Result<Option<CommandChild>, String> {
    // 检查端口
    if !is_port_available(API_PORT) {
        // relaunch 更新后，旧实例的 sidecar 依赖 PARENT_PID 看门狗（最长 1s）退出，
        // 此刻端口可能仍被占用；短暂等待后复查，避免误判后新实例永久没有 API server。
        std::thread::sleep(std::time::Duration::from_millis(1200));
        if !is_port_available(API_PORT) {
            log::warn!(
                "Port {} already in use, assuming API server is running",
                API_PORT
            );
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
        .spawn()
        .map_err(|e| format!("Failed to start API sidecar: {e}"))?;

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
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .on_page_load(|webview, payload| {
            if payload.event() == PageLoadEvent::Finished {
                if let Err(error) = webview.window().show() {
                    log::error!("Failed to show the main window: {error}");
                }
            }
        })
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

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
            save_download_file
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
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
