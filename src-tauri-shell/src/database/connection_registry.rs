use crate::app_profile::{get_app_profile_database_registry_path, read_app_profile_theme};
use crate::runtime::{log_runtime_event, resolve_runtime_context};
use rusqlite::{Connection, OpenFlags};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Manager};

use super::watchlists::load_watchlists;
use super::{
    emit_database_changed, load_db_stats, now_iso, path_to_string, prepare_database_connection,
    set_price_storage_mode, AppResult, AppSnapshot, DbStats, KnownDatabase, PathInput,
    PriceStorageMode, SnapshotOptions, DATABASE_FILE_NAME, DATABASE_MANIFEST_FILE,
    DATABASE_REGISTRY_FILE,
};

pub struct ActiveDatabaseConnectionState {
    cached: Mutex<Option<CachedDatabaseConnection>>,
}

struct CachedDatabaseConnection {
    folder_path: PathBuf,
    connection: Connection,
    db_stats_cache: Option<CachedDbStats>,
}

#[derive(Clone)]
struct CachedDbStats {
    stats: DbStats,
    database_file_len: u64,
    database_file_modified_unix_ms: Option<u128>,
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct DatabaseRegistryFile {
    recent: Vec<KnownDatabase>,
    last_active_path: Option<String>,
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct DatabaseManifest {
    format: String,
    version: i64,
    name: String,
    db_file: String,
    created_at: String,
}

impl ActiveDatabaseConnectionState {
    pub fn new() -> Self {
        Self {
            cached: Mutex::new(None),
        }
    }
}

#[tauri::command]
pub async fn get_app_snapshot(
    app: AppHandle,
    input: Option<SnapshotOptions>,
) -> AppResult<AppSnapshot> {
    tauri::async_runtime::spawn_blocking(move || get_app_snapshot_internal(&app, input.as_ref()))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn get_db_stats(app: AppHandle) -> AppResult<Option<DbStats>> {
    tauri::async_runtime::spawn_blocking(move || {
        let Some(folder_path) = resolve_active_database_folder(&app)? else {
            return Ok(None);
        };

        get_or_load_cached_db_stats(&app, &folder_path)
    })
    .await
    .map_err(|error| error.to_string())?
}

pub(crate) fn ensure_registry_initialized(app: &AppHandle) -> AppResult<()> {
    let _ = read_registry(app)?;
    Ok(())
}

#[tauri::command]
pub async fn create_database_interactive(
    app: AppHandle,
    requested_mode: Option<PriceStorageMode>,
) -> AppResult<AppSnapshot> {
    let selected_path = rfd::FileDialog::new()
        .set_title("Create Database Folder")
        .set_file_name("New Database")
        .save_file();

    let app_for_task = app.clone();
    let snapshot = tauri::async_runtime::spawn_blocking(move || {
        if let Some(folder_path) = selected_path {
            create_database_at_internal(&app_for_task, folder_path, requested_mode)
        } else {
            get_app_snapshot_internal(
                &app_for_task,
                Some(&SnapshotOptions {
                    include_stats: Some(false),
                    include_watchlists: Some(false),
                }),
            )
        }
    })
    .await
    .map_err(|error| error.to_string())??;

    if snapshot.active_database_path.is_some() {
        log_runtime_event(
            &app,
            "INFO",
            "create-database",
            snapshot.active_database_path.as_deref(),
        );
    }
    emit_database_changed(&app, &snapshot)?;
    Ok(snapshot)
}

#[tauri::command]
pub async fn open_database_interactive(app: AppHandle) -> AppResult<AppSnapshot> {
    let selected_path = rfd::FileDialog::new()
        .set_title("Open Database Folder")
        .pick_folder();

    let app_for_task = app.clone();
    let snapshot = tauri::async_runtime::spawn_blocking(move || {
        if let Some(folder_path) = selected_path {
            open_database_at_internal(&app_for_task, folder_path)
        } else {
            get_app_snapshot_internal(
                &app_for_task,
                Some(&SnapshotOptions {
                    include_stats: Some(false),
                    include_watchlists: Some(false),
                }),
            )
        }
    })
    .await
    .map_err(|error| error.to_string())??;

    if snapshot.active_database_path.is_some() {
        log_runtime_event(
            &app,
            "INFO",
            "open-database",
            snapshot.active_database_path.as_deref(),
        );
    }
    emit_database_changed(&app, &snapshot)?;
    Ok(snapshot)
}

#[tauri::command]
pub async fn activate_database_path(app: AppHandle, input: PathInput) -> AppResult<AppSnapshot> {
    let app_for_task = app.clone();
    let snapshot = tauri::async_runtime::spawn_blocking(move || {
        open_database_at_internal(&app_for_task, PathBuf::from(input.file_path))
    })
    .await
    .map_err(|error| error.to_string())??;
    log_runtime_event(
        &app,
        "INFO",
        "activate-database",
        snapshot.active_database_path.as_deref(),
    );
    emit_database_changed(&app, &snapshot)?;
    Ok(snapshot)
}

#[tauri::command]
pub fn close_database(app: AppHandle) -> AppResult<AppSnapshot> {
    let mut registry = read_registry(&app)?;
    registry.last_active_path = None;
    write_registry(&app, &registry)?;
    clear_cached_connection(&app)?;
    let snapshot = get_app_snapshot_internal(
        &app,
        Some(&SnapshotOptions {
            include_stats: Some(false),
            include_watchlists: Some(false),
        }),
    )?;
    log_runtime_event(&app, "INFO", "close-database", None);
    emit_database_changed(&app, &snapshot)?;
    Ok(snapshot)
}

#[tauri::command]
pub fn remove_recent_database(app: AppHandle, input: PathInput) -> AppResult<AppSnapshot> {
    let folder_path = normalize_database_folder_path(PathBuf::from(input.file_path))?;
    let folder_string = path_to_string(&folder_path);
    let mut registry = read_registry(&app)?;
    registry.recent.retain(|entry| entry.path != folder_string);
    write_registry(&app, &registry)?;

    let snapshot = get_app_snapshot_internal(
        &app,
        Some(&SnapshotOptions {
            include_stats: Some(false),
            include_watchlists: Some(false),
        }),
    )?;

    log_runtime_event(
        &app,
        "INFO",
        "remove-recent-database",
        Some(folder_string.as_str()),
    );
    emit_database_changed(&app, &snapshot)?;
    Ok(snapshot)
}

#[tauri::command]
pub async fn delete_database(app: AppHandle, input: PathInput) -> AppResult<AppSnapshot> {
    let folder_path = normalize_database_folder_path(PathBuf::from(input.file_path))?;
    let folder_string = path_to_string(&folder_path);

    // Update registry and clear connection before deletion
    {
        let mut registry = read_registry(&app)?;

        if registry.last_active_path.as_deref() == Some(folder_string.as_str()) {
            registry.last_active_path = None;
        }

        registry.recent.retain(|entry| entry.path != folder_string);
        write_registry(&app, &registry)?;
    }

    clear_cached_connection(&app)?;

    // Perform heavy filesystem deletion in a blocking worker
    let folder_path_for_task = folder_path.clone();
    tauri::async_runtime::spawn_blocking(move || {
        if folder_path_for_task.exists() {
            fs::remove_dir_all(&folder_path_for_task).map_err(|error| error.to_string())?;
        }
        Ok::<(), String>(())
    })
    .await
    .map_err(|error| error.to_string())??;

    let snapshot = get_app_snapshot_internal(
        &app,
        Some(&SnapshotOptions {
            include_stats: Some(false),
            include_watchlists: Some(false),
        }),
    )?;

    log_runtime_event(
        &app,
        "INFO",
        "delete-database",
        Some(folder_string.as_str()),
    );
    emit_database_changed(&app, &snapshot)?;

    Ok(snapshot)
}

fn create_database_at_internal(
    app: &AppHandle,
    folder_path: PathBuf,
    requested_mode: Option<PriceStorageMode>,
) -> AppResult<AppSnapshot> {
    let normalized_path = normalize_database_folder_path(folder_path)?;
    if is_database_folder(&normalized_path)? {
        return open_database_at_internal(app, normalized_path);
    }

    prepare_database_folder(&normalized_path)?;
    let manifest = ensure_database_manifest(&normalized_path)?;
    with_connection_for_folder(app, &normalized_path, true, |connection| {
        if let Some(mode) = requested_mode {
            if mode == PriceStorageMode::Binary {
                set_price_storage_mode(connection, mode)?;
            }
        }
        Ok(())
    })?;
    touch_registry(app, &normalized_path, &manifest.name)?;
    get_app_snapshot_internal(
        app,
        Some(&SnapshotOptions {
            include_stats: Some(false),
            include_watchlists: Some(false),
        }),
    )
}

fn open_database_at_internal(app: &AppHandle, folder_path: PathBuf) -> AppResult<AppSnapshot> {
    let normalized_path = normalize_database_folder_path(folder_path)?;
    if !normalized_path.exists() || !normalized_path.is_dir() {
        return Err(format!(
            "Database folder does not exist: {}",
            path_to_string(&normalized_path)
        ));
    }

    let manifest = read_database_manifest(&normalized_path)?.unwrap_or_else(|| DatabaseManifest {
        format: "eod-chart-db".to_string(),
        version: 1,
        name: normalized_path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("Database")
            .to_string(),
        db_file: DATABASE_FILE_NAME.to_string(),
        created_at: now_iso(),
    });
    let database_file_path = resolve_database_file_path(&normalized_path, Some(&manifest));
    if !database_file_path.exists() {
        return Err(format!(
            "Selected folder is not an EOD Chart database: {}",
            path_to_string(&normalized_path)
        ));
    }

    with_connection_for_folder(app, &normalized_path, false, |_| Ok(()))?;
    touch_registry(app, &normalized_path, &manifest.name)?;
    get_app_snapshot_internal(
        app,
        Some(&SnapshotOptions {
            include_stats: Some(false),
            include_watchlists: Some(false),
        }),
    )
}

pub(crate) fn get_app_snapshot_internal(
    app: &AppHandle,
    options: Option<&SnapshotOptions>,
) -> AppResult<AppSnapshot> {
    let registry = read_registry(app)?;
    let active_database_folder = resolve_active_database_folder(app)?;
    let active_database_path = active_database_folder
        .as_ref()
        .map(|value| path_to_string(value));
    let include_stats = options
        .and_then(|value| value.include_stats)
        .unwrap_or(true);
    let include_watchlists = options
        .and_then(|value| value.include_watchlists)
        .unwrap_or(true);

    if let Some(folder_path) = active_database_folder {
        let db_stats = if include_stats {
            get_or_load_cached_db_stats(app, &folder_path)?
        } else {
            None
        };
        let watchlists = with_connection_for_folder(app, &folder_path, false, |connection| {
            Ok(if include_watchlists {
                load_watchlists(connection)?
            } else {
                Vec::new()
            })
        })?;
        let theme = read_app_profile_theme(app).unwrap_or_else(|_| "dark".to_string());
        return Ok(AppSnapshot {
            active_database_path,
            known_databases: registry.recent,
            db_stats,
            watchlists,
            theme,
        });
    }

    Ok(AppSnapshot {
        active_database_path: None,
        known_databases: registry.recent,
        db_stats: None,
        watchlists: Vec::new(),
        theme: "dark".to_string(),
    })
}

pub(crate) fn with_active_connection<T, F>(app: &AppHandle, callback: F) -> AppResult<Option<T>>
where
    F: FnOnce(&Connection) -> AppResult<T>,
{
    let Some(folder_path) = resolve_active_database_folder(app)? else {
        return Ok(None);
    };

    with_connection_for_folder(app, &folder_path, false, callback).map(Some)
}

pub(crate) fn resolve_active_database_folder(app: &AppHandle) -> AppResult<Option<PathBuf>> {
    let mut registry = read_registry(app)?;
    let Some(active_path) = registry.last_active_path.clone() else {
        clear_cached_connection(app)?;
        return Ok(None);
    };

    let folder_path = normalize_database_folder_path(PathBuf::from(active_path))?;
    if folder_path.exists() && is_database_folder(&folder_path)? {
        return Ok(Some(folder_path));
    }

    registry.last_active_path = None;
    write_registry(app, &registry)?;
    clear_cached_connection(app)?;
    Ok(None)
}

pub(crate) fn get_active_database_file_path(app: &AppHandle) -> AppResult<Option<PathBuf>> {
    let Some(folder_path) = resolve_active_database_folder(app)? else {
        return Ok(None);
    };

    let manifest = read_database_manifest(&folder_path)?;
    Ok(Some(resolve_database_file_path(
        &folder_path,
        manifest.as_ref(),
    )))
}

fn read_registry(app: &AppHandle) -> AppResult<DatabaseRegistryFile> {
    let registry_path = get_registry_path(app)?;
    if !registry_path.exists() {
        migrate_legacy_registry_if_needed(app, &registry_path)?;
    }
    if !registry_path.exists() {
        let registry = DatabaseRegistryFile::default();
        write_registry(app, &registry)?;
        return Ok(registry);
    }

    let raw = fs::read_to_string(&registry_path).map_err(|error| error.to_string())?;
    let parsed = serde_json::from_str::<DatabaseRegistryFile>(&raw).unwrap_or_default();
    let recent = parsed
        .recent
        .into_iter()
        .filter_map(|entry| {
            normalize_database_folder_path(PathBuf::from(entry.path))
                .ok()
                .map(|normalized| KnownDatabase {
                    path: path_to_string(&normalized),
                    label: entry.label,
                    last_opened_at: entry.last_opened_at,
                })
        })
        .collect::<Vec<_>>();
    let last_active_path = parsed
        .last_active_path
        .and_then(|value| normalize_database_folder_path(PathBuf::from(value)).ok())
        .map(|value| path_to_string(&value));

    Ok(DatabaseRegistryFile {
        recent,
        last_active_path,
    })
}

fn migrate_legacy_registry_if_needed(app: &AppHandle, registry_path: &Path) -> AppResult<()> {
    let runtime_context = resolve_runtime_context(app)?;
    let legacy_candidates = [
        runtime_context.state_dir.join(DATABASE_REGISTRY_FILE),
        runtime_context.data_dir.join(DATABASE_REGISTRY_FILE),
    ];

    let Some(legacy_path) = legacy_candidates
        .into_iter()
        .find(|candidate| candidate != registry_path && candidate.exists())
    else {
        return Ok(());
    };

    if let Some(parent) = registry_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    fs::copy(&legacy_path, registry_path).map_err(|error| {
        format!(
            "Unable to migrate the registry from {} to {}: {error}",
            legacy_path.display(),
            registry_path.display()
        )
    })?;

    log_runtime_event(
        app,
        "INFO",
        "migrate-registry",
        Some(&format!(
            "from={} to={}",
            legacy_path.display(),
            registry_path.display()
        )),
    );

    Ok(())
}

fn write_registry(app: &AppHandle, registry: &DatabaseRegistryFile) -> AppResult<()> {
    let registry_path = get_registry_path(app)?;
    let serialized = serde_json::to_string_pretty(registry).map_err(|error| error.to_string())?;
    fs::write(registry_path, serialized).map_err(|error| error.to_string())
}

fn touch_registry(app: &AppHandle, folder_path: &Path, label: &str) -> AppResult<()> {
    let normalized_path = normalize_database_folder_path(folder_path.to_path_buf())?;
    let normalized_string = path_to_string(&normalized_path);
    let mut registry = read_registry(app)?;
    let now = now_iso();
    registry.recent = std::iter::once(KnownDatabase {
        path: normalized_string.clone(),
        label: label.to_string(),
        last_opened_at: now,
    })
    .chain(
        registry
            .recent
            .into_iter()
            .filter(|entry| entry.path != normalized_string),
    )
    .take(12)
    .collect();
    registry.last_active_path = Some(normalized_string);
    write_registry(app, &registry)
}

fn get_registry_path(app: &AppHandle) -> AppResult<PathBuf> {
    get_app_profile_database_registry_path(app)
}

fn normalize_database_folder_path(value: PathBuf) -> AppResult<PathBuf> {
    if value.is_absolute() {
        Ok(value)
    } else {
        std::env::current_dir()
            .map(|cwd| cwd.join(value))
            .map_err(|error| error.to_string())
    }
}

fn prepare_database_folder(folder_path: &Path) -> AppResult<()> {
    if folder_path.exists() {
        if !folder_path.is_dir() {
            return Err(format!(
                "Selected database path is not a folder: {}",
                path_to_string(folder_path)
            ));
        }

        let mut entries = fs::read_dir(folder_path).map_err(|error| error.to_string())?;
        if entries.next().is_some() && !is_database_folder(folder_path)? {
            return Err(format!(
                "Selected folder is not empty: {}",
                path_to_string(folder_path)
            ));
        }
        return Ok(());
    }

    fs::create_dir_all(folder_path).map_err(|error| error.to_string())
}

fn is_database_folder(folder_path: &Path) -> AppResult<bool> {
    if !folder_path.exists() || !folder_path.is_dir() {
        return Ok(false);
    }

    if let Some(manifest) = read_database_manifest(folder_path)? {
        return Ok(folder_path.join(manifest.db_file).exists());
    }

    Ok(folder_path.join(DATABASE_FILE_NAME).exists())
}

fn resolve_database_file_path(folder_path: &Path, manifest: Option<&DatabaseManifest>) -> PathBuf {
    folder_path.join(
        manifest
            .map(|value| value.db_file.as_str())
            .unwrap_or(DATABASE_FILE_NAME),
    )
}

fn ensure_database_manifest(folder_path: &Path) -> AppResult<DatabaseManifest> {
    if let Some(existing) = read_database_manifest(folder_path)? {
        return Ok(existing);
    }

    let manifest = DatabaseManifest {
        format: "eod-chart-db".to_string(),
        version: 1,
        name: folder_path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("Database")
            .to_string(),
        db_file: DATABASE_FILE_NAME.to_string(),
        created_at: now_iso(),
    };
    let manifest_path = folder_path.join(DATABASE_MANIFEST_FILE);
    let serialized = serde_json::to_string_pretty(&manifest).map_err(|error| error.to_string())?;
    fs::write(manifest_path, serialized).map_err(|error| error.to_string())?;
    Ok(manifest)
}

fn read_database_manifest(folder_path: &Path) -> AppResult<Option<DatabaseManifest>> {
    let manifest_path = folder_path.join(DATABASE_MANIFEST_FILE);
    if !manifest_path.exists() {
        return Ok(None);
    }

    let raw = fs::read_to_string(manifest_path).map_err(|error| error.to_string())?;
    let parsed = serde_json::from_str::<DatabaseManifest>(&raw).ok();
    Ok(parsed.filter(|manifest| {
        manifest.format == "eod-chart-db"
            && manifest.version == 1
            && !manifest.db_file.trim().is_empty()
    }))
}

pub(super) fn load_database_file_info(folder_path: &Path) -> AppResult<(Option<String>, PathBuf)> {
    let manifest = read_database_manifest(folder_path)?;
    let database_file_path = resolve_database_file_path(folder_path, manifest.as_ref());
    Ok((manifest.map(|value| value.name), database_file_path))
}

pub(crate) fn open_connection_for_folder(
    folder_path: &Path,
    create_if_missing: bool,
) -> AppResult<Connection> {
    let manifest = if create_if_missing {
        Some(ensure_database_manifest(folder_path)?)
    } else {
        read_database_manifest(folder_path)?
    };
    let database_file_path = resolve_database_file_path(folder_path, manifest.as_ref());
    if !create_if_missing && !database_file_path.exists() {
        return Err(format!(
            "Database file does not exist: {}",
            path_to_string(&database_file_path)
        ));
    }

    let connection = Connection::open(database_file_path).map_err(|error| error.to_string())?;
    prepare_database_connection(&connection)?;
    Ok(connection)
}

pub(crate) fn open_read_only_connection_for_folder(folder_path: &Path) -> AppResult<Connection> {
    let manifest = read_database_manifest(folder_path)?;
    let database_file_path = resolve_database_file_path(folder_path, manifest.as_ref());
    if !database_file_path.exists() {
        return Err(format!(
            "Database file does not exist: {}",
            path_to_string(&database_file_path)
        ));
    }

    let uri_path = encode_sqlite_uri_path(&database_file_path);
    let connection = Connection::open_with_flags(
        format!("file:{uri_path}?mode=ro"),
        OpenFlags::SQLITE_OPEN_READ_ONLY
            | OpenFlags::SQLITE_OPEN_URI
            | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|error| error.to_string())?;
    connection
        .pragma_update(None, "query_only", true)
        .map_err(|error| error.to_string())?;
    let query_only = connection
        .query_row("PRAGMA query_only", [], |row| row.get::<_, i64>(0))
        .map_err(|error| error.to_string())?;
    if query_only != 1 {
        return Err("Unable to verify the read-only database connection.".to_string());
    }
    Ok(connection)
}

fn encode_sqlite_uri_path(path: &Path) -> String {
    let normalized = path_to_string(path).replace('\\', "/");
    let mut encoded = String::with_capacity(normalized.len());
    for byte in normalized.bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~' | b'/' | b':') {
            encoded.push(char::from(byte));
        } else {
            encoded.push_str(&format!("%{byte:02X}"));
        }
    }
    encoded
}

fn with_connection_for_folder<T, F>(
    app: &AppHandle,
    folder_path: &Path,
    create_if_missing: bool,
    callback: F,
) -> AppResult<T>
where
    F: FnOnce(&Connection) -> AppResult<T>,
{
    let state = app.state::<ActiveDatabaseConnectionState>();
    let mut cached = state
        .cached
        .lock()
        .map_err(|_| "Unable to lock the active database connection.".to_string())?;
    ensure_connection_cached(&mut cached, folder_path, create_if_missing)?;

    let entry = cached
        .as_ref()
        .ok_or_else(|| "Unable to access the active database connection.".to_string())?;

    callback(&entry.connection)
}

fn clear_cached_connection(app: &AppHandle) -> AppResult<()> {
    let state = app.state::<ActiveDatabaseConnectionState>();
    let mut cached = state
        .cached
        .lock()
        .map_err(|_| "Unable to lock the active database connection.".to_string())?;
    *cached = None;
    Ok(())
}

pub(crate) fn invalidate_cached_db_stats(app: &AppHandle, folder_path: &Path) -> AppResult<()> {
    let state = app.state::<ActiveDatabaseConnectionState>();
    let mut cached = state
        .cached
        .lock()
        .map_err(|_| "Unable to lock the active database connection.".to_string())?;

    if let Some(entry) = cached.as_mut() {
        if entry.folder_path == folder_path {
            entry.db_stats_cache = None;
        }
    }
    Ok(())
}

fn ensure_connection_cached(
    cached: &mut Option<CachedDatabaseConnection>,
    folder_path: &Path,
    create_if_missing: bool,
) -> AppResult<()> {
    let needs_refresh = cached
        .as_ref()
        .map(|entry| entry.folder_path != folder_path)
        .unwrap_or(true);

    if needs_refresh {
        let connection = open_connection_for_folder(folder_path, create_if_missing)?;
        *cached = Some(CachedDatabaseConnection {
            folder_path: folder_path.to_path_buf(),
            connection,
            db_stats_cache: None,
        });
    }

    Ok(())
}

fn load_database_file_signature(folder_path: &Path) -> AppResult<(u64, Option<u128>)> {
    let manifest = read_database_manifest(folder_path)?;
    let database_file_path = resolve_database_file_path(folder_path, manifest.as_ref());
    let metadata = fs::metadata(&database_file_path).map_err(|error| error.to_string())?;
    let modified_unix_ms = metadata
        .modified()
        .ok()
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .map(|value| value.as_millis());

    Ok((metadata.len(), modified_unix_ms))
}

fn get_or_load_cached_db_stats(app: &AppHandle, folder_path: &Path) -> AppResult<Option<DbStats>> {
    let (database_file_len, database_file_modified_unix_ms) =
        load_database_file_signature(folder_path)?;

    let state = app.state::<ActiveDatabaseConnectionState>();

    // 1. Quick check if we have it in cache
    {
        let cached = state
            .cached
            .lock()
            .map_err(|_| "Unable to lock the active database connection.".to_string())?;

        if let Some(entry) = cached.as_ref() {
            if entry.folder_path == folder_path {
                if let Some(cached_stats) = entry.db_stats_cache.as_ref() {
                    if cached_stats.database_file_len == database_file_len
                        && cached_stats.database_file_modified_unix_ms
                            == database_file_modified_unix_ms
                    {
                        return Ok(Some(cached_stats.stats.clone()));
                    }
                }
            }
        }
    }

    // 2. Cache miss or invalid - expensive calculation outside the lock.
    // We open a temporary connection to avoid holding the global connection lock.
    let temp_connection = open_connection_for_folder(folder_path, false)?;
    let stats = load_db_stats(folder_path, &temp_connection)?;

    // 3. Update cache with minimal lock
    {
        let mut cached = state
            .cached
            .lock()
            .map_err(|_| "Unable to lock the active database connection.".to_string())?;

        let stats_cache = Some(CachedDbStats {
            stats: stats.clone(),
            database_file_len,
            database_file_modified_unix_ms,
        });

        match cached.as_mut() {
            Some(entry) if entry.folder_path == folder_path => {
                // Update existing entry
                entry.db_stats_cache = stats_cache;
            }
            None => {
                // Cache was empty, populate it now with our temp connection
                *cached = Some(CachedDatabaseConnection {
                    folder_path: folder_path.to_path_buf(),
                    connection: temp_connection,
                    db_stats_cache: stats_cache,
                });
                return Ok(Some(stats));
            }
            _ => {
                // Cache now points elsewhere, just drop our results and temp_connection
            }
        }
    }

    Ok(Some(stats))
}

// R1-A: no registry read/repair, connection initialization or cache mutation.
pub(crate) fn peek_active_database_folder_read_only(app: &AppHandle) -> AppResult<Option<PathBuf>> {
    let Some(state) = app.try_state::<ActiveDatabaseConnectionState>() else { return Ok(None); };
    peek_cached_folder_only(&state)
}

fn peek_cached_folder_only(state: &ActiveDatabaseConnectionState) -> AppResult<Option<PathBuf>> {
    let cached = state.cached.lock().map_err(|_| "Cached database context lock is poisoned.".to_string())?;
    Ok(cached.as_ref().map(|entry| entry.folder_path.clone()))
}

#[cfg(test)]
mod r1a_context_tests {
    use super::*;
    #[test]
    fn r1a_context_peek_never_initializes_or_repairs_registry() {
        let state = ActiveDatabaseConnectionState::new();
        assert!(peek_cached_folder_only(&state).unwrap().is_none());
        assert!(state.cached.lock().unwrap().is_none());
    }
    #[test]
    fn r1a_context_peek_preserves_cached_connection_and_folder() {
        let connection = Connection::open_in_memory().unwrap();
        let state = ActiveDatabaseConnectionState { cached: Mutex::new(Some(CachedDatabaseConnection { folder_path: PathBuf::from("E:/TEST"), connection, db_stats_cache: None })) };
        assert_eq!(peek_cached_folder_only(&state).unwrap(),Some(PathBuf::from("E:/TEST")));
        assert!(state.cached.lock().unwrap().as_ref().unwrap().connection.is_autocommit());
    }
}
