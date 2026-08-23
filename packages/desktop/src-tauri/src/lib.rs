use std::fs;
use std::net::TcpListener;
use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{Manager, State};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

#[derive(Default, Serialize, Deserialize, Clone)]
pub struct Settings {
    pub root: Option<String>,
    #[serde(rename = "gameId")]
    pub game_id: Option<String>,
}

struct Backend {
    port: u16,
    child: Mutex<Option<CommandChild>>,
}

fn free_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .and_then(|listener| listener.local_addr())
        .map(|addr| addr.port())
        .unwrap_or(7311)
}

fn settings_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("settings.json"))
}

#[tauri::command]
fn api_port(backend: State<'_, Backend>) -> u16 {
    backend.port
}

#[tauri::command]
fn read_settings(app: tauri::AppHandle) -> Result<Settings, String> {
    let path = settings_path(&app)?;
    match fs::read_to_string(path) {
        Ok(raw) => serde_json::from_str(&raw).map_err(|e| e.to_string()),
        Err(_) => Ok(Settings::default()),
    }
}

#[tauri::command]
fn write_settings(app: tauri::AppHandle, settings: Settings) -> Result<(), String> {
    let path = settings_path(&app)?;
    let raw = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(path, raw).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let port = free_port();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(Backend {
            port,
            child: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![api_port, read_settings, write_settings])
        .setup(move |app| {
            let sidecar = app
                .shell()
                .sidecar("truck-save-server")?
                .env("PORT", port.to_string());
            let (_rx, child) = sidecar.spawn()?;
            app.state::<Backend>()
                .child
                .lock()
                .expect("backend lock")
                .replace(child);
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if let Some(child) = window
                    .state::<Backend>()
                    .child
                    .lock()
                    .expect("backend lock")
                    .take()
                {
                    let _ = child.kill();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running the save editor");
}
