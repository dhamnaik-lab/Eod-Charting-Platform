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
    configure_database_connection, emit_database_changed, load_db_stats, now_iso, path_to_string,
    prepare_database_connection, set_price_storage_mode, AppResult, AppSnapshot, DbStats,
    KnownDatabase, PathInput, PriceStorageMode, SnapshotOptions, DATABASE_FILE_NAME,
    DATABASE_MANIFEST_FILE, DATABASE_REGISTRY_FILE,
};
use super::{
    database_deletion,
    database_use::{self, DatabasePath},
};

#[cfg(all(windows, feature = "wp02-acceptance"))]
pub(crate) mod wp02_acceptance;

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
    #[serde(default)]
    active_selection_revision: u64,
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

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct NativeScanSelection {
    pub(crate) folder: PathBuf,
    pub(crate) database_identity: String,
    canonical_folder: PathBuf,
    sqlite_filename: PathBuf,
    physical_file_identity: String,
}

#[cfg(test)]
impl NativeScanSelection {
    pub(crate) fn fixture(folder: &Path, revision: u64) -> AppResult<Self> {
        let path = path_to_string(folder);
        native_selection_from_registry(&DatabaseRegistryFile {
            recent: vec![KnownDatabase {
                path: path.clone(),
                label: "Fixture".into(),
                last_opened_at: String::new(),
            }],
            last_active_path: Some(path),
            active_selection_revision: revision,
        })?
        .ok_or_else(|| "Fixture database selection is unavailable.".into())
    }
}

fn advance_selection_revision(registry: &mut DatabaseRegistryFile) -> AppResult<()> {
    registry.active_selection_revision = registry
        .active_selection_revision
        .checked_add(1)
        .ok_or_else(|| {
            "Database selection revision exhausted; refusing to reuse a scan identity.".to_string()
        })?;
    Ok(())
}

/// A read-only witness of the registered selection, its monotonic activation revision,
/// and the actual SQLite file identity (not folder modification time).
fn native_selection_from_registry(
    registry: &DatabaseRegistryFile,
) -> AppResult<Option<NativeScanSelection>> {
    let Some(active) = registry.last_active_path.as_deref() else {
        return Ok(None);
    };
    if !registry.recent.iter().any(|entry| entry.path == active) {
        return Err("The selected database is not in the registered database list.".to_string());
    }
    let folder = PathBuf::from(active);
    let canonical_folder = fs::canonicalize(&folder)
        .map_err(|error| format!("Cannot verify the active database folder: {error}"))?;
    let manifest = read_database_manifest(&folder)?;
    let database_file = resolve_database_file_path(&folder, manifest.as_ref());
    #[cfg(windows)]
    let physical_file_identity = format!(
        "{:?}",
        database_deletion::identity(&database_file)
            .map_err(|error| format!("Cannot verify the database file identity: {error}"))?
    );
    #[cfg(unix)]
    let physical_file_identity = {
        use std::os::unix::fs::MetadataExt;
        let metadata = fs::metadata(&database_file)
            .map_err(|error| format!("Cannot verify the database file identity: {error}"))?;
        format!("{}:{}", metadata.dev(), metadata.ino())
    };
    #[cfg(not(any(windows, unix)))]
    let physical_file_identity = {
        return Err("Native scanner file identity is unsupported on this platform.".to_string());
    };
    Ok(Some(NativeScanSelection {
        folder,
        database_identity: format!("{}#{}", active, registry.active_selection_revision),
        canonical_folder,
        sqlite_filename: database_file,
        physical_file_identity,
    }))
}

/// Serialize this read-only snapshot with existing DB-use / registry locks.
/// Never initializes or rewrites an existing user profile.
pub(crate) fn read_native_scan_selection(
    app: &AppHandle,
) -> AppResult<Option<NativeScanSelection>> {
    with_native_scan_selection(app, Ok)
}

pub(crate) fn with_native_scan_selection<T>(
    app: &AppHandle,
    use_selection: impl FnOnce(Option<NativeScanSelection>) -> AppResult<T>,
) -> AppResult<T> {
    let _permit = database_use::acquire_use()?;
    let _registry = database_use::lock_registry()?;
    let Some(registry) = scanner_registry(app)? else {
        return use_selection(None);
    };
    let selection = native_selection_from_registry(&registry)?;
    if let Some(value) = &selection {
        database_deletion::require_unblocked(&value.folder)?;
    }
    use_selection(selection)
}

fn scanner_registry(app: &AppHandle) -> AppResult<Option<DatabaseRegistryFile>> {
    #[cfg(all(windows, feature = "wp02-acceptance"))]
    if let Some(registry) = app.try_state::<wp02_acceptance::AcceptanceRegistry>() {
        return registry.snapshot().map(Some);
    }
    let path = get_registry_path(app)?;
    if !path.is_file() {
        return Ok(None);
    }
    read_existing_registry(&path).map(Some)
}

pub(crate) fn require_native_history_wal_family(
    app: &AppHandle,
    selection: &NativeScanSelection,
) -> AppResult<()> {
    let _registry = database_use::lock_registry()?;
    let registry = scanner_registry(app)?.ok_or("NUMERIC_HISTORY_DATABASE_CHANGED")?;
    if native_selection_from_registry(&registry)?.as_ref() != Some(selection) {
        return Err("NUMERIC_HISTORY_DATABASE_CHANGED".into());
    }
    require_registry_wal_family(&registry, selection)
}

