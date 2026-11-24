use rusqlite::{params, Connection, OptionalExtension};
use tauri::AppHandle;

use super::{
    now_iso, with_active_connection, AppResult, LayoutNameInput, OperationResult, SaveLayoutInput,
    SavedLayoutRecord, SavedLayoutSummary, SettingKeyInput, SettingValueInput, LAYOUTS_SETTING_KEY,
};

#[tauri::command]
pub fn get_saved_layouts(app: AppHandle) -> AppResult<Vec<SavedLayoutSummary>> {
    with_active_connection(&app, |connection| {
        Ok(read_saved_layouts(connection)?
            .into_iter()
            .map(|layout| SavedLayoutSummary {
                name: layout.name,
                timestamp: layout.timestamp,
            })
            .collect())
    })
    .map(|value| value.unwrap_or_default())
}

#[tauri::command]
pub fn save_layout(app: AppHandle, input: SaveLayoutInput) -> AppResult<OperationResult> {
    with_active_connection(&app, |connection| {
        let trimmed_name = input.name.trim();
        if trimmed_name.is_empty() {
            return Err("Layout name is required.".to_string());
        }

        let mut layouts = read_saved_layouts(connection)?;
        let next_layout = SavedLayoutRecord {
            name: trimmed_name.to_string(),
            timestamp: now_iso(),
            data: input.layout_data.clone(),
        };

        if let Some(index) = layouts
            .iter()
            .position(|layout| layout.name == trimmed_name)
        {
            layouts[index] = next_layout;
        } else {
            layouts.push(next_layout);
        }

        write_saved_layouts(connection, &layouts)?;
        Ok(OperationResult { success: true })
    })?
    .ok_or_else(|| "Open a database before saving layouts.".to_string())
}

#[tauri::command]
pub fn load_layout(app: AppHandle, input: LayoutNameInput) -> AppResult<Option<String>> {
    with_active_connection(&app, |connection| {
        Ok(read_saved_layouts(connection)?
            .into_iter()
            .find(|layout| layout.name == input.name)
            .map(|layout| layout.data))
    })
    .map(|value| value.unwrap_or(None))
}

#[tauri::command]
pub fn delete_layout(app: AppHandle, input: LayoutNameInput) -> AppResult<OperationResult> {
    with_active_connection(&app, |connection| {
        let layouts = read_saved_layouts(connection)?
            .into_iter()
            .filter(|layout| layout.name != input.name)
            .collect::<Vec<_>>();
        write_saved_layouts(connection, &layouts)?;
        Ok(OperationResult { success: true })
    })?
    .ok_or_else(|| "Open a database before deleting layouts.".to_string())
}

#[tauri::command]
pub fn get_setting(app: AppHandle, input: SettingKeyInput) -> AppResult<Option<String>> {
    with_active_connection(&app, |connection| {
        read_setting_value(connection, &input.key)
    })
    .map(|value| value.unwrap_or(None))
}

fn validate_setting_write_key(key: &str) -> AppResult<()> {
    if key == super::official_source_urls::OFFICIAL_SOURCE_URLS_SETTING_KEY {
        return Err("OFFICIAL_SOURCE_URLS_REQUIRES_REVIEWED_SAVE".to_string());
    }
    Ok(())
}

#[tauri::command]
pub fn set_setting(app: AppHandle, input: SettingValueInput) -> AppResult<OperationResult> {
    validate_setting_write_key(&input.key)?;
    if input.key == super::storage_mode::PRICE_STORAGE_MODE_KEY {
        let folder = super::resolve_active_database_folder(&app)?
            .ok_or_else(|| "Open a database before changing settings.".to_string())?;
        let _canonical = super::database_use::CanonicalAccess::lock_writer_for_database(&folder)?;
        let connection = super::connection_registry::open_connection_for_folder(&folder, false)?;
        write_setting_value(&connection, &input.key, &input.value)?;
        return Ok(OperationResult { success: true });
    }
    with_active_connection(&app, |connection| {
        write_setting_value(connection, &input.key, &input.value)?;
        Ok(OperationResult { success: true })
    })?
    .ok_or_else(|| "Open a database before changing settings.".to_string())
}

pub(crate) fn read_setting_value(connection: &Connection, key: &str) -> AppResult<Option<String>> {
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

pub(super) fn write_setting_value(
    connection: &Connection,
    key: &str,
    value: &str,
) -> AppResult<()> {
    connection
        .execute(
            "
              INSERT INTO settings (key, value, updated_at)
              VALUES (?, ?, datetime('now'))
              ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = excluded.updated_at
            ",
            params![key, value],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn read_saved_layouts(connection: &Connection) -> AppResult<Vec<SavedLayoutRecord>> {
    let raw = read_setting_value(connection, LAYOUTS_SETTING_KEY)?;
    Ok(raw
        .and_then(|value| serde_json::from_str::<Vec<SavedLayoutRecord>>(&value).ok())
        .unwrap_or_default())
}

fn write_saved_layouts(connection: &Connection, layouts: &[SavedLayoutRecord]) -> AppResult<()> {
    let serialized = serde_json::to_string(layouts).map_err(|error| error.to_string())?;
    write_setting_value(connection, LAYOUTS_SETTING_KEY, &serialized)
}


#[cfg(test)]
mod er4b_settings_tests {
    use super::*;

    #[test]
    fn er4b_generic_official_source_setting_write_is_rejected_before_write() {
        assert_eq!(
            validate_setting_write_key(super::super::official_source_urls::OFFICIAL_SOURCE_URLS_SETTING_KEY)
                .unwrap_err(),
            "OFFICIAL_SOURCE_URLS_REQUIRES_REVIEWED_SAVE"
        );
        assert!(validate_setting_write_key("unrelated.setting").is_ok());
    }
}
