use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

mod db;
mod gemini;
mod intent;

// ── App state ─────────────────────────────────────────────────────────────────

pub struct AppState {
    pub db: db::Db,
}

impl AppState {
    fn new() -> Self {
        let db_path = data_path("david.db");
        let db = db::Db::open(&db_path).expect("Failed to open database");
        AppState { db }
    }
}

fn data_path(filename: &str) -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("david")
        .join(filename)
}

// ── Response types ────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
pub struct CommandResponse {
    pub reply: String,
    pub source: String,
    pub action: Option<String>,
    pub opened_url: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct Stats {
    pub local_count: i64,
    pub gemini_count: i64,
    pub task_count: i64,
}

// ── Tauri commands ────────────────────────────────────────────────────────────

#[tauri::command]
async fn process_command(
    query: String,
    state: tauri::State<'_, AppState>,
) -> Result<CommandResponse, String> {
    // 1. Try local intent router
    if let Some(mut matched) = intent::route(&query) {
        // For play_favourites: resolve URL from stored setting
        if matched.action == "play_favourites" {
            let stored_url = state
                .db
                .get_config("music_playlist_url")
                .ok()
                .flatten()
                .unwrap_or_else(|| "https://music.youtube.com/".into());
            matched.open_url = Some(stored_url);
        }

        // Side-effect: create task in DB
        if matched.action == "task_add" {
            if let Some(text) = &matched.task_text {
                state.db.create_task(text).map_err(|e| e.to_string())?;
            }
        }

        // Side-effect: learn preference
        if let Some((cat, platform)) = &matched.preference {
            state.db.upsert_preference(cat, platform).ok();
        }

        // Side-effect: open URL in default browser
        let opened_url = matched.open_url.clone();
        if let Some(ref url) = opened_url {
            let url_clone = url.clone();
            std::thread::spawn(move || {
                let _ = open::that(url_clone);
            });
        }

        state
            .db
            .add_log(
                &query,
                "local",
                &matched.reply,
                Some(&matched.pattern),
                Some(&matched.action),
            )
            .map_err(|e| e.to_string())?;

        return Ok(CommandResponse {
            reply: matched.reply,
            source: "local".into(),
            action: Some(matched.action),
            opened_url,
        });
    }

    // 2. Fall back to Gemini
    let api_key = state
        .db
        .get_config("gemini_api_key")
        .map_err(|e| e.to_string())?
        .unwrap_or_default();

    if api_key.is_empty() {
        let reply =
            "No Gemini API key set. Open settings (gear icon) and paste your key.".to_string();
        state.db.add_log(&query, "local", &reply, None, None).ok();
        return Ok(CommandResponse {
            reply,
            source: "local".into(),
            action: None,
            opened_url: None,
        });
    }

    let prefs = state.db.get_preferences().unwrap_or_default();

    match gemini::ask(&query, &api_key, &prefs).await {
        Ok(reply) => {
            state
                .db
                .add_log(&query, "gemini", &reply, None, None)
                .map_err(|e| e.to_string())?;
            Ok(CommandResponse {
                reply,
                source: "gemini".into(),
                action: None,
                opened_url: None,
            })
        }
        Err(e) => Err(e),
    }
}

#[tauri::command]
fn get_tasks(state: tauri::State<'_, AppState>) -> Result<Vec<db::Task>, String> {
    state.db.get_tasks().map_err(|e| e.to_string())
}

#[tauri::command]
fn create_task(text: String, state: tauri::State<'_, AppState>) -> Result<db::Task, String> {
    state.db.create_task(&text).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_task(
    id: i64,
    completed: bool,
    state: tauri::State<'_, AppState>,
) -> Result<Option<db::Task>, String> {
    state.db.update_task(id, completed).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_task(id: i64, state: tauri::State<'_, AppState>) -> Result<(), String> {
    state.db.delete_task(id).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_command_logs(limit: i64, state: tauri::State<'_, AppState>) -> Result<Vec<db::CommandLog>, String> {
    state.db.get_logs(limit).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_stats(state: tauri::State<'_, AppState>) -> Result<Stats, String> {
    let logs = state.db.get_logs(1000).map_err(|e| e.to_string())?;
    let tasks = state.db.get_tasks().map_err(|e| e.to_string())?;
    Ok(Stats {
        local_count: logs.iter().filter(|l| l.source == "local").count() as i64,
        gemini_count: logs.iter().filter(|l| l.source == "gemini").count() as i64,
        task_count: tasks.len() as i64,
    })
}

#[tauri::command]
fn get_gemini_key(state: tauri::State<'_, AppState>) -> Result<Option<String>, String> {
    state.db.get_config("gemini_api_key").map_err(|e| e.to_string())
}

#[tauri::command]
fn set_gemini_key(key: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
    state.db.set_config("gemini_api_key", &key).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_music_url(state: tauri::State<'_, AppState>) -> Result<Option<String>, String> {
    state.db.get_config("music_playlist_url").map_err(|e| e.to_string())
}

#[tauri::command]
fn set_music_url(url: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
    state.db.set_config("music_playlist_url", &url).map_err(|e| e.to_string())
}

/// Show the always-on-top wake overlay for 2 seconds, then auto-hide it.
#[tauri::command]
fn show_wake_overlay(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(overlay) = app.get_webview_window("overlay") {
        overlay.show().map_err(|e| e.to_string())?;
        let o = overlay.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(2200));
            let _ = o.hide();
        });
    }
    Ok(())
}

// ── App entry point ───────────────────────────────────────────────────────────

pub fn run() {
    tauri::Builder::default()
        .manage(AppState::new())
        .setup(|app| {
            // ── Overlay window (always-on-top badge, shown on wake word) ──
            #[cfg(debug_assertions)]
            let overlay_url = tauri::WebviewUrl::External(
                "http://localhost:1420/overlay.html"
                    .parse()
                    .expect("overlay url"),
            );
            #[cfg(not(debug_assertions))]
            let overlay_url = tauri::WebviewUrl::App(std::path::PathBuf::from("overlay.html"));

            let _ = tauri::WebviewWindowBuilder::new(app, "overlay", overlay_url)
                .title("")
                .inner_size(220.0, 56.0)
                .position(16.0, 16.0)
                .decorations(false)
                .always_on_top(true)
                .resizable(false)
                .visible(false)
                .skip_taskbar(true)
                .build();

            // ── Hide the main window — appears on tray click ──────────────
            if let Some(window) = app.get_webview_window("main") {
                window.hide()?;
            }

            // ── Build tray context menu ───────────────────────────────────
            let show = MenuItem::with_id(app, "show", "Show david", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            TrayIconBuilder::new()
                .tooltip("david")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => toggle_window(app),
                    "quit" => std::process::exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_window(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        // Hide to tray instead of closing
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                window.hide().unwrap();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            process_command,
            get_tasks,
            create_task,
            update_task,
            delete_task,
            get_command_logs,
            get_stats,
            get_gemini_key,
            set_gemini_key,
            get_music_url,
            set_music_url,
            show_wake_overlay,
        ])
        .run(tauri::generate_context!())
        .expect("error while running david");
}

fn toggle_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}