fn require_registry_wal_family(
    registry: &DatabaseRegistryFile,
    selection: &NativeScanSelection,
) -> AppResult<()> {
    let physical =
        fs::canonicalize(&selection.sqlite_filename).map_err(|error| error.to_string())?;
    for entry in &registry.recent {
        let (_, file) = load_database_file_info(Path::new(&entry.path))?;
        if database_use::CanonicalAccess::has_file_reparse_point(&file)? {
            match fs::canonicalize(&file) {
                Ok(alias) if alias == physical => {
                    return Err(
                        "Canonical history requires review of a registered SQLite WAL alias."
                            .into(),
                    )
                }
                Ok(_) => {}
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(error) => return Err(error.to_string()),
            }
        }
    }
    Ok(())
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
    let _permit = database_use::acquire_use()?;
    let (folder, revision) = {
        let _registry = database_use::lock_registry()?;
        let registry = read_registry(app)?;
        (
            resolve_active_folder_locked(app, &registry)?,
            registry.active_selection_revision,
        )
    };
    let Some(folder) = folder else {
        return Ok(());
    };
    let connection = match prepare_database_at(&folder, false, None) {
        Ok(connection) => connection,
        Err(error) => {
            log_runtime_event(
                app,
                "WARN",
                "saved-database-preparation-deferred",
                Some(&error),
            );
            return Ok(());
        }
    };
    let _registry = database_use::lock_registry()?;
    let current = read_registry(app)?;
    if current.active_selection_revision == revision
        && resolve_active_folder_locked(app, &current)?.as_deref() == Some(folder.as_path())
    {
        cache_prepared_connection(app, &folder, connection)?;
    }
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
            let _permit = database_use::acquire_use()?;
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
            let _permit = database_use::acquire_use()?;
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
        let _permit = database_use::acquire_use()?;
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
    let _permit = database_use::acquire_use()?;
    let _registry = database_use::lock_registry()?;
    let mut registry = read_registry(&app)?;
    advance_selection_revision(&mut registry)?;
    registry.last_active_path = None;
    write_registry(&app, &registry)?;
    clear_cached_connection(&app)?;
    let snapshot = snapshot_locked(
        &app,
        Some(&SnapshotOptions {
            include_stats: Some(false),
            include_watchlists: Some(false),
        }),
        _registry,
    )?;
    log_runtime_event(&app, "INFO", "close-database", None);
    emit_database_changed(&app, &snapshot)?;
    Ok(snapshot)
}

#[tauri::command]
pub fn remove_recent_database(app: AppHandle, input: PathInput) -> AppResult<AppSnapshot> {
    let _permit = database_use::acquire_use()?;
    let _registry = database_use::lock_registry()?;
    let folder_path = normalize_database_folder_path(PathBuf::from(input.file_path))?;
    let folder_string = path_to_string(&folder_path);
    let mut registry = read_registry(&app)?;
    registry.recent.retain(|entry| entry.path != folder_string);
    write_registry(&app, &registry)?;

    let snapshot = snapshot_locked(
        &app,
        Some(&SnapshotOptions {
            include_stats: Some(false),
            include_watchlists: Some(false),
        }),
        _registry,
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
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(windows)]
        return delete_database_locked(&app, &input.file_path);
        #[cfg(not(windows))]
        {
            let _ = (app, input);
            Err(database_deletion::refuse(
                "Handle-bound database deletion requires Windows NTFS.",
            ))
        }
    })
    .await
    .map_err(|error| {
        format!(
            "{}: Deletion worker ended unexpectedly: {error}",
            database_deletion::PARTIAL
        )
    })?
}

#[cfg(windows)]
fn delete_database_locked(app: &AppHandle, input: &str) -> AppResult<AppSnapshot> {
    use super::price_store_operation_lock::{
        try_acquire_price_store_operation, PriceStoreOperationKind,
    };
    use database_deletion::{identity, refuse, PinnedTree};

    let state_dir = database_use::state_dir()?;
    let use_permit = database_use::acquire_deletion(&state_dir)?;
    let price_permit =
        try_acquire_price_store_operation(PriceStoreOperationKind::DatabaseDeletion)?;
    let _registry_lock = database_use::lock_registry()?;
    let requested = database_deletion::validate_path(input)?;
    let tree = PinnedTree::open(requested).map_err(preflight_failure)?;
    let canonical = requested.canonicalize().map_err(refuse)?;
    if identity(&canonical).map_err(refuse)? != tree.id {
        return Err(refuse(
            "The requested directory changed during verification.",
        ));
    }
    database_deletion::require_unblocked(&canonical)?;

    let runtime = resolve_runtime_context(app)?;
    let working_directory = std::env::current_dir().map_err(refuse)?;
    let profile = get_registry_path(app)?;
    let profile_dir = profile
        .parent()
        .ok_or_else(|| refuse("The app profile has no directory."))?;
    let default_profile = crate::app_profile::get_default_app_profile_directory(app)?;
    for protected in [&working_directory, &runtime.executable_dir] {
        if contains_identity(protected, tree.id)? {
            return Err(refuse(
                "The target contains a protected application directory.",
            ));
        }
    }
    for protected in [
        runtime.data_dir.as_path(),
        runtime.state_dir.as_path(),
        runtime.log_dir.as_path(),
        profile_dir,
        default_profile.as_path(),
        state_dir.as_path(),
    ] {
        if contains_identity(protected, tree.id)?
            || protected.canonicalize().ok().is_some_and(|protected| {
                identity(&protected)
                    .ok()
                    .is_some_and(|id| contains_identity(&canonical, id).unwrap_or(true))
            })
        {
            return Err(refuse(
                "The target overlaps a protected application directory.",
            ));
        }
    }
    let safety_store = PinnedTree::pin_marker_store(&state_dir).map_err(preflight_failure)?;

    // Read the existing registry without initialization or migration on the deletion path.
    let mut registry = read_existing_registry(&profile)?;
    let (matching_recents, active_matches) = registry_deletion_matches(&registry, tree.id)?;
    verify_deletion_ownership(&tree.path, false)?;
    let cache_closed = close_matching_cached_connection(app, tree.id)?;
    let (database, database_id, evidence) = verify_deletion_ownership(&tree.path, true)?;
    tree.preflight(&database).map_err(preflight_failure)?;
    let pinned_database = tree
        .pin_database(&database, database_id)
        .map_err(preflight_failure)?;
    drop(evidence);
    let deletion = VerifiedDeletion {
        tree,
        canonical,
        database,
        pinned_database,
        matching_recents,
        active_matches,
    };
    let outcome =
        complete_verified_deletion(&state_dir, &profile, &mut registry, deletion, |_| Ok(()));
    // The registry remains serialized while publishing. Renderer listeners
    // can now acquire a shared use permit for their follow-up snapshot.
    drop(safety_store);
    drop(price_permit);
    drop(use_permit);
    if let Err(error) = outcome {
        if active_matches || cache_closed {
            if let Ok(persisted) = read_existing_registry(&profile) {
                publish_deletion_snapshot(app, &persisted);
            }
        }
        return Err(error);
    }
    log_runtime_event(app, "INFO", "delete-database", Some(input));
    Ok(publish_deletion_snapshot(app, &registry))
}

