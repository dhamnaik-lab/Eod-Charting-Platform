use crate::database::{with_active_connection, OperationResult, DATABASE_REGISTRY_FILE};
use crate::runtime::{get_state_dir, log_runtime_event};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

type AppResult<T> = Result<T, String>;

const APP_PROFILE_DIRECTORY_NAME: &str = "EOD Chart Profile";
const APP_PROFILE_POINTER_FILE_NAME: &str = "app-profile-location.json";
const APP_PROFILE_SETTINGS_FILE_NAME: &str = "app-settings.json";
const DEFAULT_THEME: &str = "midnight-slate-pro";
const DEFAULT_EXCHANGE: &str = "NSE";
const DEFAULT_CANDLE_UP_COLOR: &str = "#26a69a";
const DEFAULT_CANDLE_DOWN_COLOR: &str = "#ef5350";
const DEFAULT_GRID_COLOR: &str = "#1e2a3a";
const DEFAULT_CROSSHAIR_COLOR: &str = "#5588aa";

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppProfilePointerFile {
    profile_directory: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppProfileSettingsFile {
    theme: String,
    default_exchange: String,
    candle_up_color: String,
    candle_down_color: String,
    grid_color: String,
    crosshair_color: String,
    #[serde(default)]
    plugin_enabled: BTreeMap<String, bool>,
    #[serde(default)]
    plugin_configurations: BTreeMap<String, Value>,
    #[serde(default)]
    eod_alert_rules: Vec<Value>,
    #[serde(default)]
    eod_alert_history: Vec<Value>,
    #[serde(default)]
    scanner_workspace: Value,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppProfileSettingsPayload {
    pub theme: String,
    pub default_exchange: String,
    pub candle_up_color: String,
    pub candle_down_color: String,
    pub grid_color: String,
    pub crosshair_color: String,
    pub plugin_enabled: BTreeMap<String, bool>,
    pub plugin_configurations: BTreeMap<String, Value>,
    pub eod_alert_rules: Vec<Value>,
    pub eod_alert_history: Vec<Value>,
    pub scanner_workspace: Value,
    pub profile_directory: String,
    pub default_profile_directory: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppProfileSettingsSaveInput {
    pub theme: String,
    pub default_exchange: String,
    pub candle_up_color: String,
    pub candle_down_color: String,
    pub grid_color: String,
    pub crosshair_color: String,
    #[serde(default)]
    pub plugin_enabled: BTreeMap<String, bool>,
    #[serde(default)]
    pub plugin_configurations: BTreeMap<String, Value>,
    #[serde(default)]
    pub eod_alert_rules: Vec<Value>,
    #[serde(default)]
    pub eod_alert_history: Vec<Value>,
    #[serde(default)]
    pub scanner_workspace: Value,
    pub profile_directory: Option<String>,
}

#[tauri::command]
pub fn get_app_profile_settings(app: AppHandle) -> AppResult<AppProfileSettingsPayload> {
    let effective_profile_dir = get_app_profile_directory(&app)?;
    let default_profile_dir = get_default_app_profile_directory(&app)?;
    let settings = read_or_initialize_app_profile_settings(&app, &effective_profile_dir)?;

    Ok(AppProfileSettingsPayload {
        theme: settings.theme,
        default_exchange: settings.default_exchange,
        candle_up_color: settings.candle_up_color,
        candle_down_color: settings.candle_down_color,
        grid_color: settings.grid_color,
        crosshair_color: settings.crosshair_color,
        plugin_enabled: settings.plugin_enabled,
        plugin_configurations: settings.plugin_configurations,
        eod_alert_rules: settings.eod_alert_rules,
        eod_alert_history: settings.eod_alert_history,
        scanner_workspace: settings.scanner_workspace,
        profile_directory: path_to_string(&effective_profile_dir),
        default_profile_directory: path_to_string(&default_profile_dir),
    })
}

#[tauri::command]
pub fn save_app_profile_settings(
    app: AppHandle,
    input: AppProfileSettingsSaveInput,
) -> AppResult<OperationResult> {
    let current_profile_dir = get_app_profile_directory(&app)?;
    let default_profile_dir = get_default_app_profile_directory(&app)?;
    let requested_profile_dir = input
        .profile_directory
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| normalize_directory_path(PathBuf::from(value)))
        .transpose()?;
    let target_profile_dir = requested_profile_dir.unwrap_or(default_profile_dir);

    migrate_profile_state_if_needed(&current_profile_dir, &target_profile_dir)?;

    let next_settings = AppProfileSettingsFile {
        theme: input.theme,
        default_exchange: input.default_exchange,
        candle_up_color: input.candle_up_color,
        candle_down_color: input.candle_down_color,
        grid_color: input.grid_color,
        crosshair_color: input.crosshair_color,
        plugin_enabled: input.plugin_enabled,
        plugin_configurations: input.plugin_configurations,
        eod_alert_rules: input.eod_alert_rules,
        eod_alert_history: input.eod_alert_history,
        scanner_workspace: input.scanner_workspace,
    };

    write_app_profile_settings_file(&target_profile_dir, &next_settings)?;
    persist_profile_directory_pointer(&app, &target_profile_dir)?;

    log_runtime_event(
        &app,
        "INFO",
        "save-app-profile-settings",
        Some(&format!("profileDir={}", target_profile_dir.display())),
    );

    Ok(OperationResult { success: true })
}

#[tauri::command]
pub fn pick_app_profile_directory(app: AppHandle) -> AppResult<Option<String>> {
    let current_directory = get_app_profile_directory(&app).ok();
    let mut dialog = rfd::FileDialog::new().set_title("Select Application Profile Folder");
    if let Some(path) = current_directory {
        dialog = dialog.set_directory(path);
    }

    Ok(dialog.pick_folder().map(|path| path_to_string(&path)))
}

pub(crate) fn get_app_profile_directory(app: &AppHandle) -> AppResult<PathBuf> {
    let effective_directory = resolve_app_profile_directory(app)?;
    fs::create_dir_all(&effective_directory).map_err(|error| {
        format!(
            "Unable to create the application profile directory at {}: {error}",
            effective_directory.display()
        )
    })?;
    Ok(effective_directory)
}

pub(crate) fn get_default_app_profile_directory(app: &AppHandle) -> AppResult<PathBuf> {
    let documents_directory = app
        .path()
        .document_dir()
        .map_err(|error| format!("Unable to resolve the Documents directory: {error}"))?;
    Ok(documents_directory.join(APP_PROFILE_DIRECTORY_NAME))
}

pub(crate) fn get_app_profile_directory_string(app: &AppHandle) -> AppResult<String> {
    Ok(path_to_string(&get_app_profile_directory(app)?))
}

pub(crate) fn get_default_app_profile_directory_string(app: &AppHandle) -> AppResult<String> {
    Ok(path_to_string(&get_default_app_profile_directory(app)?))
}

pub(crate) fn get_app_profile_database_registry_path(app: &AppHandle) -> AppResult<PathBuf> {
    Ok(get_app_profile_directory(app)?.join(DATABASE_REGISTRY_FILE))
}

pub(crate) fn read_app_profile_theme(app: &AppHandle) -> AppResult<String> {
    Ok(read_or_initialize_app_profile_settings(app, &get_app_profile_directory(app)?)?.theme)
}

fn resolve_app_profile_directory(app: &AppHandle) -> AppResult<PathBuf> {
    let default_directory = get_default_app_profile_directory(app)?;
    let runtime_pointer_path = get_state_dir(app)?.join(APP_PROFILE_POINTER_FILE_NAME);
    if let Some(path) = read_profile_pointer_file(&runtime_pointer_path)? {
        return Ok(path);
    }

    let default_pointer_path = default_directory.join(APP_PROFILE_POINTER_FILE_NAME);
    if let Some(path) = read_profile_pointer_file(&default_pointer_path)? {
        return Ok(path);
    }

    Ok(default_directory)
}

fn read_profile_pointer_file(path: &Path) -> AppResult<Option<PathBuf>> {
    if !path.exists() {
        return Ok(None);
    }

    let raw = fs::read_to_string(path).map_err(|error| {
        format!(
            "Unable to read the application profile pointer at {}: {error}",
            path.display()
        )
    })?;
    let parsed = serde_json::from_str::<AppProfilePointerFile>(&raw).map_err(|error| {
        format!(
            "Unable to parse the application profile pointer at {}: {error}",
            path.display()
        )
    })?;
    Ok(Some(normalize_directory_path(PathBuf::from(
        parsed.profile_directory,
    ))?))
}

fn persist_profile_directory_pointer(app: &AppHandle, profile_directory: &Path) -> AppResult<()> {
    let runtime_pointer_path = get_state_dir(app)?.join(APP_PROFILE_POINTER_FILE_NAME);
    write_profile_pointer_file(&runtime_pointer_path, profile_directory)?;

    let default_directory = get_default_app_profile_directory(app)?;
    let documents_pointer_path = default_directory.join(APP_PROFILE_POINTER_FILE_NAME);
    write_profile_pointer_file(&documents_pointer_path, profile_directory)?;
    Ok(())
}

fn write_profile_pointer_file(path: &Path, profile_directory: &Path) -> AppResult<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Unable to create the application profile bootstrap directory at {}: {error}",
                parent.display()
            )
        })?;
    }

    let serialized = serde_json::to_string_pretty(&AppProfilePointerFile {
        profile_directory: path_to_string(profile_directory),
    })
    .map_err(|error| error.to_string())?;
    fs::write(path, serialized).map_err(|error| {
        format!(
            "Unable to write the application profile pointer at {}: {error}",
            path.display()
        )
    })
}

