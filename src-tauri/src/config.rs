use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

const CONFIG_FILE_NAME: &str = "config.json";

#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub opened_pff_paths: Vec<String>,
    pub locale: Option<String>,
}

#[tauri::command]
pub fn load_app_config(app: AppHandle) -> Result<AppConfig, String> {
    let path = config_path(&app)?;
    if !path.exists() {
        return Ok(AppConfig::default());
    }

    let content = fs::read_to_string(&path).map_err(config_error)?;
    serde_json::from_str(&content).map_err(config_error)
}

#[tauri::command]
pub fn save_app_config(app: AppHandle, config: AppConfig) -> Result<(), String> {
    let path = config_path(&app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(config_error)?;
    }

    let content = serde_json::to_string_pretty(&config).map_err(config_error)?;
    fs::write(path, content).map_err(config_error)
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_config_dir()
        .map_err(config_error)?
        .join(CONFIG_FILE_NAME))
}

fn config_error(error: impl std::error::Error) -> String {
    error.to_string()
}
