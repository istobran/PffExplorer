use std::fs;
use std::path::{Path, PathBuf};

use tauri::Manager;
use walkdir::WalkDir;

use super::archive::{ExtractedData, PffArchive};
use super::audio_cache::AudioPreviewCache;
use super::error::PffError;
use super::models::{
    ArchiveSummary, ExportMode, ExportRequest, ExportResult, PreviewResponse, ResourceEntry,
    ResourceKind, WorkspaceSnapshot, WorkspaceStats,
};
use super::preview::preview_from_bytes;

#[tauri::command]
pub fn load_pff_file(path: String) -> Result<WorkspaceSnapshot, String> {
    let archive = PffArchive::open(path).map_err(command_error)?;
    Ok(snapshot_from_archives(vec![archive], Vec::new()))
}

#[tauri::command]
pub fn load_pff_project(path: String) -> Result<WorkspaceSnapshot, String> {
    let paths = collect_project_pffs(Path::new(&path));
    Ok(open_pff_paths(paths))
}

#[tauri::command]
pub fn load_pff_paths(paths: Vec<String>) -> Result<WorkspaceSnapshot, String> {
    let paths = paths.into_iter().map(PathBuf::from).collect::<Vec<_>>();
    Ok(open_pff_paths(paths))
}

#[tauri::command]
pub fn scan_pff_project(path: String) -> Result<Vec<String>, String> {
    Ok(collect_project_pffs(Path::new(&path))
        .into_iter()
        .map(|path| path.to_string_lossy().into_owned())
        .collect())
}

#[tauri::command]
pub async fn preview_entry(
    app: tauri::AppHandle,
    archive_path: String,
    entry_index: u32,
) -> Result<PreviewResponse, String> {
    let preview_cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|error| format!("preview cache path failed: {error}"))?
        .join("previews");
    let audio_cache = app.state::<AudioPreviewCache>().inner().clone();

    tauri::async_runtime::spawn_blocking(move || {
        let archive = PffArchive::open(archive_path).map_err(command_error)?;
        let entry = archive
            .entry_by_index(entry_index)
            .ok_or_else(|| command_error(PffError::EntryNotFound(entry_index)))?;
        let ExtractedData { data, transforms } =
            archive.extract_decoded(entry).map_err(command_error)?;

        Ok(preview_from_bytes(
            &archive.path,
            entry,
            data,
            transforms,
            Some(&preview_cache_dir),
            Some(&audio_cache),
        ))
    })
    .await
    .map_err(|error| format!("preview worker failed: {error}"))?
}

#[tauri::command]
pub fn export_entry(request: ExportRequest) -> Result<ExportResult, String> {
    let archive = PffArchive::open(&request.archive_path).map_err(command_error)?;
    let entry = archive
        .entry_by_index(request.entry_index)
        .ok_or_else(|| command_error(PffError::EntryNotFound(request.entry_index)))?;

    let ExtractedData { data, transforms } = match request.mode {
        ExportMode::Raw => archive.extract_raw(entry).map(|data| ExtractedData {
            data,
            transforms: Vec::new(),
        }),
        ExportMode::Decoded => archive.extract_decoded(entry),
    }
    .map_err(command_error)?;

    if let Some(parent) = Path::new(&request.output_path).parent() {
        fs::create_dir_all(parent).map_err(|err| command_error(PffError::Io(err)))?;
    }
    fs::write(&request.output_path, &data).map_err(|err| command_error(PffError::Io(err)))?;

    Ok(ExportResult {
        output_path: request.output_path,
        byte_len: data.len(),
        transforms,
    })
}

fn command_error(err: PffError) -> String {
    err.to_string()
}

fn collect_project_pffs(root: &Path) -> Vec<PathBuf> {
    let mut paths = Vec::new();

    if let Ok(entries) = fs::read_dir(root) {
        let mut root_pffs: Vec<PathBuf> = entries
            .flatten()
            .map(|entry| entry.path())
            .filter(|path| is_pff_file(path) && path.is_file())
            .collect();
        root_pffs.sort();
        paths.extend(root_pffs);
    }

    let expansion = root.join("expansion");
    if expansion.is_dir() {
        let mut expansion_pffs: Vec<PathBuf> = WalkDir::new(expansion)
            .into_iter()
            .filter_map(Result::ok)
            .map(|entry| entry.into_path())
            .filter(|path| is_pff_file(path) && path.is_file())
            .collect();
        expansion_pffs.sort();
        paths.extend(expansion_pffs);
    }

    paths
}

fn open_pff_paths(paths: Vec<PathBuf>) -> WorkspaceSnapshot {
    let mut archives = Vec::new();
    let mut warnings = Vec::new();

    for pff_path in dedupe_paths(paths) {
        match PffArchive::open(&pff_path) {
            Ok(archive) => archives.push(archive),
            Err(err) => warnings.push(format!("{}: {err}", pff_path.display())),
        }
    }

    snapshot_from_archives(archives, warnings)
}

fn dedupe_paths(paths: Vec<PathBuf>) -> Vec<PathBuf> {
    let mut unique = Vec::with_capacity(paths.len());

    for path in paths {
        if !unique.iter().any(|item| item == &path) {
            unique.push(path);
        }
    }

    unique
}

fn is_pff_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| ext.eq_ignore_ascii_case("pff"))
}

pub(crate) fn snapshot_from_archives(
    archives: Vec<PffArchive>,
    warnings: Vec<String>,
) -> WorkspaceSnapshot {
    let mut summaries = Vec::with_capacity(archives.len());
    let mut entries = Vec::new();
    let mut total_size = 0_u64;
    let mut deleted_count = 0_usize;

    for archive in &archives {
        let archive_name = archive.display_name();
        let visible_entries: Vec<_> = archive
            .entries
            .iter()
            .filter(|entry| !entry.is_deleted())
            .collect();
        let archive_deleted = archive
            .entries
            .iter()
            .filter(|entry| entry.is_deleted())
            .count();
        let archive_total_size = visible_entries
            .iter()
            .map(|entry| entry.size as u64)
            .sum::<u64>();

        deleted_count += archive_deleted;
        total_size += archive_total_size;

        summaries.push(ArchiveSummary {
            path: archive.path.to_string_lossy().into_owned(),
            name: archive_name.clone(),
            version: archive.header.version(),
            file_count: visible_entries.len(),
            deleted_count: archive_deleted,
            total_size: archive_total_size,
            archive_size: archive.archive_size,
        });

        for entry in visible_entries {
            entries.push(ResourceEntry {
                archive_path: archive.path.to_string_lossy().into_owned(),
                archive_name: archive_name.clone(),
                table_index: entry.table_index,
                name: entry.name.clone(),
                kind: ResourceKind::from_name(&entry.name),
                size: entry.size,
                offset: entry.offset,
                timestamp: entry.timestamp,
                checksum: entry.checksum,
                flags: entry.flags,
            });
        }
    }

    let entry_count = entries.len();
    WorkspaceSnapshot {
        archives: summaries,
        entries,
        stats: WorkspaceStats {
            archive_count: archives.len(),
            entry_count,
            total_size,
            deleted_count,
        },
        warnings,
    }
}
