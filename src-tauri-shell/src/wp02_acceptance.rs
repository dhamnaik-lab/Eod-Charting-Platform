use std::ffi::OsString;
use std::path::PathBuf;

use crate::database::{AcceptanceRegistry, AcceptanceSlot};
use crate::native_scanner::numeric_history::{self, NumericHistoryState};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};

const WINDOW: &str = "wp02-acceptance";

// An acceptance build always exits through this entry point, including on invalid arguments.
pub(super) fn launch(args: &[OsString]) {
    match run(args) {
        Ok(()) => std::process::exit(0),
        Err(error) => {
            eprintln!("WP-02 acceptance: {error}");
            std::process::exit(1);
        }
    }
}

fn run(args: &[OsString]) -> Result<(), String> {
    let [flag, a, b] = args else {
        return Err("Usage: --wp02-acceptance <database A folder> <database B folder>".into());
    };
    if flag != "--wp02-acceptance" {
        return Err("Expected --wp02-acceptance followed by two database folders.".into());
    }
    let registry = AcceptanceRegistry::new([PathBuf::from(a), PathBuf::from(b)])?;
    let webview_data = tempfile::Builder::new()
        .prefix("eod-wp02-webview-")
        .tempdir()
        .map_err(|error| error.to_string())?;
    let data_directory = webview_data.path().to_owned();
    tauri::Builder::default()
        .manage(registry)
        .manage(NumericHistoryState::default())
        .setup(move |app| {
            WebviewWindowBuilder::new(app, WINDOW, WebviewUrl::App("index.html".into()))
                .title("EOD Chart WP-02 Acceptance")
                .data_directory(data_directory)
                .inner_size(760.0, 400.0)
                .build()?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == WINDOW && matches!(event, WindowEvent::CloseRequested { .. }) {
                numeric_history::shutdown(&window.state::<NumericHistoryState>());
            }
        })
        .invoke_handler(tauri::generate_handler![
            select_wp02_database,
            numeric_history::native_numeric_history_capability_v2,
            numeric_history::start_native_numeric_history_v2,
            numeric_history::page_native_numeric_history_v2,
            numeric_history::close_native_numeric_history_v2,
        ])
        .run(tauri::generate_context!("wp02-acceptance/tauri.conf.json"))
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn select_wp02_database(app: AppHandle, slot: AcceptanceSlot) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || app.state::<AcceptanceRegistry>().select(slot))
        .await
        .map_err(|error| error.to_string())?
}
