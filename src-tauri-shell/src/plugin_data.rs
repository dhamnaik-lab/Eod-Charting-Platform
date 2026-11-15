use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Read;
use std::path::PathBuf;

type AppResult<T> = Result<T, String>;

const HARD_MAX_PLUGIN_TEXT_FILE_BYTES: u64 = 32 * 1024 * 1024;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginDataFilePickerInput {
    pub title: Option<String>,
    pub filter_name: Option<String>,
    #[serde(default)]
    pub extensions: Vec<String>,
}


#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginOutputDirectoryPickerInput {
    pub title: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginTextFileReadInput {
    pub file_path: String,
    #[serde(default)]
    pub allowed_extensions: Vec<String>,
    pub max_bytes: Option<u64>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginTextFileReadResult {
    pub file_path: String,
    pub byte_length: u64,
    pub text: String,
}

fn normalize_extensions(values: &[String]) -> AppResult<Vec<String>> {
    let mut normalized = Vec::new();

    for value in values {
        let extension = value
            .trim()
            .trim_start_matches('.')
            .to_ascii_lowercase();
        if extension.is_empty() {
            continue;
        }
        if extension.len() > 16
            || !extension
                .chars()
                .all(|character| character.is_ascii_alphanumeric())
        {
            return Err(format!("Unsupported plugin data file extension: {value}"));
        }
        if !normalized.contains(&extension) {
            normalized.push(extension);
        }
    }

    if normalized.is_empty() {
        return Err("At least one plugin data file extension is required.".to_string());
    }

    Ok(normalized)
}

#[tauri::command]
pub fn pick_plugin_data_file(input: PluginDataFilePickerInput) -> AppResult<Option<String>> {
    let extensions = normalize_extensions(&input.extensions)?;
    let extension_refs: Vec<&str> = extensions.iter().map(String::as_str).collect();
    let title = input
        .title
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("Select Plugin Data File");
    let filter_name = input
        .filter_name
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("Plugin Data");

    Ok(rfd::FileDialog::new()
        .set_title(title)
        .add_filter(filter_name, &extension_refs)
        .pick_file()
        .map(|path| path.to_string_lossy().to_string()))
}


#[tauri::command]
pub fn pick_plugin_output_directory(
    input: PluginOutputDirectoryPickerInput,
) -> AppResult<Option<String>> {
    let title = input
        .title
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("Select Plugin Output Directory");

    Ok(rfd::FileDialog::new()
        .set_title(title)
        .pick_folder()
        .map(|path| path.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn read_plugin_text_file(input: PluginTextFileReadInput) -> AppResult<PluginTextFileReadResult> {
    let allowed_extensions = normalize_extensions(&input.allowed_extensions)?;
    let requested_path = input.file_path.trim();
    if requested_path.is_empty() {
        return Err("Plugin data file path is required.".to_string());
    }

    let canonical_path = fs::canonicalize(PathBuf::from(requested_path)).map_err(|error| {
        format!("Unable to resolve plugin data file at {requested_path}: {error}")
    })?;
    let metadata = fs::metadata(&canonical_path).map_err(|error| {
        format!(
            "Unable to inspect plugin data file at {}: {error}",
            canonical_path.display()
        )
    })?;
    if !metadata.is_file() {
        return Err(format!(
            "Plugin data path is not a file: {}",
            canonical_path.display()
        ));
    }

    let extension = canonical_path
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase)
        .ok_or_else(|| "Plugin data file must have a supported extension.".to_string())?;
    if !allowed_extensions.contains(&extension) {
        return Err(format!(
            "Plugin data file extension .{extension} is not allowed."
        ));
    }

    let max_bytes = input
        .max_bytes
        .unwrap_or(HARD_MAX_PLUGIN_TEXT_FILE_BYTES)
        .clamp(1, HARD_MAX_PLUGIN_TEXT_FILE_BYTES);
    if metadata.len() > max_bytes {
        return Err(format!(
            "Plugin data file is {} bytes; the configured limit is {max_bytes} bytes.",
            metadata.len()
        ));
    }

    let mut file = fs::File::open(&canonical_path).map_err(|error| {
        format!(
            "Unable to open plugin data file at {}: {error}",
            canonical_path.display()
        )
    })?;
    let mut bytes = Vec::with_capacity(metadata.len().min(max_bytes) as usize + 1);
    file.by_ref()
        .take(max_bytes + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| {
            format!(
                "Unable to read plugin data file at {}: {error}",
                canonical_path.display()
            )
        })?;
    let byte_length = bytes.len() as u64;
    if byte_length > max_bytes {
        return Err(format!(
            "Plugin data file exceeded the configured {max_bytes}-byte limit while it was being read."
        ));
    }
    let text = String::from_utf8(bytes).map_err(|_| {
        format!(
            "Plugin data file is not valid UTF-8 text: {}",
            canonical_path.display()
        )
    })?;

    Ok(PluginTextFileReadResult {
        file_path: canonical_path.to_string_lossy().to_string(),
        byte_length,
        text,
    })
}

// --- Phase P2: External Plugin Package Discovery, Loader & Installer ---

const MAX_EXTERNAL_PLUGIN_JS_BYTES: u64 = 4 * 1024 * 1024;
const MAX_EXTERNAL_PLUGIN_MANIFEST_BYTES: u64 = 64 * 1024;
const EXTERNAL_PLUGINS_DIR_NAME: &str = "plugins";

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalPluginManifestFile {
    pub id: String,
    pub name: String,
    pub version: String,
    pub min_host_version: Option<String>,
    #[serde(rename = "type", default = "default_external_plugin_type")]
    pub plugin_type: String,
    #[serde(default)]
    pub description: String,
    #[serde(default = "default_external_plugin_entry")]
    pub entry: String,
    #[serde(default)]
    pub capabilities: Vec<String>,
    #[serde(default)]
    pub permissions: Vec<String>,
}

fn default_external_plugin_type() -> String {
    "indicator".to_string()
}

fn default_external_plugin_entry() -> String {
    "main.js".to_string()
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalPluginPackageDescriptor {
    pub id: String,
    pub name: String,
    pub version: String,
    pub min_host_version: Option<String>,
    pub plugin_type: String,
    pub description: String,
    pub entry: String,
    pub capabilities: Vec<String>,
    pub permissions: Vec<String>,
    pub folder_path: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalPluginIdInput {
    pub plugin_id: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalPluginModuleReadResult {
    pub plugin_id: String,
    pub entry: String,
    pub code: String,
}

fn validate_external_plugin_id(raw_id: &str) -> AppResult<String> {
    let trimmed = raw_id.trim();
    if trimmed.is_empty() || trimmed.len() > 64 {
        return Err("External plugin id must be between 1 and 64 characters.".to_string());
    }
    if !trimmed
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
        || trimmed.starts_with('.')
        || trimmed.contains("..")
    {
        return Err(format!("Invalid external plugin id: {trimmed}"));
    }
    Ok(trimmed.to_string())
}

fn validate_external_entry_file(raw_entry: &str) -> AppResult<String> {
    let trimmed = raw_entry.trim();
    if trimmed.is_empty()
        || trimmed.contains('/')
        || trimmed.contains('\\')
        || trimmed.contains("..")
        || !trimmed.to_ascii_lowercase().ends_with(".js")
    {
        return Err(format!("External plugin entry must be a local .js filename: {trimmed}"));
    }
    Ok(trimmed.to_string())
}

fn get_external_plugins_root(app: &tauri::AppHandle) -> AppResult<PathBuf> {
    let profile_dir = crate::app_profile::get_app_profile_directory(app)?;
    let plugins_dir = profile_dir.join(EXTERNAL_PLUGINS_DIR_NAME);
    fs::create_dir_all(&plugins_dir).map_err(|e| format!("Unable to create plugins directory: {e}"))?;
    Ok(plugins_dir)
}

fn read_external_manifest_in_folder(folder: & std::path::Path) -> AppResult<ExternalPluginPackageDescriptor> {
    let manifest_path = folder.join("manifest.json");
    let raw = fs::read_to_string(&manifest_path)
        .map_err(|e| format!("Unable to read {}: {e}", manifest_path.display()))?;
    let parsed: ExternalPluginManifestFile = serde_json::from_str(&raw)
        .map_err(|e| format!("Invalid manifest.json in {}: {e}", folder.display()))?;
    let id = validate_external_plugin_id(&parsed.id)?;
    let entry = validate_external_entry_file(&parsed.entry)?;
    let entry_path = folder.join(&entry);
    if !entry_path.is_file() {
        return Err(format!("Plugin entry file '{}' is missing in {}.", entry, folder.display()));
    }
    Ok(ExternalPluginPackageDescriptor {
        id,
        name: parsed.name.trim().to_string(),
        version: parsed.version.trim().to_string(),
        min_host_version: parsed.min_host_version,
        plugin_type: parsed.plugin_type,
        description: parsed.description,
        entry,
        capabilities: parsed.capabilities,
        permissions: parsed.permissions,
        folder_path: folder.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn list_external_plugins(app: tauri::AppHandle) -> AppResult<Vec<ExternalPluginPackageDescriptor>> {
    let root = get_external_plugins_root(&app)?;
    recover_external_plugins_on_discovery(&root)?;
    let mut plugins = Vec::new();
    for entry in fs::read_dir(&root).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_dir() && path.join("manifest.json").is_file() {
            if let Ok(desc) = read_external_manifest_in_folder(&path) {
                plugins.push(desc);
            }
        }
    }
    plugins.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(plugins)
}

#[tauri::command]
pub fn read_external_plugin_module(
    app: tauri::AppHandle,
    input: ExternalPluginIdInput,
) -> AppResult<ExternalPluginModuleReadResult> {
    let id = validate_external_plugin_id(&input.plugin_id)?;
    let root = get_external_plugins_root(&app)?;
    let _id_lock = lock_external_plugin_id(&root, &id)?;
    let _ = recover_external_plugin_locked(&root, &id)?;
    let folder = root.join(&id);
    let desc = read_external_manifest_in_folder(&folder)?;
    let entry_path = folder.join(&desc.entry);
    let meta = fs::metadata(&entry_path).map_err(|e| e.to_string())?;
    if meta.len() > MAX_EXTERNAL_PLUGIN_JS_BYTES {
        return Err(format!("Plugin module {} exceeds 4 MB limit.", desc.entry));
    }
    let code = fs::read_to_string(&entry_path).map_err(|e| e.to_string())?;
    Ok(ExternalPluginModuleReadResult {
        plugin_id: desc.id,
        entry: desc.entry,
        code,
    })
}

// P5-E: The Windows file handle is the per-id inter-process serialization fence.
// Windows share_mode(0) denies a concurrent open and the OS releases it on crash.
// On non-Windows, create_new is fail-closed after an abnormal exit; no automatic
// removal of possibly active lockfiles is attempted.
struct ExternalPluginInstallLock {
    _handle: fs::File,
    #[cfg(not(windows))]
    file_path: PathBuf,
}

#[cfg(not(windows))]
impl Drop for ExternalPluginInstallLock {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.file_path);
    }
}

fn external_plugin_transactions_root(plugins_root: &std::path::Path) -> AppResult<PathBuf> {
    let transactions = plugins_root.join(".install-transactions");
    match fs::symlink_metadata(&transactions) {
        Ok(metadata) if !metadata.is_dir() || metadata.file_type().is_symlink() => {
            return Err("Plugin transaction directory must be a real directory.".to_string());
        }
        Ok(_) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(format!("Unable to inspect plugin transactions: {error}")),
    }
    fs::create_dir_all(&transactions).map_err(|error| error.to_string())?;
    Ok(transactions)
}

fn lock_external_plugin_id(
    plugins_root: &std::path::Path,
    id: &str,
) -> AppResult<ExternalPluginInstallLock> {
    let id = validate_external_plugin_id(id)?;
    let transactions = external_plugin_transactions_root(plugins_root)?;
    let file_path = transactions.join(format!("{id}.lock"));
    // Never follow a pre-existing symlink or accept an unexpected non-file.
    match fs::symlink_metadata(&file_path) {
        Ok(metadata) if !metadata.is_file() || metadata.file_type().is_symlink() => {
            return Err("Plugin installation lock path must be a real file.".to_string());
        }
        Ok(_) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(format!("Unable to inspect plugin lock: {error}")),
    }
    #[cfg(windows)]
    let handle = {
        use std::os::windows::fs::OpenOptionsExt;
        fs::OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .share_mode(0)
            .open(&file_path)
            .map_err(|error| format!("Plugin {id} is already being modified or cannot be locked: {error}"))?
    };
    #[cfg(not(windows))]
    let handle = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&file_path)
        .map_err(|error| format!("Plugin {id} is already being modified or has an unresolved lock: {error}"))?;
    Ok(ExternalPluginInstallLock {
        _handle: handle,
        #[cfg(not(windows))]
        file_path,
    })
}

// Pre-P5-E transactions were named <id>.<pid>.<nanos>.<attempt>.previous.
// Parse from the right because valid IDs may themselves contain periods.
fn previous_transaction_plugin_id(name: &str) -> Option<String> {
    let stem = name.strip_suffix(".previous")?;
    let (before_attempt, attempt) = stem.rsplit_once('.')?;
    let (before_nanos, nanos) = before_attempt.rsplit_once('.')?;
    let (id, pid) = before_nanos.rsplit_once('.')?;
    if attempt.parse::<u8>().is_err() || nanos.parse::<u128>().is_err() || pid.parse::<u32>().is_err() {
        return None;
    }
    validate_external_plugin_id(id).ok()
}

// Caller MUST hold the matching per-id lock. Never overwrite a current
// installation, delete unrecognized artifacts, or choose among two backups.
fn recover_external_plugin_locked(plugins_root: &std::path::Path, id: &str) -> AppResult<bool> {
    let transactions = external_plugin_transactions_root(plugins_root)?;
    let mut previous = Vec::new();
    for dir_entry in fs::read_dir(&transactions).map_err(|error| error.to_string())? {
        let entry = dir_entry.map_err(|error| error.to_string())?;
        let name = entry.file_name();
        let Some(name) = name.to_str() else { continue };
        if previous_transaction_plugin_id(name).as_deref() != Some(id) { continue; }
        let metadata = fs::symlink_metadata(entry.path()).map_err(|error| error.to_string())?;
        if !metadata.is_dir() || metadata.file_type().is_symlink() {
            return Err(format!("Unsafe previous-version recovery artifact for plugin {id}."));
        }
        let descriptor = read_external_manifest_in_folder(&entry.path())?;
        if descriptor.id != id {
            return Err(format!("Previous-version recovery artifact has wrong plugin ID {id}."));
        }
        previous.push(entry.path());
    }
    if previous.is_empty() { return Ok(false); }
    let destination = plugins_root.join(id);
    match fs::symlink_metadata(&destination) {
        Ok(metadata) if metadata.is_dir() && !metadata.file_type().is_symlink() => {
            // A newer complete destination exists: never overwrite it. An old
            // recovery copy remains deliberately available for manual review.
            return Ok(false);
        }
        Ok(_) => return Err(format!("Plugin {id} destination is not a real directory.")),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(format!("Unable to inspect plugin {id} during recovery: {error}")),
    }
    if previous.len() != 1 {
        return Err(format!("Ambiguous previous versions for plugin {id}; manual recovery required."));
    }
    fs::rename(&previous[0], &destination)
        .map_err(|error| format!("Unable to restore interrupted plugin {id}: {error}"))?;
    Ok(true)
}

fn recover_external_plugins_on_discovery(plugins_root: &std::path::Path) -> AppResult<()> {
    let transactions = external_plugin_transactions_root(plugins_root)?;
    let mut ids = std::collections::BTreeSet::new();
    for item in fs::read_dir(&transactions).map_err(|error| error.to_string())? {
        let entry = item.map_err(|error| error.to_string())?;
        let name = entry.file_name();
        if let Some(name) = name.to_str() {
            if let Some(id) = previous_transaction_plugin_id(name) {
                ids.insert(id);
            }
        }
    }
    for id in ids {
        let _lock = lock_external_plugin_id(plugins_root, &id)?;
        let _ = recover_external_plugin_locked(plugins_root, &id)?;
    }
    Ok(())
}

// A candidate is always completed and validated before the installed plugin is moved.
// Transaction artifacts are nested so discovery does not treat them as plugins.
fn install_external_plugin_staged<F, G>(
    plugins_root: &std::path::Path,
    id: &str,
    write_candidate: F,
    before_promote: G,
) -> AppResult<ExternalPluginPackageDescriptor>
where
    F: FnOnce(&std::path::Path) -> AppResult<()>,
    G: FnOnce() -> AppResult<()>,
{
    let _id_lock = lock_external_plugin_id(plugins_root, id)?;
    let _ = recover_external_plugin_locked(plugins_root, id)?;
    let transactions = external_plugin_transactions_root(plugins_root)?;

    let mut created = None;
    for attempt in 0..16_u8 {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|error| error.to_string())?
            .as_nanos();
        let prefix = format!("{id}.{}.{}.{}", std::process::id(), nanos, attempt);
        let staging = transactions.join(format!("{prefix}.staging"));
        let previous = transactions.join(format!("{prefix}.previous"));
        if fs::symlink_metadata(&previous).is_ok() {
            continue;
        }
        match fs::create_dir(&staging) {
            Ok(()) => {
                created = Some((staging, previous));
                break;
            }
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(format!("Unable to stage plugin: {error}")),
        }
    }
    let (staging, previous) = created.ok_or("Unable to reserve a unique plugin staging directory.")?;
    let candidate = (|| {
        write_candidate(&staging)?;
        let description = read_external_manifest_in_folder(&staging)?;
        if description.id != id {
            return Err("Staged plugin id does not match requested plugin id.".to_string());
        }
        Ok(description)
    })();
    let mut description = match candidate {
        Ok(description) => description,
        Err(error) => {
            let _ = fs::remove_dir_all(&staging);
            return Err(error);
        }
    };

    let destination = plugins_root.join(id);
    let destination_metadata = fs::symlink_metadata(&destination);
    let was_installed = match destination_metadata {
        Ok(metadata) => {
            if !metadata.is_dir() || metadata.file_type().is_symlink() {
                let _ = fs::remove_dir_all(&staging);
                return Err("Installed plugin target must be a real directory.".to_string());
            }
            true
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => false,
        Err(error) => {
            let _ = fs::remove_dir_all(&staging);
            return Err(format!("Unable to inspect installed plugin: {error}"));
        }
    };

    if was_installed {
        if let Err(error) = fs::rename(&destination, &previous) {
            let _ = fs::remove_dir_all(&staging);
            return Err(format!("Unable to protect existing plugin before replacement: {error}"));
        }
    }
    let promotion = before_promote().and_then(|_| {
        fs::rename(&staging, &destination)
            .map_err(|error| format!("Unable to promote staged plugin: {error}"))
    });
    if let Err(error) = promotion {
        let _ = fs::remove_dir_all(&staging);
        if was_installed {
            if let Err(restore_error) = fs::rename(&previous, &destination) {
                return Err(format!(
                    "{error}; previous plugin retained at {} but automatic restore failed: {restore_error}",
                    previous.display()
                ));
            }
        }
        return Err(error);
    }

    // The staged contents were validated before commit. The descriptor must
    // refer to the final installed path, not the private staging directory.
    description.folder_path = destination.to_string_lossy().to_string();
    if was_installed {
        // Cleanup failure leaves an offline recovery copy, not a broken install.
        // Do not report an installation failure once promotion has succeeded.
        let _ = fs::remove_dir_all(&previous);
    }
    Ok(description)
}

fn read_plugin_zip_entry(
    entry: zip::read::ZipFile<'_>,
    limit: u64,
    description: &str,
) -> AppResult<Vec<u8>> {
    let size_error = || format!("Plugin {description} exceeds the {limit}-byte limit.");
    if entry.size() > limit {
        return Err(size_error());
    }
    let mut bytes = Vec::new();
    entry.take(limit + 1).read_to_end(&mut bytes).map_err(|error| error.to_string())?;
    if bytes.len() as u64 > limit {
        return Err(size_error());
    }
    Ok(bytes)
}

fn install_external_plugin_from_path(
    plugins_root: &std::path::Path,
    picked_path: &std::path::Path,
) -> AppResult<ExternalPluginPackageDescriptor> {
    if picked_path.file_name().and_then(|name| name.to_str()) == Some("manifest.json") {
        let src_dir = picked_path.parent().ok_or("Invalid plugin folder")?;
        let description = read_external_manifest_in_folder(src_dir)?;
        return install_external_plugin_staged(
            plugins_root,
            &description.id,
            |staging| {
                fs::copy(src_dir.join("manifest.json"), staging.join("manifest.json"))
                    .map_err(|error| error.to_string())?;
                fs::copy(src_dir.join(&description.entry), staging.join(&description.entry))
                    .map_err(|error| error.to_string())?;
                Ok(())
            },
            || Ok(()),
        );
    }

    let file = fs::File::open(picked_path).map_err(|error| error.to_string())?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|error| format!("Invalid plugin archive: {error}"))?;
    let mut manifest_raw = None;
    for i in 0..archive.len() {
        let entry = archive.by_index(i).map_err(|error| error.to_string())?;
        if entry.name().rsplit('/').next() == Some("manifest.json") {
            manifest_raw = Some(read_plugin_zip_entry(entry, MAX_EXTERNAL_PLUGIN_MANIFEST_BYTES, "manifest")?);
            break;
        }
    }
    let raw = manifest_raw.ok_or("Plugin archive does not contain manifest.json.")?;
    let parsed: ExternalPluginManifestFile =
        serde_json::from_slice(&raw).map_err(|error| error.to_string())?;
    let id = validate_external_plugin_id(&parsed.id)?;
    let entry_name = validate_external_entry_file(&parsed.entry)?;
    install_external_plugin_staged(
        plugins_root,
        &id,
        |staging| {
            fs::write(staging.join("manifest.json"), &raw)
                .map_err(|error| error.to_string())?;
            let mut found_entry = false;
            for i in 0..archive.len() {
                let entry = archive.by_index(i).map_err(|error| error.to_string())?;
                if entry.name().rsplit('/').next() == Some(entry_name.as_str()) {
                    let buffer = read_plugin_zip_entry(entry, MAX_EXTERNAL_PLUGIN_JS_BYTES, "JS bundle")?;
                    fs::write(staging.join(&entry_name), &buffer)
                        .map_err(|error| error.to_string())?;
                    found_entry = true;
                    break;
                }
            }
            if !found_entry {
                return Err(format!("Plugin archive is missing entry file {entry_name}."));
            }
            Ok(())
        },
        || Ok(()),
    )
}

#[tauri::command]
pub fn install_external_plugin_package(
    app: tauri::AppHandle,
) -> AppResult<Option<ExternalPluginPackageDescriptor>> {
    let picked = rfd::FileDialog::new()
        .set_title("Install EOD Plugin Package (.eodplugin / .zip / manifest.json)")
        .add_filter("EOD Plugin Package", &["eodplugin", "zip", "json"])
        .pick_file();
    let Some(picked_path) = picked else {
        return Ok(None);
    };
    let plugins_root = get_external_plugins_root(&app)?;
    install_external_plugin_from_path(&plugins_root, &picked_path).map(Some)
}

#[cfg(test)]
mod external_plugin_install_safety_tests {
    use super::*;
    use std::io::Write;

    const ID: &str = "external.test-replacement";

    fn manifest(version: &str) -> String {
        format!(
            "{{\"id\":\"{ID}\",\"name\":\"Test\",\"version\":\"{version}\",\"entry\":\"main.js\"}}"
        )
    }

    fn write_plugin(folder: &std::path::Path, version: &str, code: &str) {
        fs::create_dir_all(folder).unwrap();
        fs::write(folder.join("manifest.json"), manifest(version)).unwrap();
        fs::write(folder.join("main.js"), code).unwrap();
    }

    fn make_archive(path: &std::path::Path, version: &str, entry: Option<&str>) {
        let file = fs::File::create(path).unwrap();
        let mut archive = zip::ZipWriter::new(file);
        let options = zip::write::FileOptions::default();
        archive.start_file("manifest.json", options).unwrap();
        archive.write_all(manifest(version).as_bytes()).unwrap();
        if let Some(code) = entry {
            archive.start_file("main.js", options).unwrap();
            archive.write_all(code.as_bytes()).unwrap();
        }
        archive.finish().unwrap();
    }

    #[test]
    fn rejects_oversized_plugin_archive_entries() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("plugins");
        let path = temp.path().join("oversized.zip");
        let mut archive = zip::ZipWriter::new(fs::File::create(&path).unwrap());
        archive.start_file("manifest.json", zip::write::FileOptions::default()).unwrap();
        archive.write_all(&vec![b' '; MAX_EXTERNAL_PLUGIN_MANIFEST_BYTES as usize + 1]).unwrap();
        archive.finish().unwrap();
        let result = install_external_plugin_from_path(&root, &path);
        assert!(matches!(result, Err(error) if error.contains("manifest exceeds")));

        let code = " ".repeat(MAX_EXTERNAL_PLUGIN_JS_BYTES as usize + 1);
        make_archive(&path, "1.0.0", Some(&code));
        let result = install_external_plugin_from_path(&root, &path);
        assert!(matches!(result, Err(error) if error.contains("JS bundle exceeds")));
        assert!(!root.join(ID).exists());
    }

    #[test]
    fn replaces_existing_plugin_from_valid_zip_and_reports_final_folder() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("plugins");
        let old = root.join(ID);
        write_plugin(&old, "1.0.0", "export default 'old';");
        let archive = temp.path().join("replacement.eodplugin");
        make_archive(&archive, "2.0.0", Some("export default 'new';"));
        let installed = install_external_plugin_from_path(&root, &archive).unwrap();
        assert_eq!(installed.version, "2.0.0");
        assert_eq!(installed.folder_path, old.to_string_lossy());
        assert_eq!(fs::read_to_string(old.join("main.js")).unwrap(), "export default 'new';");
    }

    #[test]
    fn missing_zip_entry_preserves_previously_installed_bytes() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("plugins");
        let old = root.join(ID);
        write_plugin(&old, "1.0.0", "old-executable");
        let before = fs::read(old.join("manifest.json")).unwrap();
        let archive = temp.path().join("missing.eodplugin");
        make_archive(&archive, "2.0.0", None);
        assert!(install_external_plugin_from_path(&root, &archive).is_err());
        assert_eq!(fs::read(old.join("manifest.json")).unwrap(), before);
        assert_eq!(fs::read_to_string(old.join("main.js")).unwrap(), "old-executable");
    }

    #[test]
    fn invalid_folder_copy_preserves_previous_version() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("plugins");
        let old = root.join(ID);
        write_plugin(&old, "1.0.0", "old-executable");
        let from = temp.path().join("incoming");
        fs::create_dir_all(&from).unwrap();
        fs::write(from.join("manifest.json"), manifest("2.0.0")).unwrap();
        assert!(install_external_plugin_from_path(&root, &from.join("manifest.json")).is_err());
        assert_eq!(fs::read_to_string(old.join("main.js")).unwrap(), "old-executable");
    }

    #[test]
    fn staged_write_failure_cannot_touch_existing_plugin() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("plugins");
        write_plugin(&root.join(ID), "1.0.0", "old-executable");
        let failed = install_external_plugin_staged(
            &root,
            ID,
            |staging| {
                fs::write(staging.join("manifest.json"), manifest("2.0.0")).unwrap();
                Err("synthetic stage failure".to_string())
            },
            || Ok(()),
        );
        assert!(failed.is_err());
        assert_eq!(fs::read_to_string(root.join(ID).join("main.js")).unwrap(), "old-executable");
    }

    #[test]
    fn promotion_failure_restores_previous_plugin() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("plugins");
        write_plugin(&root.join(ID), "1.0.0", "old-executable");
        let failed = install_external_plugin_staged(
            &root,
            ID,
            |staging| {
                write_plugin(staging, "2.0.0", "new-executable");
                Ok(())
            },
            || Err("synthetic promote failure".to_string()),
        );
        assert!(failed.is_err());
        assert_eq!(fs::read_to_string(root.join(ID).join("main.js")).unwrap(), "old-executable");
        assert_eq!(read_external_manifest_in_folder(&root.join(ID)).unwrap().version, "1.0.0");
    }

    #[test]
    fn interrupted_replacement_recovers_previous_version_before_new_install() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("plugins");
        let transactions = external_plugin_transactions_root(&root).unwrap();
        let id = ID;
        let backup = transactions.join(format!("{id}.123.456.0.previous"));
        write_plugin(&backup, "1.0.0", "old-executable");
        let invalid = temp.path().join("missing.eodplugin");
        make_archive(&invalid, "2.0.0", None);
        assert!(install_external_plugin_from_path(&root, &invalid).is_err());
        assert_eq!(fs::read_to_string(root.join(id).join("main.js")).unwrap(), "old-executable");
        assert!(!backup.exists());
    }

    #[test]
    fn discovery_recovers_interrupted_previous_and_preserves_orphan_staging() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("plugins");
        let tx = external_plugin_transactions_root(&root).unwrap();
        let backup = tx.join(format!("{ID}.123.456.1.previous"));
        let orphan = tx.join(format!("{ID}.123.456.1.staging"));
        write_plugin(&backup, "1.0.0", "old-executable");
        write_plugin(&orphan, "2.0.0", "uncommitted-executable");
        recover_external_plugins_on_discovery(&root).unwrap();
        assert_eq!(fs::read_to_string(root.join(ID).join("main.js")).unwrap(), "old-executable");
        assert!(orphan.exists());
        assert!(!backup.exists());
    }

    #[test]
    fn recovery_does_not_override_existing_destination_or_delete_previous_copy() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("plugins");
        let tx = external_plugin_transactions_root(&root).unwrap();
        let backup = tx.join(format!("{ID}.123.456.0.previous"));
        write_plugin(&backup, "1.0.0", "old-executable");
        write_plugin(&root.join(ID), "2.0.0", "new-executable");
        recover_external_plugins_on_discovery(&root).unwrap();
        assert_eq!(fs::read_to_string(root.join(ID).join("main.js")).unwrap(), "new-executable");
        assert_eq!(fs::read_to_string(backup.join("main.js")).unwrap(), "old-executable");
    }

    #[test]
    fn two_previous_versions_are_fail_closed_when_destination_absent() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("plugins");
        let tx = external_plugin_transactions_root(&root).unwrap();
        let a = tx.join(format!("{ID}.123.456.0.previous"));
        let b = tx.join(format!("{ID}.123.456.1.previous"));
        write_plugin(&a, "1.0.0", "first");
        write_plugin(&b, "1.1.0", "second");
        assert!(recover_external_plugins_on_discovery(&root).is_err());
        assert!(a.exists() && b.exists());
        assert!(!root.join(ID).exists());
    }

    #[test]
    fn same_id_install_is_serialized_while_lock_owner_is_active() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("plugins");
        write_plugin(&root.join(ID), "1.0.0", "old-executable");
        let duplicate_attempt = install_external_plugin_staged(
            &root, ID,
            |staging| { write_plugin(staging, "2.0.0", "new-executable"); Ok(()) },
            || {
                let conflicting = install_external_plugin_staged(
                    &root, ID,
                    |_staging| panic!("concurrent attempt must fail before staging"),
                    || Ok(()),
                );
                assert!(conflicting.is_err());
                Ok(())
            },
        );
        assert!(duplicate_attempt.is_ok());
        assert_eq!(fs::read_to_string(root.join(ID).join("main.js")).unwrap(), "new-executable");
    }

    #[test]
    fn distinct_ids_have_independent_install_locks() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("plugins");
        let first = lock_external_plugin_id(&root, ID).unwrap();
        let second = lock_external_plugin_id(&root, "external.other").unwrap();
        drop(second);
        drop(first);
        assert!(lock_external_plugin_id(&root, ID).is_ok());
    }

    #[test]
    fn malformed_recovery_directory_blocks_install_without_source_loss() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("plugins");
        let tx = external_plugin_transactions_root(&root).unwrap();
        fs::create_dir_all(tx.join(format!("{ID}.123.456.0.previous"))).unwrap();
        let source = temp.path().join("incoming");
        write_plugin(&source, "2.0.0", "candidate");
        assert!(install_external_plugin_from_path(&root, &source.join("manifest.json")).is_err());
        assert!(!root.join(ID).exists());
        assert!(tx.join(format!("{ID}.123.456.0.previous")).exists());
    }

    #[test]
    fn first_install_does_not_require_existing_directory() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("plugins");
        let source = temp.path().join("incoming");
        write_plugin(&source, "1.0.0", "new-executable");
        let installed = install_external_plugin_from_path(&root, &source.join("manifest.json")).unwrap();
        assert_eq!(installed.version, "1.0.0");
        assert_eq!(fs::read_to_string(root.join(ID).join("main.js")).unwrap(), "new-executable");
    }
}

#[tauri::command]
pub fn uninstall_external_plugin(
    app: tauri::AppHandle,
    input: ExternalPluginIdInput,
) -> AppResult<crate::database::OperationResult> {
    let id = validate_external_plugin_id(&input.plugin_id)?;
    let root = get_external_plugins_root(&app)?;
    let _id_lock = lock_external_plugin_id(&root, &id)?;
    let _ = recover_external_plugin_locked(&root, &id)?;
    let dst_dir = root.join(&id);
    if dst_dir.exists() {
        fs::remove_dir_all(&dst_dir).map_err(|e| e.to_string())?;
    }
    Ok(crate::database::OperationResult { success: true })
}
