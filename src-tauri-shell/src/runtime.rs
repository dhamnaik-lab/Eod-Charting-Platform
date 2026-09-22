use chrono::Local;
use serde::Serialize;
use std::env;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

type AppResult<T> = Result<T, String>;

const PORTABLE_ENV_VAR: &str = "EOD_CHART_PORTABLE_ROOT";
pub(crate) const PORTABLE_DATA_DIR_NAME: &str = "portable-data";
const APP_PROFILE_DIRECTORY_NAME: &str = "EOD Chart Profile";
const STATE_DIR_NAME: &str = "state";
const LOG_DIR_NAME: &str = "logs";
const RUNTIME_LOG_FILE_NAME: &str = "app-runtime.log";

#[derive(Clone, Debug)]
pub(crate) struct RuntimeContext {
    pub data_mode: &'static str,
    pub build_profile: &'static str,
    pub data_dir: PathBuf,
    pub state_dir: PathBuf,
    pub log_dir: PathBuf,
    pub log_file: PathBuf,
    pub executable_dir: PathBuf,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeDiagnostics {
    pub data_mode: &'static str,
    pub build_profile: &'static str,
    pub data_dir: String,
    pub state_dir: String,
    pub log_dir: String,
    pub log_file: String,
    pub executable_dir: String,
}

impl RuntimeContext {
    pub fn diagnostics(&self) -> RuntimeDiagnostics {
        RuntimeDiagnostics {
            data_mode: self.data_mode,
            build_profile: self.build_profile,
            data_dir: path_to_string(&self.data_dir),
            state_dir: path_to_string(&self.state_dir),
            log_dir: path_to_string(&self.log_dir),
            log_file: path_to_string(&self.log_file),
            executable_dir: path_to_string(&self.executable_dir),
        }
    }
}

pub(crate) fn resolve_runtime_context(app: &AppHandle) -> AppResult<RuntimeContext> {
    let executable_path = env::current_exe()
        .map_err(|error| format!("Unable to resolve the executable path: {error}"))?;
    let executable_dir = executable_path
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "Unable to resolve the executable directory.".to_string())?;

    let build_profile = if cfg!(debug_assertions) {
        "debug"
    } else {
        "release"
    };

    if let Some(portable_root) = resolve_portable_root(&executable_dir) {
        ensure_directory(&portable_root, "portable data directory")?;
        let state_dir = portable_root.join(STATE_DIR_NAME);
        let log_dir = resolve_default_profile_log_dir(app)?;
        ensure_directory(&state_dir, "portable state directory")?;
        ensure_directory(&log_dir, "portable profile log directory")?;

        return Ok(RuntimeContext {
            data_mode: "portable",
            build_profile,
            data_dir: portable_root,
            state_dir,
            log_dir: log_dir.clone(),
            log_file: log_dir.join(RUNTIME_LOG_FILE_NAME),
            executable_dir,
        });
    }

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Unable to resolve the app data directory: {error}"))?;
    ensure_directory(&app_data_dir, "app data directory")?;
    let state_dir = app_data_dir.join(STATE_DIR_NAME);
    let log_dir = app_data_dir.join(LOG_DIR_NAME);
    ensure_directory(&state_dir, "state directory")?;
    ensure_directory(&log_dir, "log directory")?;

    Ok(RuntimeContext {
        data_mode: "system",
        build_profile,
        data_dir: app_data_dir,
        state_dir,
        log_dir: log_dir.clone(),
        log_file: log_dir.join(RUNTIME_LOG_FILE_NAME),
        executable_dir,
    })
}

pub(crate) fn get_state_dir(app: &AppHandle) -> AppResult<PathBuf> {
    Ok(resolve_runtime_context(app)?.state_dir)
}

pub(crate) fn log_runtime_event(
    app: &AppHandle,
    level: &str,
    message: &str,
    details: Option<&str>,
) {
    let Ok(context) = resolve_runtime_context(app) else {
        return;
    };

    let timestamp = Local::now().format("%Y-%m-%dT%H:%M:%S%.3f%:z");
    let mut line = format!("[{timestamp}] [{level}] {message}");
    if let Some(details) = details.filter(|value| !value.trim().is_empty()) {
        line.push_str(" | ");
        line.push_str(details.trim());
    }
    line.push('\n');

    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&context.log_file)
    {
        let _ = file.write_all(line.as_bytes());
    }
}

pub(crate) fn format_startup_error(error: &str) -> String {
    [
        "EOD Chart could not start.",
        "",
        error,
        "",
        "Portable mode uses a 'portable-data' folder next to the executable, or the EOD_CHART_PORTABLE_ROOT environment variable.",
        "Make sure the selected location is writable and not blocked by Windows permissions.",
    ]
    .join("\n")
}

fn resolve_portable_root(executable_dir: &Path) -> Option<PathBuf> {
    let env_value = env::var(PORTABLE_ENV_VAR)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());

    if let Some(value) = env_value {
        let candidate = PathBuf::from(value);
        return Some(if candidate.is_absolute() {
            candidate
        } else {
            executable_dir.join(candidate)
        });
    }

    let sibling_portable_dir = executable_dir.join(PORTABLE_DATA_DIR_NAME);
    if sibling_portable_dir.exists() {
        return Some(sibling_portable_dir);
    }

    None
}

fn resolve_default_profile_log_dir(app: &AppHandle) -> AppResult<PathBuf> {
    let documents_directory = app
        .path()
        .document_dir()
        .map_err(|error| format!("Unable to resolve the Documents directory: {error}"))?;
    Ok(documents_directory
        .join(APP_PROFILE_DIRECTORY_NAME)
        .join(LOG_DIR_NAME))
}

fn ensure_directory(path: &Path, label: &str) -> AppResult<()> {
    fs::create_dir_all(path)
        .map_err(|error| format!("Unable to create {label} at {}: {error}", path.display()))
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}