#[cfg(windows)]
fn registry_deletion_matches(
    registry: &DatabaseRegistryFile,
    target: database_deletion::Identity,
) -> AppResult<(Vec<bool>, bool)> {
    use database_deletion::{identity, refuse};
    let mut matching_recents = Vec::with_capacity(registry.recent.len());
    let mut verified_registration = false;
    for entry in &registry.recent {
        let path = Path::new(&entry.path);
        let matched = identity(path).is_ok_and(|id| id == target);
        if !matched && contains_identity(path, target)? {
            return Err(refuse("The target contains another registered database."));
        }
        if matched && database_deletion::has_redirect(path).is_ok_and(|redirected| !redirected) {
            verified_registration = true;
        }
        matching_recents.push(matched);
    }
    if !verified_registration {
        return Err(refuse(
            "No recent database registration could be verified without redirection.",
        ));
    }

    let active_matches = if let Some(path) = registry.last_active_path.as_deref() {
        let path = Path::new(path);
        let matched = identity(path).is_ok_and(|id| id == target);
        if !matched && contains_identity(path, target)? {
            return Err(refuse("The target contains the active database."));
        }
        matched
    } else {
        false
    };
    Ok((matching_recents, active_matches))
}

#[cfg(windows)]
struct VerifiedDeletion {
    tree: database_deletion::PinnedTree,
    canonical: PathBuf,
    database: PathBuf,
    pinned_database: fs::File,
    matching_recents: Vec<bool>,
    active_matches: bool,
}

#[cfg(windows)]
fn complete_verified_deletion(
    state_dir: &Path,
    profile: &Path,
    registry: &mut DatabaseRegistryFile,
    deletion: VerifiedDeletion,
    before_entry: impl FnMut(&Path) -> std::io::Result<()>,
) -> AppResult<()> {
    use database_deletion::{Marker, FAILED, FAILED_MARKED, PARTIAL, REGISTRY_FAILED};
    let VerifiedDeletion {
        tree,
        canonical,
        database,
        pinned_database,
        matching_recents,
        active_matches,
    } = deletion;
    let mut markers = database_deletion::read_markers(state_dir)?;
    let id = tree.id;
    markers.push(Marker {
        id,
        path: canonical.clone(),
    });
    database_deletion::write_markers(state_dir, &markers)
        .map_err(|error| format!("{FAILED}: Could not persist the safety marker: {error}"))?;
    if active_matches {
        advance_selection_revision(registry)?;
        registry.last_active_path = None;
        if let Err(error) = write_registry_at(profile, registry) {
            let detail = clear_deletion_marker(state_dir, &mut markers, id).err();
            return Err(format!(
                "{FAILED}: Could not clear the active database pointer: {error}{}",
                detail.map_or_else(String::new, |detail| format!(
                    ". Safety marker retained: {detail}"
                ))
            ));
        }
    }

    if let Err(failure) = tree.remove((&database, pinned_database), before_entry) {
        // After the destructive phase begins, any unconfirmed outcome retains the marker.
        let reason = if failure.removed == 0 {
            FAILED_MARKED
        } else {
            PARTIAL
        };
        return Err(format!("{reason}: Removed {} entries from {}. The safety marker was retained. Windows reported: {}",
            failure.removed, canonical.display(), failure.error));
    }

    let mut matches = matching_recents.into_iter();
    registry
        .recent
        .retain(|_| !matches.next().expect("one match for each recent entry"));
    if let Err(error) = write_registry_at(profile, registry) {
        return Err(format!("{REGISTRY_FAILED}: The directory was removed but the registry could not be saved: {error}"));
    }
    clear_deletion_marker(state_dir, &mut markers, id)
        .map_err(|error| format!("{REGISTRY_FAILED}: The directory and recent entry were removed but the safety marker could not be cleared: {error}"))
}

#[cfg(windows)]
fn clear_deletion_marker(
    state_dir: &Path,
    markers: &mut Vec<database_deletion::Marker>,
    id: database_deletion::Identity,
) -> AppResult<()> {
    markers.retain(|marker| marker.id != id);
    database_deletion::write_markers(state_dir, markers)
}

#[cfg(windows)]
fn preflight_failure(error: std::io::Error) -> String {
    if matches!(error.raw_os_error(), Some(32 | 33)) {
        return format!("{}: {error}", database_use::BUSY);
    }
    database_deletion::refuse(error)
}

#[cfg(windows)]
fn contains_identity(path: &Path, target: database_deletion::Identity) -> AppResult<bool> {
    let canonical = match path.canonicalize() {
        Ok(path) => path,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(false),
        Err(error) => return Err(database_deletion::refuse(error)),
    };
    for ancestor in canonical.ancestors() {
        if database_deletion::identity(ancestor).map_err(database_deletion::refuse)? == target {
            return Ok(true);
        }
    }
    Ok(false)
}

