#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod app_profile;
mod bhavcopy;
mod bhavcopy_recovery;
mod database;
mod imports;
mod manual_import_recovery;
mod plugin_data;
mod runtime;

use app_profile::*;
use bhavcopy::*;
use database::*;
use imports::*;
use plugin_data::*;
use reqwest::blocking::Client;
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, REFERER, USER_AGENT};
use runtime::*;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{
    menu::{CheckMenuItemBuilder, MenuBuilder, SubmenuBuilder},
    AppHandle, Emitter, Manager, Runtime, WindowEvent,
};

const MENU_IMPORT_CSV: &str = "import_csv";
const MENU_OPEN_BHAVCOPY_WINDOW: &str = "open_bhavcopy_window";
const MENU_NEW_CHART: &str = "new_chart";
const MENU_OPEN_LAYOUTS: &str = "open_layouts";
const MENU_CREATE_DATABASE: &str = "create_database";
const MENU_OPEN_DATABASE: &str = "open_database";
const MENU_OPEN_RECENT_DATABASES: &str = "open_recent_databases";
const MENU_CLOSE_DATABASE: &str = "close_database";
const MENU_DELETE_DATABASE: &str = "delete_database";
const MENU_SAVE_ACTIVE_DATABASE: &str = "save_active_database";
const MENU_OPEN_QUOTE_EDITOR: &str = "open_quote_editor";
const MENU_OPEN_MERGE_SYMBOLS: &str = "open_merge_symbols";
const MENU_OPEN_CORPORATE_ACTION: &str = "open_corporate_action";
const MENU_OPEN_BINARY_PARITY_AUDIT: &str = "open_binary_parity_audit";
const MENU_OPEN_SCANNER: &str = "open_scanner";
const MENU_OPEN_ALERT_MANAGER: &str = "open_alert_manager";
const MENU_OPEN_WATCHLIST_MANAGER: &str = "open_watchlist_manager";
const MENU_OPEN_OFFICIAL_WATCHLIST_IMPORT: &str = "open_official_watchlist_import";
const MENU_OPEN_SETTINGS: &str = "open_settings";
const MENU_OPEN_SETTINGS_GENERAL: &str = "open_settings_general";
const MENU_OPEN_SETTINGS_PROFILE: &str = "open_settings_profile";
const MENU_OPEN_SETTINGS_DATABASE_DEFAULTS: &str = "open_settings_database_defaults";
const MENU_OPEN_SETTINGS_CHART_COLORS: &str = "open_settings_chart_colors";
const MENU_OPEN_SETTINGS_PLUGINS: &str = "open_settings_plugins";
const MENU_SET_TIMEFRAME_D: &str = "set_timeframe_d";
const MENU_SET_TIMEFRAME_W: &str = "set_timeframe_w";
const MENU_SET_TIMEFRAME_M: &str = "set_timeframe_m";
const MENU_SET_TIMEFRAME_Q: &str = "set_timeframe_q";
const MENU_SET_TIMEFRAME_Y: &str = "set_timeframe_y";
const MENU_SET_CHART_TYPE_CANDLES: &str = "set_chart_type_candles";
const MENU_SET_CHART_TYPE_LINE: &str = "set_chart_type_line";
const MENU_SET_CHART_TYPE_AREA: &str = "set_chart_type_area";
const MENU_SET_CHART_TYPE_BAR: &str = "set_chart_type_bar";
const MENU_SET_CHART_TYPE_BASELINE: &str = "set_chart_type_baseline";
const MENU_SET_CHART_TYPE_HLC_AREA: &str = "set_chart_type_hlc_area";
const MENU_SET_CHART_TYPE_HEIKIN_ASHI: &str = "set_chart_type_heikin_ashi";
const MENU_SET_CHART_TYPE_RENKO: &str = "set_chart_type_renko";
const MENU_SET_RAW_MODE: &str = "set_raw_mode";
const MENU_SET_ADJUSTED_MODE: &str = "set_adjusted_mode";
const MENU_TOGGLE_DIVIDEND_ADJUSTMENTS: &str = "toggle_dividend_adjustments";
const MENU_TOGGLE_RIGHTS_ADJUSTMENTS: &str = "toggle_rights_adjustments";
const MENU_TOGGLE_EVENT_SPLIT: &str = "toggle_event_split";
const MENU_TOGGLE_EVENT_BONUS: &str = "toggle_event_bonus";
const MENU_TOGGLE_EVENT_DIVIDEND: &str = "toggle_event_dividend";
const MENU_TOGGLE_EVENT_RIGHTS: &str = "toggle_event_rights";
const MENU_TOGGLE_EVENT_SYMBOL_CHANGE: &str = "toggle_event_symbol_change";
const MENU_TOGGLE_EVENT_NAME_CHANGE: &str = "toggle_event_name_change";
const MENU_OPEN_COMPARE: &str = "open_compare";
const MENU_DRAWING_CURSOR: &str = "drawing_cursor";
const MENU_DRAWING_HLINE: &str = "drawing_hline";
const MENU_DRAWING_VLINE: &str = "drawing_vline";
const MENU_DRAWING_TRENDLINE: &str = "drawing_trendline";
const MENU_DRAWING_RAY: &str = "drawing_ray";
const MENU_DRAWING_ARROW: &str = "drawing_arrow";
const MENU_DRAWING_RECT: &str = "drawing_rect";
const MENU_DRAWING_TEXT: &str = "drawing_text";
const MENU_DRAWING_CHANNEL: &str = "drawing_channel";
const MENU_DRAWING_FIB: &str = "drawing_fib";
const MENU_DRAWING_GANN: &str = "drawing_gann";
const MENU_TOGGLE_MAGNET: &str = "toggle_magnet";
const MENU_DRAWING_PROPERTIES: &str = "drawing_properties";
const MENU_TOGGLE_DRAWING_LOCK: &str = "toggle_drawing_lock";
const MENU_DELETE_SELECTED_DRAWING: &str = "delete_selected_drawing";
const MENU_UNDO_DRAWING: &str = "undo_drawing";
const MENU_CLEAR_DRAWINGS: &str = "clear_drawings";
const MENU_ADD_INDICATOR_SMA: &str = "add_indicator_sma";
const MENU_ADD_INDICATOR_EMA: &str = "add_indicator_ema";
const MENU_ADD_INDICATOR_WMA: &str = "add_indicator_wma";
const MENU_ADD_INDICATOR_WEMA: &str = "add_indicator_wema";
const MENU_ADD_INDICATOR_BOLL: &str = "add_indicator_boll";
const MENU_ADD_INDICATOR_PSAR: &str = "add_indicator_psar";
const MENU_ADD_INDICATOR_RSI: &str = "add_indicator_rsi";
const MENU_ADD_INDICATOR_MACD: &str = "add_indicator_macd";
const MENU_ADD_INDICATOR_STOCH: &str = "add_indicator_stoch";
const MENU_ADD_INDICATOR_ROC: &str = "add_indicator_roc";
const MENU_ADD_INDICATOR_CCI: &str = "add_indicator_cci";
const MENU_ADD_INDICATOR_WILLR: &str = "add_indicator_willr";
const MENU_ADD_INDICATOR_ATR: &str = "add_indicator_atr";
const MENU_ADD_INDICATOR_ADX: &str = "add_indicator_adx";
const MENU_ADD_INDICATOR_MFI: &str = "add_indicator_mfi";
const MENU_ADD_INDICATOR_OBV: &str = "add_indicator_obv";
const MENU_OPEN_CUSTOM_FORMULA: &str = "open_custom_formula";
const MENU_CLEAR_INDICATORS: &str = "clear_indicators";
const MENU_TOGGLE_SIDEBAR: &str = "toggle_sidebar";
const MENU_TOGGLE_OHLCV: &str = "toggle_ohlcv";
const MENU_TOGGLE_STATUS_BAR: &str = "toggle_status_bar";
const MENU_SET_LAYOUT_SINGLE: &str = "set_layout_single";
const MENU_SET_LAYOUT_TILE: &str = "set_layout_tile";
const MENU_SET_LAYOUT_TILE_H: &str = "set_layout_tile_h";
const MENU_SET_LAYOUT_TILE_V: &str = "set_layout_tile_v";
const MENU_SET_LAYOUT_TILE_GRID: &str = "set_layout_tile_grid";
const MENU_OPEN_FAQ: &str = "open_faq";
const MENU_OPEN_KEYBOARD_SHORTCUTS: &str = "open_keyboard_shortcuts";
const MENU_ABOUT: &str = "about";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeAppInfo {
    name: String,
    version: String,
    build_number: String,
    built_at: String,
    runtime: &'static str,
    data_mode: &'static str,
    build_profile: &'static str,
    data_dir: String,
    state_dir: String,
    profile_dir: String,
    default_profile_dir: String,
    log_file: String,
    executable_dir: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct MenuCommandEnvelope {
    command: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    payload: Option<Value>,
}

#[derive(Clone, Serialize)]
struct OperationResult {
    success: bool,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MenuStateSyncInput {
    timeframe: String,
    chart_type: String,
    adjusted_mode: bool,
    include_dividend_adjustments: bool,
    include_rights_adjustments: bool,
    layout_mode: String,
    sidebar_visible: bool,
    ohlcv_bar_visible: bool,
    status_bar_visible: bool,
    magnet_enabled: bool,
    show_split_events: bool,
    show_bonus_events: bool,
    show_dividend_events: bool,
    show_rights_events: bool,
    show_symbol_change_events: bool,
    show_name_change_events: bool,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OfficialWatchlistSourceFetchInput {
    url: String,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BuildMetadata {
    version: String,
    build_number: String,
    built_at: String,
}

fn read_build_metadata() -> Option<BuildMetadata> {
    serde_json::from_str(include_str!("../gen/build-info.json")).ok()
}

#[tauri::command]
fn get_price_storage_mode(app: AppHandle) -> String {
    with_active_connection(&app, |connection| {
        Ok(database::get_price_storage_mode(connection)
            .as_str()
            .to_string())
    })
    .ok()
    .flatten()
    .unwrap_or_else(|| "hybrid".to_string())
}

#[tauri::command]
fn get_app_info(app: AppHandle) -> RuntimeAppInfo {
    let build_metadata = read_build_metadata();
    let diagnostics = resolve_runtime_context(&app)
        .map(|context| context.diagnostics())
        .unwrap_or(RuntimeDiagnostics {
            data_mode: "system",
            build_profile: if cfg!(debug_assertions) {
                "debug"
            } else {
                "release"
            },
            data_dir: String::new(),
            state_dir: String::new(),
            log_dir: String::new(),
            log_file: String::new(),
            executable_dir: String::new(),
        });

    RuntimeAppInfo {
        name: app.package_info().name.clone(),
        version: build_metadata
            .as_ref()
            .map(|metadata| metadata.version.clone())
            .unwrap_or_else(|| app.package_info().version.to_string()),
        build_number: build_metadata
            .as_ref()
            .map(|metadata| metadata.build_number.clone())
            .unwrap_or_else(|| "unknown".to_string()),
        built_at: build_metadata
            .as_ref()
            .map(|metadata| metadata.built_at.clone())
            .unwrap_or_else(|| "unknown".to_string()),
        runtime: "tauri",
        data_mode: diagnostics.data_mode,
        build_profile: diagnostics.build_profile,
        data_dir: diagnostics.data_dir,
        state_dir: diagnostics.state_dir,
        profile_dir: get_app_profile_directory_string(&app).unwrap_or_default(),
        default_profile_dir: get_default_app_profile_directory_string(&app).unwrap_or_default(),
        log_file: diagnostics.log_file,
        executable_dir: diagnostics.executable_dir,
    }
}

fn validate_safe_external_url(raw_url: &str) -> Result<reqwest::Url, String> {
    let parsed = reqwest::Url::parse(raw_url.trim())
        .map_err(|error| format!("Invalid external URL: {error}"))?;
    if !matches!(parsed.scheme(), "https" | "http") {
        return Err(format!(
            "Refusing to open non-HTTP/HTTPS external URL scheme: {}",
            parsed.scheme()
        ));
    }
    if parsed.host_str().map(str::trim).filter(|h| !h.is_empty()).is_none() {
        return Err("External URL must include a valid host.".to_string());
    }
    Ok(parsed)
}

#[tauri::command]
fn open_external(url: String) -> Result<OperationResult, String> {
    let validated = validate_safe_external_url(&url)?;
    open::that(validated.as_str()).map_err(|error| error.to_string())?;
    Ok(OperationResult { success: true })
}

#[cfg(test)]
mod external_url_security_tests {
    use super::validate_safe_external_url;

    #[test]
    fn allows_valid_https_and_http_urls() {
        assert!(validate_safe_external_url("https://www.nseindia.com/market-data").is_ok());
        assert!(validate_safe_external_url("http://localhost:5173").is_ok());
    }

    #[test]
    fn rejects_non_http_schemes_and_local_paths() {
        assert!(validate_safe_external_url("file:///C:/Windows/System32/cmd.exe").is_err());
        assert!(validate_safe_external_url("javascript:alert(1)").is_err());
        assert!(validate_safe_external_url("C:\\Windows\\System32\\calc.exe").is_err());
    }
}

fn set_check_menu_item_state<R: Runtime>(
    app: &AppHandle<R>,
    menu_item_id: &str,
    checked: bool,
) -> Result<(), String> {
    let menu = app
        .menu()
        .ok_or_else(|| "Application menu is not initialized.".to_string())?;
    let menu_item = find_menu_item_by_id(
        menu.items().map_err(|error| error.to_string())?,
        menu_item_id,
    )
    .ok_or_else(|| format!("Menu item not found: {menu_item_id}"))?;
    let check_item = menu_item
        .as_check_menuitem()
        .ok_or_else(|| format!("Menu item is not checkable: {menu_item_id}"))?;

    check_item
        .set_checked(checked)
        .map_err(|error| error.to_string())
}

fn find_menu_item_by_id<R: Runtime>(
    items: Vec<tauri::menu::MenuItemKind<R>>,
    menu_item_id: &str,
) -> Option<tauri::menu::MenuItemKind<R>> {
    for item in items {
        if item.id().as_ref() == menu_item_id {
            return Some(item);
        }

        if let Some(submenu) = item.as_submenu() {
            if let Ok(children) = submenu.items() {
                if let Some(found) = find_menu_item_by_id(children, menu_item_id) {
                    return Some(found);
                }
            }
        }
    }

    None
}

fn sync_check_menu_items<R: Runtime>(
    app: &AppHandle<R>,
    items: &[(&str, bool)],
) -> Result<(), String> {
    for (menu_item_id, checked) in items {
        set_check_menu_item_state(app, menu_item_id, *checked)?;
    }

    Ok(())
}

#[tauri::command]
fn sync_menu_state(app: AppHandle, state: MenuStateSyncInput) -> Result<OperationResult, String> {
    sync_check_menu_items(
        &app,
        &[
            (MENU_SET_TIMEFRAME_D, state.timeframe == "D"),
            (MENU_SET_TIMEFRAME_W, state.timeframe == "W"),
            (MENU_SET_TIMEFRAME_M, state.timeframe == "M"),
            (MENU_SET_TIMEFRAME_Q, state.timeframe == "Q"),
            (MENU_SET_TIMEFRAME_Y, state.timeframe == "Y"),
            (MENU_SET_CHART_TYPE_CANDLES, state.chart_type == "candles"),
            (MENU_SET_CHART_TYPE_LINE, state.chart_type == "line"),
            (MENU_SET_CHART_TYPE_AREA, state.chart_type == "area"),
            (MENU_SET_CHART_TYPE_BAR, state.chart_type == "bar"),
            (MENU_SET_CHART_TYPE_BASELINE, state.chart_type == "baseline"),
            (MENU_SET_CHART_TYPE_HLC_AREA, state.chart_type == "hlcArea"),
            (
                MENU_SET_CHART_TYPE_HEIKIN_ASHI,
                state.chart_type == "heikinAshi",
            ),
            (MENU_SET_CHART_TYPE_RENKO, state.chart_type == "renko"),
            (MENU_SET_RAW_MODE, !state.adjusted_mode),
            (MENU_SET_ADJUSTED_MODE, state.adjusted_mode),
            (
                MENU_TOGGLE_DIVIDEND_ADJUSTMENTS,
                state.include_dividend_adjustments,
            ),
            (
                MENU_TOGGLE_RIGHTS_ADJUSTMENTS,
                state.include_rights_adjustments,
            ),
            (MENU_TOGGLE_EVENT_SPLIT, state.show_split_events),
            (MENU_TOGGLE_EVENT_BONUS, state.show_bonus_events),
            (MENU_TOGGLE_EVENT_DIVIDEND, state.show_dividend_events),
            (MENU_TOGGLE_EVENT_RIGHTS, state.show_rights_events),
            (
                MENU_TOGGLE_EVENT_SYMBOL_CHANGE,
                state.show_symbol_change_events,
            ),
            (MENU_TOGGLE_EVENT_NAME_CHANGE, state.show_name_change_events),
            (MENU_TOGGLE_MAGNET, state.magnet_enabled),
            (MENU_SET_LAYOUT_SINGLE, state.layout_mode == "single"),
            (MENU_SET_LAYOUT_TILE, state.layout_mode == "tile"),
            (MENU_SET_LAYOUT_TILE_H, state.layout_mode == "tile-h"),
            (MENU_SET_LAYOUT_TILE_V, state.layout_mode == "tile-v"),
            (MENU_SET_LAYOUT_TILE_GRID, state.layout_mode == "tile-grid"),
            (MENU_TOGGLE_SIDEBAR, state.sidebar_visible),
            (MENU_TOGGLE_OHLCV, state.ohlcv_bar_visible),
            (MENU_TOGGLE_STATUS_BAR, state.status_bar_visible),
        ],
    )?;

    Ok(OperationResult { success: true })
}

#[tauri::command]
fn fetch_official_watchlist_source(
    input: OfficialWatchlistSourceFetchInput,
) -> Result<String, String> {
    let parsed_url = reqwest::Url::parse(input.url.trim()).map_err(|error| error.to_string())?;
    if parsed_url.scheme() != "https" {
        return Err(format!(
            "Official watchlist source must use HTTPS: {}",
            input.url
        ));
    }
    let hostname = parsed_url
        .host_str()
        .map(str::to_lowercase)
        .ok_or_else(|| format!("Unsupported official watchlist source host: {}", input.url))?;

    let referer = match hostname.as_str() {
        "www.niftyindices.com" | "niftyindices.com" => "https://www.niftyindices.com/",
        "www.bseindia.com" | "bseindia.com" => "https://www.bseindia.com/",
        "www.bseindices.com" | "bseindices.com" => "https://www.bseindices.com/",
        _ => {
            return Err(format!(
                "Unsupported official watchlist source host: {}",
                input.url
            ))
        }
    };

    let mut headers = HeaderMap::new();
    headers.insert(
        USER_AGENT,
        HeaderValue::from_static(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
        ),
    );
    headers.insert(
        ACCEPT,
        HeaderValue::from_static("text/csv,text/html,application/octet-stream,*/*"),
    );
    headers.insert(REFERER, HeaderValue::from_static(referer));

    let client = Client::builder()
        .default_headers(headers)
        .cookie_store(true)
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|error| error.to_string())?;

    let response = client
        .get(parsed_url)
        .send()
        .map_err(|error| error.to_string())?;

    if !response.status().is_success() {
        return Err(format!(
            "Official watchlist source fetch failed: HTTP {}",
            response.status().as_u16()
        ));
    }

    let body = response.text().map_err(|error| error.to_string())?;
    let trimmed_lower = body.trim_start().to_ascii_lowercase();
    if trimmed_lower.starts_with("<!doctype html") || trimmed_lower.starts_with("<html") {
        return Err("Official watchlist source returned an HTML challenge/error page instead of CSV.".to_string());
    }
    Ok(body)
}

fn build_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<tauri::menu::Menu<R>> {
    let file_menu = SubmenuBuilder::new(app, "File")
        .text(MENU_IMPORT_CSV, "Import CSV / TXT")
        .text(MENU_OPEN_BHAVCOPY_WINDOW, "Download Bhavcopy")
        .separator()
        .close_window()
        .build()?;
    let data_tools_menu = SubmenuBuilder::new(app, "Data Tools")
        .text(MENU_OPEN_QUOTE_EDITOR, "Quote Editor")
        .text(MENU_OPEN_MERGE_SYMBOLS, "Merge Symbols")
        .text(MENU_OPEN_CORPORATE_ACTION, "Corporate Actions / Identity")
        .separator()
        .text(MENU_OPEN_BINARY_PARITY_AUDIT, "Binary EOD Parity Audit")
        .build()?;
    let database_menu = SubmenuBuilder::new(app, "Database")
        .text(MENU_CREATE_DATABASE, "New Database")
        .text(MENU_OPEN_DATABASE, "Open Database")
        .text(MENU_OPEN_RECENT_DATABASES, "Recent Databases")
        .text(MENU_SAVE_ACTIVE_DATABASE, "Save Active Database")
        .text(MENU_CLOSE_DATABASE, "Close Database")
        .separator()
        .text(MENU_DELETE_DATABASE, "Delete Database")
        .separator()
        .item(&data_tools_menu)
        .build()?;
    let watchlist_menu = SubmenuBuilder::new(app, "Watchlist")
        .text(MENU_OPEN_WATCHLIST_MANAGER, "Manage Watchlists")
        .text(
            MENU_OPEN_OFFICIAL_WATCHLIST_IMPORT,
            "Import Watchlist Groups",
        )
        .build()?;

    let timeframe_daily_item = CheckMenuItemBuilder::with_id(MENU_SET_TIMEFRAME_D, "Daily")
        .checked(true)
        .build(app)?;
    let timeframe_weekly_item = CheckMenuItemBuilder::with_id(MENU_SET_TIMEFRAME_W, "Weekly")
        .checked(false)
        .build(app)?;
    let timeframe_monthly_item = CheckMenuItemBuilder::with_id(MENU_SET_TIMEFRAME_M, "Monthly")
        .checked(false)
        .build(app)?;
    let timeframe_quarterly_item = CheckMenuItemBuilder::with_id(MENU_SET_TIMEFRAME_Q, "Quarterly")
        .checked(false)
        .build(app)?;
    let timeframe_yearly_item = CheckMenuItemBuilder::with_id(MENU_SET_TIMEFRAME_Y, "Yearly")
        .checked(false)
        .build(app)?;

    let timeframe_menu = SubmenuBuilder::new(app, "Timeframe")
        .item(&timeframe_daily_item)
        .item(&timeframe_weekly_item)
        .item(&timeframe_monthly_item)
        .item(&timeframe_quarterly_item)
        .item(&timeframe_yearly_item)
        .build()?;

    let raw_mode_item = CheckMenuItemBuilder::with_id(MENU_SET_RAW_MODE, "Raw")
        .checked(true)
        .build(app)?;
    let adjusted_mode_item = CheckMenuItemBuilder::with_id(MENU_SET_ADJUSTED_MODE, "Adjusted")
        .checked(false)
        .build(app)?;

    let price_mode_menu = SubmenuBuilder::new(app, "Price Mode")
        .item(&raw_mode_item)
        .item(&adjusted_mode_item)
        .build()?;

    let chart_type_candles_item =
        CheckMenuItemBuilder::with_id(MENU_SET_CHART_TYPE_CANDLES, "Candles")
            .checked(true)
            .build(app)?;
    let chart_type_line_item = CheckMenuItemBuilder::with_id(MENU_SET_CHART_TYPE_LINE, "Line")
        .checked(false)
        .build(app)?;
    let chart_type_area_item = CheckMenuItemBuilder::with_id(MENU_SET_CHART_TYPE_AREA, "Area")
        .checked(false)
        .build(app)?;
    let chart_type_bar_item = CheckMenuItemBuilder::with_id(MENU_SET_CHART_TYPE_BAR, "Bar (OHLC)")
        .checked(false)
        .build(app)?;
    let chart_type_baseline_item =
        CheckMenuItemBuilder::with_id(MENU_SET_CHART_TYPE_BASELINE, "Baseline")
            .checked(false)
            .build(app)?;
    let chart_type_hlc_area_item =
        CheckMenuItemBuilder::with_id(MENU_SET_CHART_TYPE_HLC_AREA, "HLC Area")
            .checked(false)
            .build(app)?;
    let chart_type_heikin_ashi_item =
        CheckMenuItemBuilder::with_id(MENU_SET_CHART_TYPE_HEIKIN_ASHI, "Heikin Ashi")
            .checked(false)
            .build(app)?;
    let chart_type_renko_item = CheckMenuItemBuilder::with_id(MENU_SET_CHART_TYPE_RENKO, "Renko")
        .checked(false)
        .build(app)?;

    let chart_type_menu = SubmenuBuilder::new(app, "Chart Type")
        .item(&chart_type_candles_item)
        .item(&chart_type_line_item)
        .item(&chart_type_area_item)
        .item(&chart_type_bar_item)
        .item(&chart_type_baseline_item)
        .item(&chart_type_hlc_area_item)
        .item(&chart_type_heikin_ashi_item)
        .item(&chart_type_renko_item)
        .build()?;

    let dividend_adjustment_item =
        CheckMenuItemBuilder::with_id(MENU_TOGGLE_DIVIDEND_ADJUSTMENTS, "Dividend Adjustments")
            .checked(false)
            .build(app)?;
    let rights_adjustment_item =
        CheckMenuItemBuilder::with_id(MENU_TOGGLE_RIGHTS_ADJUSTMENTS, "Rights Adjustments")
            .checked(false)
            .build(app)?;

    let adjustments_menu = SubmenuBuilder::new(app, "Adjustments")
        .item(&dividend_adjustment_item)
        .item(&rights_adjustment_item)
        .build()?;

    let split_event_item = CheckMenuItemBuilder::with_id(MENU_TOGGLE_EVENT_SPLIT, "Splits")
        .checked(true)
        .build(app)?;
    let bonus_event_item = CheckMenuItemBuilder::with_id(MENU_TOGGLE_EVENT_BONUS, "Bonus")
        .checked(true)
        .build(app)?;
    let dividend_event_item = CheckMenuItemBuilder::with_id(MENU_TOGGLE_EVENT_DIVIDEND, "Dividend")
        .checked(true)
        .build(app)?;
    let rights_event_item = CheckMenuItemBuilder::with_id(MENU_TOGGLE_EVENT_RIGHTS, "Rights Issue")
        .checked(true)
        .build(app)?;
    let symbol_change_event_item =
        CheckMenuItemBuilder::with_id(MENU_TOGGLE_EVENT_SYMBOL_CHANGE, "Symbol Changes")
            .checked(true)
            .build(app)?;
    let name_change_event_item =
        CheckMenuItemBuilder::with_id(MENU_TOGGLE_EVENT_NAME_CHANGE, "Name Changes")
            .checked(true)
            .build(app)?;

    let event_menu = SubmenuBuilder::new(app, "Events")
        .item(&split_event_item)
        .item(&bonus_event_item)
        .item(&dividend_event_item)
        .item(&rights_event_item)
        .separator()
        .item(&symbol_change_event_item)
        .item(&name_change_event_item)
        .build()?;

    let magnet_item = CheckMenuItemBuilder::with_id(MENU_TOGGLE_MAGNET, "Magnet")
        .checked(false)
        .build(app)?;

    let draw_menu = SubmenuBuilder::new(app, "Draw")
        .text(MENU_DRAWING_CURSOR, "Cursor")
        .text(MENU_DRAWING_HLINE, "Horizontal Line")
        .text(MENU_DRAWING_VLINE, "Vertical Line")
        .text(MENU_DRAWING_TRENDLINE, "Trendline")
        .text(MENU_DRAWING_RAY, "Ray")
        .text(MENU_DRAWING_ARROW, "Arrow")
        .text(MENU_DRAWING_RECT, "Rectangle")
        .text(MENU_DRAWING_TEXT, "Text")
        .text(MENU_DRAWING_CHANNEL, "Parallel Channel")
        .text(MENU_DRAWING_FIB, "Fibonacci Retracement")
        .text(MENU_DRAWING_GANN, "Gann Fan")
        .separator()
        .item(&magnet_item)
        .separator()
        .text(MENU_DRAWING_PROPERTIES, "Properties")
        .text(MENU_TOGGLE_DRAWING_LOCK, "Lock / Unlock Drawing")
        .text(MENU_DELETE_SELECTED_DRAWING, "Delete Selected Drawing")
        .text(MENU_UNDO_DRAWING, "Undo Last Drawing")
        .text(MENU_CLEAR_DRAWINGS, "Clear Drawings")
        .build()?;

    let indicators_menu = SubmenuBuilder::new(app, "Indicators")
        .text(MENU_ADD_INDICATOR_SMA, "Simple Moving Average")
        .text(MENU_ADD_INDICATOR_EMA, "Exponential Moving Average")
        .text(MENU_ADD_INDICATOR_WMA, "Weighted Moving Average")
        .text(MENU_ADD_INDICATOR_WEMA, "Wilder Moving Average")
        .separator()
        .text(MENU_ADD_INDICATOR_BOLL, "Bollinger Bands")
        .text(MENU_ADD_INDICATOR_PSAR, "Parabolic SAR")
        .separator()
        .text(MENU_ADD_INDICATOR_RSI, "RSI")
        .text(MENU_ADD_INDICATOR_MACD, "MACD")
        .text(MENU_ADD_INDICATOR_STOCH, "Stochastic")
        .text(MENU_ADD_INDICATOR_ROC, "ROC")
        .text(MENU_ADD_INDICATOR_CCI, "CCI")
        .text(MENU_ADD_INDICATOR_WILLR, "Williams %R")
        .text(MENU_ADD_INDICATOR_ATR, "ATR")
        .text(MENU_ADD_INDICATOR_ADX, "ADX")
        .text(MENU_ADD_INDICATOR_MFI, "MFI")
        .text(MENU_ADD_INDICATOR_OBV, "OBV")
        .separator()
        .text(MENU_OPEN_CUSTOM_FORMULA, "Custom Formula...")
        .build()?;

    let chart_menu = SubmenuBuilder::new(app, "Chart")
        .text(MENU_NEW_CHART, "New Chart")
        .text(MENU_OPEN_LAYOUTS, "Chart Layouts")
        .separator()
        .item(&timeframe_menu)
        .item(&chart_type_menu)
        .item(&price_mode_menu)
        .item(&adjustments_menu)
        .item(&event_menu)
        .text(MENU_OPEN_COMPARE, "Compare...")
        .text(MENU_OPEN_SCANNER, "Scanner")
        .text(MENU_OPEN_ALERT_MANAGER, "Alert Manager")
        .separator()
        .item(&indicators_menu)
        .text(MENU_CLEAR_INDICATORS, "Clear Indicators")
        .build()?;

    let layout_single_item = CheckMenuItemBuilder::with_id(MENU_SET_LAYOUT_SINGLE, "Single")
        .checked(true)
        .build(app)?;
    let layout_tile_item = CheckMenuItemBuilder::with_id(MENU_SET_LAYOUT_TILE, "Tile")
        .checked(false)
        .build(app)?;
    let layout_tile_horizontal_item =
        CheckMenuItemBuilder::with_id(MENU_SET_LAYOUT_TILE_H, "Tile Horizontal")
            .checked(false)
            .build(app)?;
    let layout_tile_vertical_item =
        CheckMenuItemBuilder::with_id(MENU_SET_LAYOUT_TILE_V, "Tile Vertical")
            .checked(false)
            .build(app)?;
    let layout_tile_grid_item =
        CheckMenuItemBuilder::with_id(MENU_SET_LAYOUT_TILE_GRID, "Tile Grid")
            .checked(false)
            .build(app)?;

    let layout_mode_menu = SubmenuBuilder::new(app, "Layout Mode")
        .item(&layout_single_item)
        .item(&layout_tile_item)
        .item(&layout_tile_horizontal_item)
        .item(&layout_tile_vertical_item)
        .item(&layout_tile_grid_item)
        .build()?;

    let sidebar_item = CheckMenuItemBuilder::with_id(MENU_TOGGLE_SIDEBAR, "Sidebar")
        .checked(true)
        .build(app)?;
    let ohlcv_bar_item = CheckMenuItemBuilder::with_id(MENU_TOGGLE_OHLCV, "OHLCV Bar")
        .checked(true)
        .build(app)?;
    let status_bar_item = CheckMenuItemBuilder::with_id(MENU_TOGGLE_STATUS_BAR, "Status Bar")
        .checked(true)
        .build(app)?;

    let view_menu = SubmenuBuilder::new(app, "View")
        .item(&sidebar_item)
        .item(&ohlcv_bar_item)
        .item(&status_bar_item)
        .separator()
        .item(&layout_mode_menu)
        .separator()
        .fullscreen()
        .build()?;

    let settings_menu = SubmenuBuilder::new(app, "Settings")
        .text(MENU_OPEN_SETTINGS, "Application Settings...")
        .separator()
        .text(MENU_OPEN_SETTINGS_GENERAL, "General Preferences...")
        .text(MENU_OPEN_SETTINGS_PROFILE, "Application Profile Folder...")
        .text(
            MENU_OPEN_SETTINGS_DATABASE_DEFAULTS,
            "Active Database Defaults...",
        )
        .text(MENU_OPEN_SETTINGS_CHART_COLORS, "Chart Colors...")
        .text(MENU_OPEN_SETTINGS_PLUGINS, "Plugins...")
        .build()?;
    let help_menu = SubmenuBuilder::new(app, "Help")
        .text(MENU_OPEN_FAQ, "FAQ")
        .text(MENU_OPEN_KEYBOARD_SHORTCUTS, "Keyboard Shortcuts")
        .separator()
        .text(MENU_ABOUT, "About EOD Chart")
        .build()?;

    MenuBuilder::new(app)
        .item(&file_menu)
        .item(&database_menu)
        .item(&watchlist_menu)
        .item(&chart_menu)
        .item(&draw_menu)
        .item(&view_menu)
        .item(&settings_menu)
        .item(&help_menu)
        .build()
}

fn emit_menu_command<R: Runtime>(
    app: &AppHandle<R>,
    command: &'static str,
    payload: Option<Value>,
) {
    let _ = app.emit("menu:command", MenuCommandEnvelope { command, payload });
}

fn indicator_payload(name: &'static str) -> Option<Value> {
    Some(Value::String(name.to_string()))
}

fn timeframe_payload(value: &'static str) -> Option<Value> {
    Some(Value::String(value.to_string()))
}

fn chart_type_payload(value: &'static str) -> Option<Value> {
    Some(Value::String(value.to_string()))
}

fn layout_mode_payload(value: &'static str) -> Option<Value> {
    Some(Value::String(value.to_string()))
}

fn drawing_tool_payload(tool: &'static str) -> Option<Value> {
    Some(Value::String(tool.to_string()))
}

fn chart_event_payload(event_type: &'static str) -> Option<Value> {
    Some(Value::String(event_type.to_string()))
}

fn settings_section_payload(section: &'static str) -> Option<Value> {
    Some(Value::String(section.to_string()))
}

fn main() {
    match try_run_five_pair_consolidation_apply_maintenance(std::env::args()) {
        Ok(Some(exit_code)) => std::process::exit(exit_code),
        Ok(None) => {}
        Err(error) => {
            eprintln!("V1.14X five-pair live Apply maintenance failed: {error}");
            std::process::exit(1);
        }
    }

    match try_run_five_pair_consolidation_maintenance(std::env::args()) {
        Ok(Some(exit_code)) => std::process::exit(exit_code),
        Ok(None) => {}
        Err(error) => {
            eprintln!("V1.14W five-pair consolidation maintenance failed: {error}");
            std::process::exit(1);
        }
    }

    match try_run_event_identity_resolution_maintenance(std::env::args()) {
        Ok(Some(exit_code)) => std::process::exit(exit_code),
        Ok(None) => {}
        Err(error) => {
            eprintln!("V1.14E event identity resolution maintenance failed: {error}");
            std::process::exit(1);
        }
    }

    match try_run_controlled_identity_repair_maintenance(std::env::args()) {
        Ok(Some(exit_code)) => std::process::exit(exit_code),
        Ok(None) => {}
        Err(error) => {
            eprintln!("V1.13B-1 controlled identity repair maintenance failed: {error}");
            std::process::exit(1);
        }
    }

    match try_run_historical_isin_bootstrap_maintenance(std::env::args()) {
        Ok(Some(exit_code)) => std::process::exit(exit_code),
        Ok(None) => {}
        Err(error) => {
            eprintln!("V1.9.2 historical ISIN bootstrap maintenance failed: {error}");
            std::process::exit(1);
        }
    }

    let result = tauri::Builder::default()
        .manage(ActiveDatabaseConnectionState::new())
        .setup(|app| {
            let runtime_context = resolve_runtime_context(&app.handle())?;
            ensure_registry_initialized(&app.handle())?;
            let menu = build_menu(&app.handle())?;
            app.set_menu(menu)?;
            log_runtime_event(
                &app.handle(),
                "INFO",
                "startup",
                Some(&format!(
                    "mode={} profile={} dataDir={} logFile={}",
                    runtime_context.data_mode,
                    runtime_context.build_profile,
                    runtime_context.data_dir.display(),
                    runtime_context.log_file.display(),
                )),
            );
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }

            if let WindowEvent::CloseRequested { .. } = event {
                log_runtime_event(
                    &window.app_handle(),
                    "INFO",
                    "shutdown",
                    Some("main window close requested; exiting app process"),
                );
                window.app_handle().exit(0);
            }
        })
        .on_menu_event(|app, event| match event.id().as_ref() {
            MENU_IMPORT_CSV => emit_menu_command(app, "menu:importCsv", None),
            MENU_OPEN_BHAVCOPY_WINDOW => emit_menu_command(app, "menu:openBhavcopyWindow", None),
            MENU_CREATE_DATABASE => emit_menu_command(app, "menu:createDatabaseInteractive", None),
            MENU_OPEN_DATABASE => emit_menu_command(app, "menu:openDatabaseInteractive", None),
            MENU_OPEN_RECENT_DATABASES => emit_menu_command(app, "menu:openRecentDatabases", None),
            MENU_CLOSE_DATABASE => emit_menu_command(app, "menu:closeDatabase", None),
            MENU_DELETE_DATABASE => emit_menu_command(app, "menu:openDeleteDatabase", None),
            MENU_SAVE_ACTIVE_DATABASE => emit_menu_command(app, "menu:saveDatabase", None),
            MENU_OPEN_QUOTE_EDITOR => emit_menu_command(app, "menu:openQuoteEditor", None),
            MENU_OPEN_MERGE_SYMBOLS => emit_menu_command(app, "menu:openMergeSymbols", None),
            MENU_OPEN_CORPORATE_ACTION => emit_menu_command(app, "menu:openCorporateAction", None),
            MENU_OPEN_BINARY_PARITY_AUDIT => {
                emit_menu_command(app, "menu:openBinaryParityAudit", None)
            }
            MENU_OPEN_WATCHLIST_MANAGER => {
                emit_menu_command(app, "menu:openWatchlistManager", None)
            }
            MENU_OPEN_OFFICIAL_WATCHLIST_IMPORT => {
                emit_menu_command(app, "menu:openOfficialWatchlistImport", None)
            }
            MENU_OPEN_SETTINGS => emit_menu_command(app, "menu:openSettings", None),
            MENU_OPEN_SETTINGS_GENERAL => emit_menu_command(
                app,
                "menu:openSettings",
                settings_section_payload("general"),
            ),
            MENU_OPEN_SETTINGS_PROFILE => emit_menu_command(
                app,
                "menu:openSettings",
                settings_section_payload("profile"),
            ),
            MENU_OPEN_SETTINGS_DATABASE_DEFAULTS => emit_menu_command(
                app,
                "menu:openSettings",
                settings_section_payload("database-defaults"),
            ),
            MENU_OPEN_SETTINGS_CHART_COLORS => emit_menu_command(
                app,
                "menu:openSettings",
                settings_section_payload("chart-colors"),
            ),
            MENU_OPEN_SETTINGS_PLUGINS => emit_menu_command(
                app,
                "menu:openSettings",
                settings_section_payload("plugins"),
            ),
            MENU_NEW_CHART => emit_menu_command(app, "menu:newChart", None),
            MENU_OPEN_LAYOUTS => emit_menu_command(app, "menu:openLayoutManager", None),
            MENU_SET_TIMEFRAME_D => {
                emit_menu_command(app, "menu:setTimeframe", timeframe_payload("D"))
            }
            MENU_SET_TIMEFRAME_W => {
                emit_menu_command(app, "menu:setTimeframe", timeframe_payload("W"))
            }
            MENU_SET_TIMEFRAME_M => {
                emit_menu_command(app, "menu:setTimeframe", timeframe_payload("M"))
            }
            MENU_SET_TIMEFRAME_Q => {
                emit_menu_command(app, "menu:setTimeframe", timeframe_payload("Q"))
            }
            MENU_SET_TIMEFRAME_Y => {
                emit_menu_command(app, "menu:setTimeframe", timeframe_payload("Y"))
            }
            MENU_SET_CHART_TYPE_CANDLES => {
                emit_menu_command(app, "menu:setChartType", chart_type_payload("candles"))
            }
            MENU_SET_CHART_TYPE_LINE => {
                emit_menu_command(app, "menu:setChartType", chart_type_payload("line"))
            }
            MENU_SET_CHART_TYPE_AREA => {
                emit_menu_command(app, "menu:setChartType", chart_type_payload("area"))
            }
            MENU_SET_CHART_TYPE_BAR => {
                emit_menu_command(app, "menu:setChartType", chart_type_payload("bar"))
            }
            MENU_SET_CHART_TYPE_BASELINE => {
                emit_menu_command(app, "menu:setChartType", chart_type_payload("baseline"))
            }
            MENU_SET_CHART_TYPE_HLC_AREA => {
                emit_menu_command(app, "menu:setChartType", chart_type_payload("hlcArea"))
            }
            MENU_SET_CHART_TYPE_HEIKIN_ASHI => {
                emit_menu_command(app, "menu:setChartType", chart_type_payload("heikinAshi"))
            }
            MENU_SET_CHART_TYPE_RENKO => {
                emit_menu_command(app, "menu:setChartType", chart_type_payload("renko"))
            }
            MENU_SET_RAW_MODE => emit_menu_command(
                app,
                "menu:setAdjustedMode",
                Some(Value::String("raw".to_string())),
            ),
            MENU_SET_ADJUSTED_MODE => emit_menu_command(
                app,
                "menu:setAdjustedMode",
                Some(Value::String("adjusted".to_string())),
            ),
            MENU_TOGGLE_DIVIDEND_ADJUSTMENTS => {
                emit_menu_command(app, "menu:toggleDividendAdjustments", None)
            }
            MENU_TOGGLE_RIGHTS_ADJUSTMENTS => {
                emit_menu_command(app, "menu:toggleRightsAdjustments", None)
            }
            MENU_TOGGLE_EVENT_SPLIT => emit_menu_command(
                app,
                "menu:toggleChartEventVisibility",
                chart_event_payload("SPLIT"),
            ),
            MENU_TOGGLE_EVENT_BONUS => emit_menu_command(
                app,
                "menu:toggleChartEventVisibility",
                chart_event_payload("BONUS"),
            ),
            MENU_TOGGLE_EVENT_DIVIDEND => emit_menu_command(
                app,
                "menu:toggleChartEventVisibility",
                chart_event_payload("DIVIDEND"),
            ),
            MENU_TOGGLE_EVENT_RIGHTS => emit_menu_command(
                app,
                "menu:toggleChartEventVisibility",
                chart_event_payload("RIGHTS"),
            ),
            MENU_TOGGLE_EVENT_SYMBOL_CHANGE => emit_menu_command(
                app,
                "menu:toggleChartEventVisibility",
                chart_event_payload("SYMBOL_CHANGE"),
            ),
            MENU_TOGGLE_EVENT_NAME_CHANGE => emit_menu_command(
                app,
                "menu:toggleChartEventVisibility",
                chart_event_payload("NAME_CHANGE"),
            ),
            MENU_OPEN_COMPARE => emit_menu_command(app, "menu:openCompareDialog", None),
            MENU_OPEN_SCANNER => emit_menu_command(app, "menu:openScannerWindow", None),
            MENU_OPEN_ALERT_MANAGER => emit_menu_command(app, "menu:openAlertManager", None),
            MENU_DRAWING_CURSOR => {
                emit_menu_command(app, "menu:setDrawingTool", drawing_tool_payload("cursor"))
            }
            MENU_DRAWING_HLINE => {
                emit_menu_command(app, "menu:setDrawingTool", drawing_tool_payload("hline"))
            }
            MENU_DRAWING_VLINE => {
                emit_menu_command(app, "menu:setDrawingTool", drawing_tool_payload("vline"))
            }
            MENU_DRAWING_TRENDLINE => emit_menu_command(
                app,
                "menu:setDrawingTool",
                drawing_tool_payload("trendline"),
            ),
            MENU_DRAWING_RAY => {
                emit_menu_command(app, "menu:setDrawingTool", drawing_tool_payload("ray"))
            }
            MENU_DRAWING_ARROW => {
                emit_menu_command(app, "menu:setDrawingTool", drawing_tool_payload("arrow"))
            }
            MENU_DRAWING_RECT => {
                emit_menu_command(app, "menu:setDrawingTool", drawing_tool_payload("rect"))
            }
            MENU_DRAWING_TEXT => {
                emit_menu_command(app, "menu:setDrawingTool", drawing_tool_payload("text"))
            }
            MENU_DRAWING_CHANNEL => {
                emit_menu_command(app, "menu:setDrawingTool", drawing_tool_payload("channel"))
            }
            MENU_DRAWING_FIB => {
                emit_menu_command(app, "menu:setDrawingTool", drawing_tool_payload("fib"))
            }
            MENU_DRAWING_GANN => {
                emit_menu_command(app, "menu:setDrawingTool", drawing_tool_payload("gann"))
            }
            MENU_TOGGLE_MAGNET => emit_menu_command(app, "menu:toggleMagnet", None),
            MENU_DRAWING_PROPERTIES => emit_menu_command(app, "menu:openDrawingProperties", None),
            MENU_TOGGLE_DRAWING_LOCK => emit_menu_command(app, "menu:toggleDrawingLock", None),
            MENU_DELETE_SELECTED_DRAWING => {
                emit_menu_command(app, "menu:deleteSelectedDrawing", None)
            }
            MENU_UNDO_DRAWING => emit_menu_command(app, "menu:undoDrawing", None),
            MENU_CLEAR_DRAWINGS => emit_menu_command(app, "menu:clearDrawings", None),
            MENU_ADD_INDICATOR_SMA => {
                emit_menu_command(app, "menu:addIndicator", indicator_payload("SMA"))
            }
            MENU_ADD_INDICATOR_EMA => {
                emit_menu_command(app, "menu:addIndicator", indicator_payload("EMA"))
            }
            MENU_ADD_INDICATOR_WMA => {
                emit_menu_command(app, "menu:addIndicator", indicator_payload("WMA"))
            }
            MENU_ADD_INDICATOR_WEMA => {
                emit_menu_command(app, "menu:addIndicator", indicator_payload("WEMA"))
            }
            MENU_ADD_INDICATOR_BOLL => {
                emit_menu_command(app, "menu:addIndicator", indicator_payload("BOLL"))
            }
            MENU_ADD_INDICATOR_PSAR => {
                emit_menu_command(app, "menu:addIndicator", indicator_payload("PSAR"))
            }
            MENU_ADD_INDICATOR_RSI => {
                emit_menu_command(app, "menu:addIndicator", indicator_payload("RSI"))
            }
            MENU_ADD_INDICATOR_MACD => {
                emit_menu_command(app, "menu:addIndicator", indicator_payload("MACD"))
            }
            MENU_ADD_INDICATOR_STOCH => {
                emit_menu_command(app, "menu:addIndicator", indicator_payload("STOCH"))
            }
            MENU_ADD_INDICATOR_ROC => {
                emit_menu_command(app, "menu:addIndicator", indicator_payload("ROC"))
            }
            MENU_ADD_INDICATOR_CCI => {
                emit_menu_command(app, "menu:addIndicator", indicator_payload("CCI"))
            }
            MENU_ADD_INDICATOR_WILLR => {
                emit_menu_command(app, "menu:addIndicator", indicator_payload("WILLR"))
            }
            MENU_ADD_INDICATOR_ATR => {
                emit_menu_command(app, "menu:addIndicator", indicator_payload("ATR"))
            }
            MENU_ADD_INDICATOR_ADX => {
                emit_menu_command(app, "menu:addIndicator", indicator_payload("ADX"))
            }
            MENU_ADD_INDICATOR_MFI => {
                emit_menu_command(app, "menu:addIndicator", indicator_payload("MFI"))
            }
            MENU_ADD_INDICATOR_OBV => {
                emit_menu_command(app, "menu:addIndicator", indicator_payload("OBV"))
            }
            MENU_OPEN_CUSTOM_FORMULA => {
                emit_menu_command(app, "menu:openCustomFormulaDialog", None)
            }
            MENU_CLEAR_INDICATORS => emit_menu_command(app, "menu:clearIndicators", None),
            MENU_TOGGLE_SIDEBAR => emit_menu_command(app, "menu:toggleSidebar", None),
            MENU_TOGGLE_OHLCV => emit_menu_command(app, "menu:toggleOhlcvBar", None),
            MENU_TOGGLE_STATUS_BAR => emit_menu_command(app, "menu:toggleStatusBar", None),
            MENU_SET_LAYOUT_SINGLE => {
                emit_menu_command(app, "menu:setLayoutMode", layout_mode_payload("single"))
            }
            MENU_SET_LAYOUT_TILE => {
                emit_menu_command(app, "menu:setLayoutMode", layout_mode_payload("tile"))
            }
            MENU_SET_LAYOUT_TILE_H => {
                emit_menu_command(app, "menu:setLayoutMode", layout_mode_payload("tile-h"))
            }
            MENU_SET_LAYOUT_TILE_V => {
                emit_menu_command(app, "menu:setLayoutMode", layout_mode_payload("tile-v"))
            }
            MENU_SET_LAYOUT_TILE_GRID => {
                emit_menu_command(app, "menu:setLayoutMode", layout_mode_payload("tile-grid"))
            }
            MENU_OPEN_FAQ => emit_menu_command(app, "menu:openFaq", None),
            MENU_OPEN_KEYBOARD_SHORTCUTS => {
                emit_menu_command(app, "menu:openKeyboardShortcuts", None)
            }
            MENU_ABOUT => emit_menu_command(app, "menu:about", None),
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            get_price_storage_mode,
            get_app_info,
            sync_menu_state,
            get_app_profile_settings,
            save_app_profile_settings,
            pick_app_profile_directory,
            pick_plugin_data_file,
            pick_plugin_output_directory,
            read_plugin_text_file,
            list_external_plugins,
            read_external_plugin_module,
            install_external_plugin_package,
            uninstall_external_plugin,
            open_external,
            get_binary_eod_status,
            validate_binary_parity,
            migrate_to_binary_eod,
            get_app_snapshot,
            get_db_stats,
            create_database_interactive,
            open_database_interactive,
            activate_database_path,
            close_database,
            remove_recent_database,
            delete_database,
            search_symbols,
            list_symbols,
            get_eod_data,
            get_eod_data_binary,
            get_daily_market_snapshot,
            cancel_daily_market_snapshot,
            export_dnn_research_dataset,
            list_quotes,
            list_quotes_by_date,
            upsert_quote,
            delete_quote,
            delete_quote_range,
            delete_quote_date,
            merge_symbols,
            apply_corporate_action,
            preview_nse_historical_identity_archive,
            apply_nse_historical_identity_archive,
            download_nse_delisted_workbook,
            download_nse_current_universe_master,
            preview_nse_current_universe_sync,
            apply_nse_current_universe_sync,
            list_nse_identity_apply_history,
            list_nse_historical_identity_apply_history,
            get_nse_historical_identity_apply_report,
            download_bse_current_universe_master,
            preview_bse_current_universe_sync,
            apply_bse_current_universe_sync,
            list_bse_identity_apply_history,
            refresh_bse_name_history,
            preview_bse_name_history,
            apply_bse_name_history,
            list_bse_name_history_runs,
            get_bse_name_history_report,
            assess_identity_official_source_health,
            get_official_source_configuration_authority,
            save_official_source_urls_reviewed,
            find_official_source_replacement_candidates,
            record_official_source_candidate_decision,
            promote_official_source_candidate_reviewed,
            create_official_source_rollback_review,
            apply_official_source_rollback_reviewed,
            retry_official_source_post_health,
            list_official_source_history,
            import_corporate_actions_csv,
            fetch_official_corporate_actions,
            cancel_official_corporate_action_fetch,
            backfill_historical_capital_actions_for_symbol,
            backfill_historical_capital_actions_batch,
            list_historical_capital_action_backfill_runs,
            list_historical_capital_action_alias_candidates,
            list_historical_capital_action_major_liquid_candidates,
            list_historical_capital_action_sparse_candidates,
            list_corporate_action_imports,
            get_corporate_action_imports_by_ids,
            refresh_corporate_action_import_classifications,
            list_corporate_action_event_identities,
            preview_corporate_action_repairs,
            preview_split_bonus_reconciliation,
            approve_corporate_action_import,
            approve_corporate_action_import_with_isin_mismatch,
            approve_corporate_action_import_with_price_validation_exception,
            approve_corporate_action_imports,
            auto_approve_corporate_action_imports,
            evaluate_simple_cash_dividend_prepared_scope,
            execute_simple_cash_dividend_write_stage,
            save_corporate_action_validation_report,
            list_corporate_action_activity_runs,
            list_corporate_action_validation_report_items,
            approve_recommended_corporate_action_isin_mismatches,
            recheck_corporate_action_imports,
            list_corporate_action_import_resolution_hints,
            list_corporate_action_import_resolution_suggestions,
            quick_resolve_corporate_action_import,
            resolve_corporate_action_import,
            run_corporate_action_scan,
            list_corporate_action_scan_results,
            get_watchlists,
            create_watchlist,
            rename_watchlist,
            delete_watchlist,
            add_to_watchlist,
            remove_from_watchlist,
            apply_official_watchlist_update,
            replace_source_linked_watchlist,
            fetch_official_watchlist_source,
            pick_csv_files,
            save_text_export,
            save_chart_image,
            preview_csv,
            import_csv,
            get_latest_manual_import_recovery,
            list_manual_import_recovery_history,
            undo_manual_import_recovery,
            download_bhavcopy,
            download_bhavcopy_batch,
            download_bse_price_history,
            cancel_bse_price_history_download,
            get_bhavcopy_settings,
            save_bhavcopy_settings,
            get_bhavcopy_default_templates,
            list_market_holidays,
            add_market_holiday,
            delete_market_holiday,
            list_official_exchange_holiday_snapshots,
            preview_official_exchange_holidays,
            apply_official_exchange_holidays,
            get_saved_layouts,
            save_layout,
            load_layout,
            delete_layout,
            get_setting,
            set_setting
        ])
        .run(tauri::generate_context!());

    if let Err(error) = result {
        let message = format_startup_error(&error.to_string());
        let _ = rfd::MessageDialog::new()
            .set_title("EOD Chart startup error")
            .set_description(&message)
            .set_level(rfd::MessageLevel::Error)
            .show();
        eprintln!("{message}");
        std::process::exit(1);
    }
}