fn read_or_initialize_app_profile_settings(
    app: &AppHandle,
    profile_directory: &Path,
) -> AppResult<AppProfileSettingsFile> {
    let settings_path = profile_directory.join(APP_PROFILE_SETTINGS_FILE_NAME);
    if !settings_path.exists() {
        if let Some(migrated) = migrate_legacy_database_settings_if_needed(app, &settings_path)? {
            return Ok(migrated);
        }

        let defaults = AppProfileSettingsFile::default();
        write_app_profile_settings_file(profile_directory, &defaults)?;
        return Ok(defaults);
    }

    let raw = fs::read_to_string(&settings_path).map_err(|error| {
        format!(
            "Unable to read the application settings file at {}: {error}",
            settings_path.display()
        )
    })?;
    let parsed = serde_json::from_str::<AppProfileSettingsFile>(&raw).unwrap_or_default();
    Ok(parsed)
}

fn write_app_profile_settings_file(
    profile_directory: &Path,
    settings: &AppProfileSettingsFile,
) -> AppResult<()> {
    fs::create_dir_all(profile_directory).map_err(|error| {
        format!(
            "Unable to create the application profile directory at {}: {error}",
            profile_directory.display()
        )
    })?;
    let settings_path = profile_directory.join(APP_PROFILE_SETTINGS_FILE_NAME);
    let serialized = serde_json::to_string_pretty(settings).map_err(|error| error.to_string())?;
    fs::write(&settings_path, serialized).map_err(|error| {
        format!(
            "Unable to write the application settings file at {}: {error}",
            settings_path.display()
        )
    })
}

