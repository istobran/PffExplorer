mod config;
mod pff;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            config::load_app_config,
            config::save_app_config,
            pff::commands::load_pff_file,
            pff::commands::load_pff_project,
            pff::commands::load_pff_paths,
            pff::commands::scan_pff_project,
            pff::commands::preview_entry,
            pff::commands::export_entry
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
