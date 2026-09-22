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