fn migrate_legacy_database_settings_if_needed(
    app: &AppHandle,
    settings_path: &Path,
) -> AppResult<Option<AppProfileSettingsFile>> {
    if settings_path.exists() {
        return Ok(None);
    }

    let migrated_settings = with_active_connection(app, |connection| {
        Ok(AppProfileSettingsFile {
            theme: read_legacy_database_setting(connection, "theme")?
                .unwrap_or_else(|| DEFAULT_THEME.to_string()),
            default_exchange: read_legacy_database_setting(connection, "default_exchange")?
                .unwrap_or_else(|| DEFAULT_EXCHANGE.to_string()),
            candle_up_color: read_legacy_database_setting(connection, "candle_up_color")?
                .unwrap_or_else(|| DEFAULT_CANDLE_UP_COLOR.to_string()),
            candle_down_color: read_legacy_database_setting(connection, "candle_down_color")?
                .unwrap_or_else(|| DEFAULT_CANDLE_DOWN_COLOR.to_string()),
            grid_color: read_legacy_database_setting(connection, "grid_color")?
                .unwrap_or_else(|| DEFAULT_GRID_COLOR.to_string()),
            crosshair_color: read_legacy_database_setting(connection, "crosshair_color")?
                .unwrap_or_else(|| DEFAULT_CROSSHAIR_COLOR.to_string()),
            plugin_enabled: BTreeMap::new(),
            plugin_configurations: BTreeMap::new(),
            eod_alert_rules: Vec::new(),
            eod_alert_history: Vec::new(),
            scanner_workspace: Value::Null,
        })
    })?;

    let Some(settings) = migrated_settings else {
        return Ok(None);
    };

    if let Some(parent) = settings_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let serialized = serde_json::to_string_pretty(&settings).map_err(|error| error.to_string())?;
    fs::write(settings_path, serialized).map_err(|error| error.to_string())?;

    log_runtime_event(
        app,
        "INFO",
        "migrate-legacy-app-settings",
        Some(&format!("to={}", settings_path.display())),
    );

    Ok(Some(settings))
}