#[cfg(windows)]
pub(super) fn verify_deletion_ownership(
    folder: &Path,
    deny_writes: bool,
) -> AppResult<(PathBuf, database_deletion::Identity, Vec<fs::File>)> {
    use database_deletion::{refuse, safe_component, verify_file};
    let manifest_path = folder.join(DATABASE_MANIFEST_FILE);
    let mut evidence = Vec::new();
    let name = match fs::symlink_metadata(&manifest_path) {
        Ok(_) => {
            let (manifest_handle, _) =
                verify_file(&manifest_path, deny_writes).map_err(preflight_failure)?;
            if manifest_handle.metadata().map_err(refuse)?.len() > 1_048_576 {
                return Err(refuse("The database manifest is too large."));
            }
            let manifest: DatabaseManifest =
                serde_json::from_reader(&manifest_handle).map_err(refuse)?;
            if manifest.format != "eod-chart-db"
                || manifest.version != 1
                || !safe_component(std::ffi::OsStr::new(&manifest.db_file))
            {
                return Err(refuse(
                    "The database manifest has an invalid format or database filename.",
                ));
            }
            evidence.push(manifest_handle);
            manifest.db_file
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            DATABASE_FILE_NAME.to_string()
        }
        Err(error) => return Err(refuse(error)),
    };
    let database = folder.join(&name);
    let (file, id) = verify_file(&database, deny_writes).map_err(preflight_failure)?;
    evidence.push(file);
    for suffix in ["-wal", "-shm", "-journal"] {
        let path = folder.join(format!("{name}{suffix}"));
        match fs::symlink_metadata(&path) {
            Ok(_) => evidence.push(
                verify_file(&path, deny_writes)
                    .map_err(preflight_failure)?
                    .0,
            ),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(refuse(error)),
        }
    }
    let connection = Connection::open_with_flags(
        &database,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(refuse)?;
    let trusted_tables: i64 = connection.query_row(
        "SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name IN ('instruments', 'eod_prices', 'download_log')",
        [], |row| row.get(0),
    ).map_err(refuse)?;
    if trusted_tables != 3 {
        return Err(refuse(
            "The SQLite file does not have the EOD Chart database schema.",
        ));
    }
    for sql in [
        "SELECT symbol, exchange, isin FROM instruments LIMIT 0",
        "SELECT symbol, exchange, date, open, high, low, close FROM eod_prices LIMIT 0",
        "SELECT trade_date, exchange, rows_inserted FROM download_log LIMIT 0",
    ] {
        connection.prepare(sql).map_err(refuse)?;
    }
    Ok((database, id, evidence))
}

#[cfg(windows)]
fn close_matching_cached_connection(
    app: &AppHandle,
    id: database_deletion::Identity,
) -> AppResult<bool> {
    let state = app.state::<ActiveDatabaseConnectionState>();
    let mut cached = state
        .cached
        .lock()
        .map_err(|_| "Unable to lock the active database connection.")?;
    if !cached.as_ref().is_some_and(|entry| {
        database_deletion::identity(&entry.folder_path).is_ok_and(|cached_id| cached_id == id)
    }) {
        return Ok(false);
    }
    let entry = cached.take().expect("a matching cached connection");
    if let Err((connection, error)) = entry.connection.close() {
        *cached = Some(CachedDatabaseConnection {
            connection,
            ..entry
        });
        return Err(format!(
            "{}: Unable to close the database connection: {error}",
            database_deletion::FAILED
        ));
    }
    Ok(true)
}

#[cfg(windows)]
fn publish_deletion_snapshot(app: &AppHandle, registry: &DatabaseRegistryFile) -> AppSnapshot {
    let active_database_path = registry
        .last_active_path
        .as_ref()
        .filter(|path| database_deletion::blocked(Path::new(path)).is_ok_and(|blocked| !blocked))
        .cloned();
    let theme = if active_database_path.is_some() {
        crate::app_profile::read_saved_app_profile_theme(app).unwrap_or_else(|_| "dark".to_string())
    } else {
        "dark".to_string()
    };
    let snapshot = AppSnapshot {
        active_database_path,
        known_databases: registry.recent.clone(),
        db_stats: None,
        watchlists: Vec::new(),
        theme,
    };
    if let Err(error) = emit_database_changed(app, &snapshot) {
        log_runtime_event(app, "WARN", "delete-database-snapshot", Some(&error));
    }
    snapshot
}

fn create_database_at_internal(
    app: &AppHandle,
    folder_path: PathBuf,
    requested_mode: Option<PriceStorageMode>,
) -> AppResult<AppSnapshot> {
    let normalized_path = normalize_database_folder_path(folder_path)?;
    database_deletion::require_unblocked(&normalized_path)?;
    if is_database_folder(&normalized_path)? {
        return open_database_at_internal(app, normalized_path);
    }

    let revision = registry_revision(app)?;
    prepare_database_folder(&normalized_path)?;
    let connection = prepare_database_at(&normalized_path, true, requested_mode)?;
    let manifest = read_database_manifest(&normalized_path)?
        .ok_or("Prepared database is missing its manifest.")?;
    publish_prepared_database(app, &normalized_path, &manifest.name, revision, connection)
}

fn open_database_at_internal(app: &AppHandle, folder_path: PathBuf) -> AppResult<AppSnapshot> {
    let normalized_path = normalize_database_folder_path(folder_path)?;
    database_deletion::require_unblocked(&normalized_path)?;
    if !normalized_path.is_dir() {
        return Err(format!(
            "Database folder does not exist: {}",
            path_to_string(&normalized_path)
        ));
    }

    let (label, database_file_path) = load_database_file_info(&normalized_path)?;
    if !database_file_path.is_file() {
        return Err(format!(
            "Selected folder is not an EOD Chart database: {}",
            path_to_string(&normalized_path)
        ));
    }
    let label = label.unwrap_or_else(|| {
        normalized_path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("Database")
            .to_string()
    });
    let revision = registry_revision(app)?;
    let connection = prepare_database_at(&normalized_path, false, None)?;
    publish_prepared_database(app, &normalized_path, &label, revision, connection)
}

fn registry_revision(app: &AppHandle) -> AppResult<u64> {
    let _registry = database_use::lock_registry()?;
    Ok(read_registry(app)?.active_selection_revision)
}

fn publish_prepared_database(
    app: &AppHandle,
    folder_path: &Path,
    label: &str,
    revision: u64,
    connection: Connection,
) -> AppResult<AppSnapshot> {
    let registry_guard = database_use::lock_registry()?;
    if read_registry(app)?.active_selection_revision != revision {
        return Err(
            "Database selection changed during preparation. Open the database again.".into(),
        );
    }
    touch_registry(app, folder_path, label)?;
    cache_prepared_connection(app, folder_path, connection)?;
    snapshot_locked(
        app,
        Some(&SnapshotOptions {
            include_stats: Some(false),
            include_watchlists: Some(false),
        }),
        registry_guard,
    )
}

pub(crate) fn get_app_snapshot_internal(
    app: &AppHandle,
    options: Option<&SnapshotOptions>,
) -> AppResult<AppSnapshot> {
    let _permit = database_use::acquire_use()?;
    let registry_guard = database_use::lock_registry()?;
    snapshot_locked(app, options, registry_guard)
}

fn snapshot_locked(
    app: &AppHandle,
    options: Option<&SnapshotOptions>,
    registry_guard: fs::File,
) -> AppResult<AppSnapshot> {
    let registry = read_registry(app)?;
    let active_database_folder = resolve_active_folder_locked(app, &registry)?;
    // Theme initialization can read legacy settings through with_active_connection.
    drop(registry_guard);
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

pub(crate) fn resolve_active_database_folder(app: &AppHandle) -> AppResult<Option<DatabasePath>> {
    let permit = database_use::acquire_use()?;
    let _registry = database_use::lock_registry()?;
    let registry = read_registry(app)?;
    Ok(resolve_active_folder_locked(app, &registry)?.map(|path| DatabasePath::new(path, permit)))
}

fn resolve_active_folder_locked(
    app: &AppHandle,
    registry: &DatabaseRegistryFile,
) -> AppResult<Option<PathBuf>> {
    let Some(active_path) = registry.last_active_path.clone() else {
        clear_cached_connection(app)?;
        return Ok(None);
    };

    let folder_path = normalize_database_folder_path(PathBuf::from(active_path))?;
    if database_deletion::blocked(&folder_path)? {
        clear_cached_connection(app)?;
        return Ok(None);
    }
    if folder_path.exists() && is_database_folder(&folder_path)? {
        return Ok(Some(folder_path));
    }

    let mut next = registry.clone();
    advance_selection_revision(&mut next)?;
    next.last_active_path = None;
    write_registry(app, &next)?;
    clear_cached_connection(app)?;
    Ok(None)
}

pub(crate) fn get_active_database_file_path(app: &AppHandle) -> AppResult<Option<DatabasePath>> {
    let Some(folder_path) = resolve_active_database_folder(app)? else {
        return Ok(None);
    };

    let manifest = read_database_manifest(&folder_path)?;
    let path = resolve_database_file_path(&folder_path, manifest.as_ref());
    Ok(Some(folder_path.with_path(path)))
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

    read_existing_registry(&registry_path)
}

fn read_existing_registry(registry_path: &Path) -> AppResult<DatabaseRegistryFile> {
    let raw = fs::read_to_string(registry_path).map_err(|error| error.to_string())?;
    let parsed = serde_json::from_str::<DatabaseRegistryFile>(&raw)
        .map_err(|error| format!("Unable to parse database registry: {error}"))?;
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
        active_selection_revision: parsed.active_selection_revision,
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
    write_registry_at(&registry_path, registry)
}

fn write_registry_at(registry_path: &Path, registry: &DatabaseRegistryFile) -> AppResult<()> {
    let serialized = serde_json::to_string_pretty(registry).map_err(|error| error.to_string())?;
    database_use::atomic_write(registry_path, serialized.as_bytes())
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
    advance_selection_revision(&mut registry)?;
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
    if create_if_missing {
        let (_, path) = load_database_file_info(folder_path)?;
        if !path.try_exists().map_err(|error| error.to_string())? {
            return prepare_database_at(folder_path, true, None);
        }
    }
    let connection = open_database_file(folder_path, false)?;
    configure_database_connection(&connection)?;
    Ok(connection)
}

fn prepare_database_at(
    folder_path: &Path,
    allow_create: bool,
    requested_mode: Option<PriceStorageMode>,
) -> AppResult<Connection> {
    database_use::CanonicalAccess::for_database(folder_path)?.run_schema_preparation(
        || {
            let (_, database_file) = load_database_file_info(folder_path)?;
            let creating = allow_create
                && !database_file
                    .try_exists()
                    .map_err(|error| error.to_string())?;
            Ok((open_database_file(folder_path, creating)?, creating))
        },
        |(connection, creating)| {
            prepare_database_connection(&connection)?;
            if creating && requested_mode == Some(PriceStorageMode::Binary) {
                set_price_storage_mode(&connection, PriceStorageMode::Binary)?;
            }
            Ok(connection)
        },
    )
}

fn open_database_file(folder_path: &Path, allow_create: bool) -> AppResult<Connection> {
    let manifest = if allow_create {
        Some(ensure_database_manifest(folder_path)?)
    } else {
        read_database_manifest(folder_path)?
    };
    let path = resolve_database_file_path(folder_path, manifest.as_ref());
    if !allow_create && !path.exists() {
        return Err(format!(
            "Database file does not exist: {}",
            path_to_string(&path)
        ));
    }
    let mut flags = OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_NO_MUTEX;
    if allow_create {
        flags |= OpenFlags::SQLITE_OPEN_CREATE;
    }
    Connection::open_with_flags(path, flags).map_err(|error| error.to_string())
}

pub(crate) fn open_read_only_connection_for_folder(folder_path: &Path) -> AppResult<Connection> {
    let (_, file) = load_database_file_info(folder_path)?;
    if !file.exists() {
        return Err(format!(
            "Database file does not exist: {}",
            path_to_string(&file)
        ));
    }
    open_read_only_sqlite(&file, "")
}

#[cfg(all(windows, feature = "wp02-acceptance"))]
pub(super) fn open_wp02_acceptance_connection(
    folder_path: &Path,
) -> AppResult<(fs::File, Connection)> {
    use std::os::windows::fs::OpenOptionsExt;
    use windows::Win32::Storage::FileSystem::FILE_SHARE_READ;

    let (_, file) = load_database_file_info(folder_path)?;
    // Holding this handle prevents SQLite writers and file replacement until the
    // immutable reader is closed. A canonical read lease must already be held.
    let guard = fs::OpenOptions::new()
        .read(true)
        .share_mode(FILE_SHARE_READ.0)
        .open(&file)
        .map_err(|error| format!("WP-02 needs a quiescent database: {error}"))?;
    if database_use::CanonicalAccess::has_file_reparse_point(&file)? {
        return Err("WP-02 requires the canonical SQLite filename.".into());
    }
    for suffix in ["-wal", "-shm", "-journal"] {
        let mut sidecar = file.as_os_str().to_owned();
        sidecar.push(suffix);
        match fs::symlink_metadata(PathBuf::from(sidecar)) {
            Ok(_) => {
                return Err(format!(
                    "WP-02 needs a clean database with no {suffix} sidecar."
                ));
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(format!("WP-02 could not inspect {suffix}: {error}")),
        }
    }
    let connection = open_read_only_sqlite(&file, "&immutable=1")?;
    Ok((guard, connection))
}

fn open_read_only_sqlite(database_file_path: &Path, uri_options: &str) -> AppResult<Connection> {
    let uri_path = encode_sqlite_uri_path(database_file_path);
    let connection = Connection::open_with_flags(
        format!("file:{uri_path}?mode=ro{uri_options}"),
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

pub(super) fn with_connection_for_folder<T, F>(
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

fn cache_prepared_connection(
    app: &AppHandle,
    folder_path: &Path,
    connection: Connection,
) -> AppResult<()> {
    let state = app.state::<ActiveDatabaseConnectionState>();
    let mut cached = state
        .cached
        .lock()
        .map_err(|_| "Unable to lock the active database connection.".to_string())?;
    *cached = Some(CachedDatabaseConnection {
        folder_path: folder_path.to_path_buf(),
        connection,
        db_stats_cache: None,
    });
    Ok(())
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
    database_deletion::require_unblocked(folder_path)?;
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
    let temp_connection = open_read_only_connection_for_folder(folder_path)?;
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
            _ => {
                // Cache now points elsewhere, just drop our results and temp_connection
            }
        }
    }

    Ok(Some(stats))
}

// R1-A: no registry read/repair, connection initialization or cache mutation.
pub(crate) fn peek_active_database_folder_read_only(
    app: &AppHandle,
) -> AppResult<Option<DatabasePath>> {
    let Some(state) = app.try_state::<ActiveDatabaseConnectionState>() else {
        return Ok(None);
    };
    let permit = database_use::acquire_use()?;
    let Some(path) = peek_cached_folder_only(&state)? else {
        return Ok(None);
    };
    if database_deletion::blocked(&path)? {
        return Ok(None);
    }
    Ok(Some(DatabasePath::new(path, permit)))
}

fn peek_cached_folder_only(state: &ActiveDatabaseConnectionState) -> AppResult<Option<PathBuf>> {
    let cached = state
        .cached
        .lock()
        .map_err(|_| "Cached database context lock is poisoned.".to_string())?;
    Ok(cached.as_ref().map(|entry| entry.folder_path.clone()))
}

#[cfg(test)]
mod native_selection_revision_tests {
    use super::*;

    #[test]
    fn old_registry_is_compatible_and_revision_refuses_wraparound() {
        let mut registry: DatabaseRegistryFile =
            serde_json::from_str(r#"{"recent":[],"lastActivePath":null}"#).unwrap();
        assert_eq!(registry.active_selection_revision, 0);
        advance_selection_revision(&mut registry).unwrap();
        assert_eq!(registry.active_selection_revision, 1);
        registry.active_selection_revision = u64::MAX;
        assert!(advance_selection_revision(&mut registry).is_err());
    }

    #[test]
    fn original_selection_is_invalid_after_aba_or_database_file_replacement() {
        let fixtures = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("tmp/fixtures/ns04-selection-identity");
        fs::create_dir_all(&fixtures).unwrap();
        let temp = tempfile::tempdir_in(fixtures).unwrap();
        let a = temp.path().join("A");
        let b = temp.path().join("B");
        fs::create_dir(&a).unwrap();
        fs::create_dir(&b).unwrap();
        for folder in [&a, &b] {
            drop(Connection::open(folder.join(DATABASE_FILE_NAME)).unwrap());
        }
        let path_a = path_to_string(&a);
        let path_b = path_to_string(&b);
        let mut registry = DatabaseRegistryFile {
            recent: vec![
                KnownDatabase {
                    path: path_a.clone(),
                    label: "A".to_string(),
                    last_opened_at: String::new(),
                },
                KnownDatabase {
                    path: path_b.clone(),
                    label: "B".to_string(),
                    last_opened_at: String::new(),
                },
            ],
            last_active_path: Some(path_a.clone()),
            active_selection_revision: 1,
        };
        let original = native_selection_from_registry(&registry).unwrap().unwrap();
        assert_eq!(original.database_identity, format!("{path_a}#1"));
        advance_selection_revision(&mut registry).unwrap();
        registry.last_active_path = Some(path_b);
        assert_ne!(
            native_selection_from_registry(&registry).unwrap(),
            Some(original.clone())
        );
        advance_selection_revision(&mut registry).unwrap();
        registry.last_active_path = Some(path_a.clone());
        let returned = native_selection_from_registry(&registry).unwrap().unwrap();
        assert_ne!(returned, original);
        assert_eq!(returned.canonical_folder, original.canonical_folder);
        assert_eq!(
            returned.physical_file_identity,
            original.physical_file_identity
        );

        let sqlite = a.join(DATABASE_FILE_NAME);
        fs::rename(&sqlite, a.join("previous.sqlite3")).unwrap();
        drop(Connection::open(&sqlite).unwrap());
        let replaced = native_selection_from_registry(&registry).unwrap().unwrap();
        assert_eq!(replaced.database_identity, returned.database_identity);
        assert_ne!(
            replaced.physical_file_identity,
            returned.physical_file_identity
        );
        assert_ne!(replaced, returned);

        registry.last_active_path = None;
        assert!(native_selection_from_registry(&registry).unwrap().is_none());
        registry.last_active_path = Some(path_a);
        registry.recent.clear();
        assert!(native_selection_from_registry(&registry).is_err());
    }

    #[test]
    fn nsr7_shared_sqlite_manifests_contend_and_share_interruption_admission() {
        let fixture = tempfile::tempdir().unwrap();
        let a = fixture.path().join("a");
        let b = fixture.path().join("b");
        fs::create_dir(&a).unwrap();
        fs::create_dir(&b).unwrap();
        let sqlite = a.join(DATABASE_FILE_NAME);
        let connection = Connection::open(&sqlite).unwrap();
        connection
            .execute_batch(
                "CREATE TABLE witness(value INTEGER);
                                  INSERT INTO witness VALUES(0);",
            )
            .unwrap();
        let manifest = DatabaseManifest {
            format: "eod-chart-db".into(),
            version: 1,
            name: "b".into(),
            db_file: sqlite.to_string_lossy().into_owned(),
            created_at: String::new(),
        };
        fs::write(
            b.join(DATABASE_MANIFEST_FILE),
            serde_json::to_vec(&manifest).unwrap(),
        )
        .unwrap();
        assert_eq!(load_database_file_info(&b).unwrap().1, sqlite);

        let first = database_use::CanonicalAccess::in_namespace(&a, fixture.path()).unwrap();
        let second = database_use::CanonicalAccess::in_namespace(&b, fixture.path()).unwrap();
        let independent = fixture.path().join("independent");
        fs::create_dir(&independent).unwrap();
        drop(Connection::open(independent.join(DATABASE_FILE_NAME)).unwrap());
        let third =
            database_use::CanonicalAccess::in_namespace(&independent, fixture.path()).unwrap();
        let read = first.begin_read().unwrap();
        assert_eq!(
            first.run_schema_preparation(|| Ok(()), Ok).unwrap_err(),
            "CANONICAL_PRICE_STORE_BUSY"
        );
        let update = |alias: Connection| {
            alias
                .execute("UPDATE witness SET value=1", [])
                .map_err(|error| error.to_string())?;
            Ok(())
        };
        let open = || open_connection_for_folder(&b, false);
        assert_eq!(
            second.run_schema_preparation(open, update).unwrap_err(),
            "CANONICAL_PRICE_STORE_BUSY"
        );
        let value = || {
            connection
                .query_row("SELECT value FROM witness", [], |row| row.get::<_, i64>(0))
                .unwrap()
        };
        assert_eq!(value(), 0);
        third.run_schema_preparation(|| Ok(()), Ok).unwrap();
        drop(read);
        assert_eq!(
            second
                .run_schema_preparation(open, |alias| {
                    update(alias)?;
                    Err::<(), _>("simulated failure after SQLite changed".into())
                })
                .unwrap_err(),
            "simulated failure after SQLite changed"
        );
        assert_eq!(value(), 1);
        assert_eq!(
            first.begin_read().unwrap_err(),
            "CANONICAL_PRICE_STORE_INTERRUPTED"
        );
        assert!(third.begin_read().is_ok());
        second.run_schema_preparation(open, update).unwrap();
        first.begin_read().unwrap();
    }

    #[cfg(windows)]
    #[test]
    fn nsr7_canonical_read_refuses_multiple_sqlite_hardlink_names() {
        let fixture = tempfile::tempdir().unwrap();
        let folder = fixture.path();
        let original = folder.join(DATABASE_FILE_NAME);
        drop(Connection::open(&original).unwrap());
        fs::hard_link(&original, folder.join("hardlink.sqlite3")).unwrap();
        let access = database_use::CanonicalAccess::in_namespace(folder, folder).unwrap();
        assert!(access.begin_read().unwrap_err().contains("WAL family"));
        assert!(database_use::CanonicalAccess::lock_writer_for_database(folder).is_ok());
    }
}

#[cfg(all(test, windows))]
mod deletion_registry_tests {
    use super::*;
    use database_deletion::{blocked_in, PinnedTree, FAILED, PARTIAL, REGISTRY_FAILED};
    use std::os::windows::fs::OpenOptionsExt;

    struct Fixture {
        _workspace: tempfile::TempDir,
        state: PathBuf,
        registry_path: PathBuf,
        folder: PathBuf,
    }

    impl Fixture {
        fn new() -> Self {
            let parent = Path::new(env!("CARGO_MANIFEST_DIR"))
                .parent()
                .unwrap()
                .join("tmp/fixtures/db-safe-01");
            fs::create_dir_all(&parent).unwrap();
            let workspace = tempfile::tempdir_in(parent).unwrap();
            let state = workspace.path().join("safety-state");
            let registry_path = workspace.path().join("registry.json");
            let folder = workspace.path().join("db");
            fs::create_dir(&state).unwrap();
            fs::create_dir(&folder).unwrap();
            let connection = Connection::open(folder.join(DATABASE_FILE_NAME)).unwrap();
            prepare_database_connection(&connection).unwrap();
            Self {
                _workspace: workspace,
                state,
                registry_path,
                folder,
            }
        }

        fn registry(&self, active: bool) -> DatabaseRegistryFile {
            let path = path_to_string(&self.folder);
            let registry = DatabaseRegistryFile {
                recent: vec![KnownDatabase {
                    path: path.clone(),
                    label: "fixture".into(),
                    last_opened_at: "".into(),
                }],
                last_active_path: active.then_some(path),
                active_selection_revision: 0,
            };
            write_registry_at(&self.registry_path, &registry).unwrap();
            registry
        }

        fn preflight(&self, registry: &DatabaseRegistryFile) -> VerifiedDeletion {
            let tree = PinnedTree::open(&self.folder).unwrap();
            let (matching_recents, active_matches) =
                registry_deletion_matches(registry, tree.id).unwrap();
            let canonical = self.folder.canonicalize().unwrap();
            let (database, id, evidence) = verify_deletion_ownership(&tree.path, true).unwrap();
            tree.preflight(&database).unwrap();
            let pinned_database = tree.pin_database(&database, id).unwrap();
            drop(evidence);
            VerifiedDeletion {
                tree,
                canonical,
                database,
                pinned_database,
                matching_recents,
                active_matches,
            }
        }
    }

    #[test]
    fn registered_deletion_requires_identity_and_removes_aliases_after_success() {
        let fixture = Fixture::new();
        let id = database_deletion::identity(&fixture.folder).unwrap();
        assert!(registry_deletion_matches(&DatabaseRegistryFile::default(), id).is_err());
        let mut registry = fixture.registry(true);
        let mut alias = registry.recent[0].clone();
        alias.path = path_to_string(&fixture.folder.canonicalize().unwrap());
        registry.recent.push(alias);
        let _safety_store = PinnedTree::pin_marker_store(&fixture.state).unwrap();
        let moved_state = fixture.state.with_file_name("moved-safety-state");
        assert!(fs::rename(&fixture.state, moved_state).is_err());
        let deletion = fixture.preflight(&registry);
        assert_eq!(deletion.matching_recents, [true, true]);
        assert!(deletion.active_matches);
        complete_verified_deletion(
            &fixture.state,
            &fixture.registry_path,
            &mut registry,
            deletion,
            |_| {
                assert!(read_existing_registry(&fixture.registry_path)
                    .unwrap()
                    .last_active_path
                    .is_none());
                assert_eq!(
                    read_existing_registry(&fixture.registry_path)
                        .unwrap()
                        .recent
                        .len(),
                    2
                );
                assert!(blocked_in(&fixture.state, &fixture.folder).unwrap());
                Ok(())
            },
        )
        .unwrap();
        assert!(!fixture.folder.exists());
        assert!(read_existing_registry(&fixture.registry_path)
            .unwrap()
            .recent
            .is_empty());
        assert!(database_deletion::read_markers(&fixture.state)
            .unwrap()
            .is_empty());
    }

    #[test]
    fn locked_marker_stops_deletion_before_registry_or_database_changes() {
        let fixture = Fixture::new();
        let mut registry = fixture.registry(true);
        let _safety_store = PinnedTree::pin_marker_store(&fixture.state).unwrap();
        database_deletion::write_markers(&fixture.state, &[]).unwrap();
        let marker = fixture.state.join("interrupted-deletions.json");
        let _marker_lock = fs::OpenOptions::new()
            .read(true)
            .share_mode(3)
            .open(marker)
            .unwrap();
        let deletion = fixture.preflight(&registry);

        let error = complete_verified_deletion(
            &fixture.state,
            &fixture.registry_path,
            &mut registry,
            deletion,
            |_| panic!("removal must not start before the marker is persisted"),
        )
        .unwrap_err();

        assert!(error.starts_with(FAILED), "{error}");
        assert!(
            error.contains("Could not persist the safety marker"),
            "{error}"
        );
        assert!(fixture.folder.join(DATABASE_FILE_NAME).is_file());
        let persisted = read_existing_registry(&fixture.registry_path).unwrap();
        assert_eq!(persisted.last_active_path, registry.last_active_path);
        assert!(persisted.last_active_path.is_some());
        assert_eq!(persisted.recent.len(), 1);
    }

    #[test]
    fn partial_deletion_keeps_recents_and_blocks_stale_profiles() {
        let fixture = Fixture::new();
        let mut registry = fixture.registry(true);
        let stale_profile = fixture._workspace.path().join("other-profile.json");
        write_registry_at(&stale_profile, &registry).unwrap();
        fs::create_dir_all(fixture.folder.join("eod_data/NSE")).unwrap();
        fs::write(fixture.folder.join("eod_data/NSE/one.eod"), b"fixture").unwrap();
        let deletion = fixture.preflight(&registry);
        let error = complete_verified_deletion(
            &fixture.state,
            &fixture.registry_path,
            &mut registry,
            deletion,
            |entry| {
                if entry.ends_with(DATABASE_FILE_NAME) {
                    return Err(std::io::Error::other("injected before SQLite removal"));
                }
                Ok(())
            },
        )
        .unwrap_err();
        assert!(error.starts_with(PARTIAL), "{error}");
        let persisted = read_existing_registry(&fixture.registry_path).unwrap();
        assert!(persisted.last_active_path.is_none());
        assert_eq!(persisted.recent.len(), 1);
        assert!(fixture.folder.join(DATABASE_FILE_NAME).is_file());
        assert!(!fixture.folder.join("eod_data/NSE/one.eod").exists());
        let active = read_existing_registry(&stale_profile)
            .unwrap()
            .last_active_path
            .unwrap();
        assert!(blocked_in(&fixture.state, Path::new(&active)).unwrap());
    }

    #[test]
    fn registry_failure_before_and_after_removal_reports_distinct_states() {
        for active in [true, false] {
            let fixture = Fixture::new();
            let mut registry = fixture.registry(active);
            let deletion = fixture.preflight(&registry);
            let _read_lock = fs::OpenOptions::new()
                .read(true)
                .share_mode(3)
                .open(&fixture.registry_path)
                .unwrap();
            let error = complete_verified_deletion(
                &fixture.state,
                &fixture.registry_path,
                &mut registry,
                deletion,
                |_| Ok(()),
            )
            .unwrap_err();
            assert!(
                error.starts_with(if active { FAILED } else { REGISTRY_FAILED }),
                "{error}"
            );
            assert_eq!(fixture.folder.exists(), active);
            assert_eq!(
                read_existing_registry(&fixture.registry_path)
                    .unwrap()
                    .recent
                    .len(),
                1
            );
            assert_eq!(
                database_deletion::read_markers(&fixture.state)
                    .unwrap()
                    .is_empty(),
                active
            );
        }
    }
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
    fn nsr7_schema_preparation_is_explicit_and_recoverable() {
        let dir = tempfile::tempdir().unwrap();
        let folder = dir.path();
        drop(open_database_file(folder, true).unwrap());
        let has_price_schema = |connection: &Connection| {
            connection.query_row(
                "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'eod_prices')",
                [],
                |row| row.get::<_, bool>(0),
            ).unwrap()
        };
        let configured = open_connection_for_folder(folder, false).unwrap();
        assert!(!has_price_schema(&configured));
        drop(configured);
        let read_only = open_read_only_connection_for_folder(folder).unwrap();
        assert!(!has_price_schema(&read_only));
        assert!(load_db_stats(folder, &read_only).is_err());
        drop(read_only);

        let access = database_use::CanonicalAccess::in_namespace(folder, folder).unwrap();
        let reader = access.begin_read().unwrap();
        let busy = access.run_schema_preparation::<(), ()>(
            || panic!("a busy schema preparation must not open SQLite"),
            Ok,
        );
        assert_eq!(busy.unwrap_err(), "CANONICAL_PRICE_STORE_BUSY");
        drop(reader);
        assert!(access
            .run_schema_preparation(
                || Ok(()),
                |_| Err::<(), _>("interrupted preparation".into())
            )
            .is_err());
        assert_eq!(
            access.begin_read().unwrap_err(),
            "CANONICAL_PRICE_STORE_INTERRUPTED"
        );

        access
            .run_schema_preparation(
                || open_database_file(folder, false),
                |connection| prepare_database_connection(&connection),
            )
            .unwrap();
        assert!(access.begin_read().is_ok());
        let read_only = open_read_only_connection_for_folder(folder).unwrap();
        assert!(has_price_schema(&read_only));
        assert!(load_db_stats(folder, &read_only).is_ok());
        assert!(read_only
            .execute("CREATE TABLE read_only_probe (id INT)", [])
            .is_err());
        let configured = open_connection_for_folder(folder, false).unwrap();
        configured
            .execute("CREATE TEMP TABLE writable_probe (id INT)", [])
            .unwrap();
    }

    #[test]
    fn r1a_context_peek_preserves_cached_connection_and_folder() {
        let connection = Connection::open_in_memory().unwrap();
        let state = ActiveDatabaseConnectionState {
            cached: Mutex::new(Some(CachedDatabaseConnection {
                folder_path: PathBuf::from("E:/TEST"),
                connection,
                db_stats_cache: None,
            })),
        };
        assert_eq!(
            peek_cached_folder_only(&state).unwrap(),
            Some(PathBuf::from("E:/TEST"))
        );
        assert!(state
            .cached
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .connection
            .is_autocommit());
    }
}