fn read_legacy_database_setting(connection: &Connection, key: &str) -> AppResult<Option<String>> {
    connection
        .query_row(
            "
              SELECT value
              FROM settings
              WHERE key = ?
            ",
            params![key],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| error.to_string())
}

fn migrate_profile_state_if_needed(
    current_directory: &Path,
    target_directory: &Path,
) -> AppResult<()> {
    if current_directory == target_directory {
        return Ok(());
    }

    fs::create_dir_all(target_directory).map_err(|error| {
        format!(
            "Unable to create the target application profile directory at {}: {error}",
            target_directory.display()
        )
    })?;

    for file_name in [APP_PROFILE_SETTINGS_FILE_NAME, DATABASE_REGISTRY_FILE] {
        let source_path = current_directory.join(file_name);
        let destination_path = target_directory.join(file_name);
        if source_path.exists() && !destination_path.exists() {
            fs::copy(&source_path, &destination_path).map_err(|error| {
                format!(
                    "Unable to migrate application profile data from {} to {}: {error}",
                    source_path.display(),
                    destination_path.display()
                )
            })?;
        }
    }

    Ok(())
}

fn normalize_directory_path(path: PathBuf) -> AppResult<PathBuf> {
    if path.is_absolute() {
        return Ok(path);
    }

    std::env::current_dir()
        .map(|cwd| cwd.join(path))
        .map_err(|error| error.to_string())
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

impl Default for AppProfileSettingsFile {
    fn default() -> Self {
        Self {
            theme: DEFAULT_THEME.to_string(),
            default_exchange: DEFAULT_EXCHANGE.to_string(),
            candle_up_color: DEFAULT_CANDLE_UP_COLOR.to_string(),
            candle_down_color: DEFAULT_CANDLE_DOWN_COLOR.to_string(),
            grid_color: DEFAULT_GRID_COLOR.to_string(),
            crosshair_color: DEFAULT_CROSSHAIR_COLOR.to_string(),
            plugin_enabled: BTreeMap::new(),
            plugin_configurations: BTreeMap::new(),
            eod_alert_rules: Vec::new(),
            eod_alert_history: Vec::new(),
            scanner_workspace: Value::Null,
        }
    }
}
