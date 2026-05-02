use std::collections::hash_map::DefaultHasher;
use std::fs::{self, File};
use std::hash::{Hash, Hasher};
use std::io::{self, Cursor, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

use flate2::read::{DeflateDecoder, ZlibDecoder};
use serde::{Deserialize, Serialize};
use tauri::Manager;
use thiserror::Error;
use walkdir::WalkDir;

const PFF3_MAGIC: [u8; 4] = *b"PFF3";
const PFF4_MAGIC: [u8; 4] = *b"PFF4";
const PFF_HEADER_SIZE: u64 = 20;
const PFF_FLAG_DELETED: u32 = 0x01;
const BFC1_HEADER_SIZE: usize = 8;
const MAX_DECODED_SIZE: usize = 128 * 1024 * 1024;
const MAX_PREVIEW_BYTES: usize = 512 * 1024;
const MAX_IMAGE_PIXELS: u64 = 16 * 1024 * 1024;
const SCR_KEY_DEFAULT: u32 = 0x2A5A8EAD;
const SCR_KEY_FX: u32 = 0xA55B1EED;

#[derive(Debug, Error)]
pub enum PffError {
    #[error("IO error: {0}")]
    Io(#[from] io::Error),
    #[error("invalid PFF magic: {0:?}")]
    InvalidMagic([u8; 4]),
    #[error("invalid PFF header size: {0}")]
    InvalidHeaderSize(u32),
    #[error("invalid PFF entry size: {0}")]
    InvalidEntrySize(u32),
    #[error("entry table is outside archive bounds")]
    EntryTableOutOfBounds,
    #[error("entry data is outside archive bounds: {name}")]
    EntryDataOutOfBounds { name: String },
    #[error("entry index not found: {0}")]
    EntryNotFound(u32),
    #[error("BFC1 data is too short")]
    Bfc1TooShort,
    #[error("BFC1 decoded size {0} exceeds safety limit")]
    Bfc1TooLarge(usize),
    #[error("BFC1 decompression failed: {0}")]
    Bfc1Decode(String),
    #[error("SCR data is too short")]
    ScrTooShort,
    #[error("SCR magic does not match")]
    ScrInvalidMagic,
    #[error("RTXT parse failed: {0}")]
    Rtxt(String),
    #[error("image preview failed for {name}: {message}")]
    ImageDecode { name: String, message: String },
    #[error("audio preview failed for {name}: {message}")]
    AudioDecode { name: String, message: String },
    #[error("image preview is too large for {name}: {width}x{height}")]
    ImageTooLarge {
        name: String,
        width: u32,
        height: u32,
    },
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSnapshot {
    pub archives: Vec<ArchiveSummary>,
    pub entries: Vec<ResourceEntry>,
    pub stats: WorkspaceStats,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceStats {
    pub archive_count: usize,
    pub entry_count: usize,
    pub total_size: u64,
    pub deleted_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveSummary {
    pub path: String,
    pub name: String,
    pub version: String,
    pub file_count: usize,
    pub deleted_count: usize,
    pub total_size: u64,
    pub archive_size: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceEntry {
    pub archive_path: String,
    pub archive_name: String,
    pub table_index: u32,
    pub name: String,
    pub kind: ResourceKind,
    pub size: u32,
    pub offset: u32,
    pub timestamp: u32,
    pub checksum: Option<u32>,
    pub flags: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum ResourceKind {
    Tex,
    Snd,
    Mdl,
    Shd,
    Cfg,
    Dat,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewResponse {
    pub status: PreviewStatus,
    pub text: Option<String>,
    pub image: Option<ImagePreview>,
    pub audio: Option<AudioPreview>,
    pub hex_head: String,
    pub byte_len: usize,
    pub transforms: Vec<String>,
    pub message: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum PreviewStatus {
    Text,
    Image,
    Audio,
    Binary,
    TooLarge,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImagePreview {
    pub data_url: Option<String>,
    pub file_path: Option<String>,
    pub width: u32,
    pub height: u32,
    pub format: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioPreview {
    pub data_url: Option<String>,
    pub file_path: Option<String>,
    pub format: String,
    pub mime_type: String,
    pub codec: String,
    pub sample_rate: Option<u32>,
    pub channels: Option<u16>,
    pub bits_per_sample: Option<u16>,
    pub duration_seconds: Option<f64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportRequest {
    pub archive_path: String,
    pub entry_index: u32,
    pub output_path: String,
    pub mode: ExportMode,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExportMode {
    Raw,
    Decoded,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    pub output_path: String,
    pub byte_len: usize,
    pub transforms: Vec<String>,
}

#[derive(Debug, Clone)]
struct PffHeader {
    signature: [u8; 4],
}

#[derive(Debug, Clone)]
struct PffEntry {
    table_index: u32,
    flags: u32,
    offset: u32,
    size: u32,
    timestamp: u32,
    name: String,
    checksum: Option<u32>,
}

impl PffEntry {
    fn is_deleted(&self) -> bool {
        self.flags & PFF_FLAG_DELETED != 0
    }
}

#[derive(Debug, Clone)]
struct PffArchive {
    path: PathBuf,
    header: PffHeader,
    entries: Vec<PffEntry>,
    archive_size: u64,
}

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

    tauri::async_runtime::spawn_blocking(move || {
        let archive = PffArchive::open(archive_path).map_err(command_error)?;
        let entry = archive
            .entry_by_index(entry_index)
            .ok_or_else(|| command_error(PffError::EntryNotFound(entry_index)))?;
        let ExtractedData { data, transforms } =
            archive.extract_decoded(entry).map_err(command_error)?;

        fs::create_dir_all(&preview_cache_dir)
            .map_err(PffError::from)
            .map_err(command_error)?;
        Ok(preview_from_bytes(
            &archive.path,
            entry,
            data,
            transforms,
            Some(&preview_cache_dir),
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

fn snapshot_from_archives(archives: Vec<PffArchive>, warnings: Vec<String>) -> WorkspaceSnapshot {
    let mut summaries = Vec::with_capacity(archives.len());
    let mut entries = Vec::new();
    let mut total_size = 0_u64;
    let mut deleted_count = 0_usize;

    for archive in &archives {
        let archive_name = archive.display_name();
        let visible_entries: Vec<&PffEntry> = archive
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

impl PffHeader {
    fn version(&self) -> String {
        String::from_utf8_lossy(&self.signature).into_owned()
    }
}

impl PffArchive {
    fn open(path: impl AsRef<Path>) -> Result<Self, PffError> {
        let path = path.as_ref().to_path_buf();
        let mut file = File::open(&path)?;
        let archive_size = file.metadata()?.len();

        let header_size = read_u32_le(&mut file)?;
        if header_size as u64 != PFF_HEADER_SIZE {
            return Err(PffError::InvalidHeaderSize(header_size));
        }

        let mut signature = [0_u8; 4];
        file.read_exact(&mut signature)?;
        if signature != PFF3_MAGIC && signature != PFF4_MAGIC {
            return Err(PffError::InvalidMagic(signature));
        }

        let num_files = read_u32_le(&mut file)?;
        let entry_size = read_u32_le(&mut file)?;
        let file_table_offset = read_u32_le(&mut file)?;

        if entry_size != 32 && entry_size != 36 {
            return Err(PffError::InvalidEntrySize(entry_size));
        }

        let table_start = file_table_offset as u64;
        let table_size = num_files as u64 * entry_size as u64;
        let table_end = table_start.saturating_add(table_size);
        if table_start > archive_size || table_end > archive_size {
            return Err(PffError::EntryTableOutOfBounds);
        }

        file.seek(SeekFrom::Start(table_start))?;
        let mut entries = Vec::with_capacity(num_files as usize);

        for table_index in 0..num_files {
            let flags = read_u32_le(&mut file)?;
            let offset = read_u32_le(&mut file)?;
            let size = read_u32_le(&mut file)?;
            let timestamp = read_u32_le(&mut file)?;

            let mut filename = [0_u8; 16];
            file.read_exact(&mut filename)?;
            let checksum = if entry_size == 36 {
                Some(read_u32_le(&mut file)?)
            } else {
                None
            };

            let name = fixed_string(&filename);
            let data_end = offset as u64 + size as u64;
            if flags & PFF_FLAG_DELETED == 0 && data_end > archive_size {
                return Err(PffError::EntryDataOutOfBounds { name });
            }

            entries.push(PffEntry {
                table_index,
                flags,
                offset,
                size,
                timestamp,
                name,
                checksum,
            });
        }

        Ok(Self {
            path,
            header: PffHeader { signature },
            entries,
            archive_size,
        })
    }

    fn display_name(&self) -> String {
        self.path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("unknown.pff")
            .to_string()
    }

    fn entry_by_index(&self, table_index: u32) -> Option<&PffEntry> {
        self.entries
            .iter()
            .find(|entry| entry.table_index == table_index && !entry.is_deleted())
    }

    fn extract_raw(&self, entry: &PffEntry) -> Result<Vec<u8>, PffError> {
        let mut file = File::open(&self.path)?;
        file.seek(SeekFrom::Start(entry.offset as u64))?;

        let mut data = vec![0_u8; entry.size as usize];
        file.read_exact(&mut data)?;
        Ok(data)
    }

    fn extract_decoded(&self, entry: &PffEntry) -> Result<ExtractedData, PffError> {
        let mut data = self.extract_raw(entry)?;
        let mut transforms = Vec::new();

        if is_bfc1(&data) {
            data = decompress_bfc1(&data)?;
            transforms.push("BFC1".to_string());
        }

        if is_scr(&data) {
            let key = if entry.name.to_ascii_lowercase().ends_with(".fx") {
                SCR_KEY_FX
            } else {
                SCR_KEY_DEFAULT
            };
            data = decrypt_scr(&data, key)?;
            transforms.push("SCR".to_string());
        }

        if is_rtxt(&data) {
            data = parse_rtxt(&data)?.to_toml().into_bytes();
            transforms.push("RTXT->TOML".to_string());
        }

        Ok(ExtractedData { data, transforms })
    }
}

impl ResourceKind {
    fn from_name(name: &str) -> Self {
        let ext = name
            .rsplit_once('.')
            .map(|(_, ext)| ext.to_ascii_lowercase())
            .unwrap_or_default();

        match ext.as_str() {
            "dds" | "tga" | "bmp" | "pcx" | "png" | "jpg" | "jpeg" => Self::Tex,
            "wav" | "ogg" | "mp3" | "wma" => Self::Snd,
            "3di" | "p3d" | "obj" | "bad" | "panm" => Self::Mdl,
            "fx" | "vsh" | "psh" | "hlsl" | "glsl" => Self::Shd,
            "lua" | "xml" | "cfg" | "ini" | "txt" | "def" | "adm" | "lst" | "toml" | "json"
            | "csv" => Self::Cfg,
            _ => Self::Dat,
        }
    }
}

struct ExtractedData {
    data: Vec<u8>,
    transforms: Vec<String>,
}

fn preview_from_bytes(
    archive_path: &Path,
    entry: &PffEntry,
    data: Vec<u8>,
    transforms: Vec<String>,
    preview_cache_dir: Option<&Path>,
) -> PreviewResponse {
    let byte_len = data.len();
    let hex_head = hex_head(&data, 96);

    if is_previewable_image(&entry.name) {
        let cache_key = preview_cache_key(archive_path, entry, byte_len);
        match image_preview_from_bytes_with_cache(&entry.name, &data, preview_cache_dir, &cache_key)
        {
            Ok(image) => {
                let image_format = image.format.clone();
                let mut transforms = transforms;
                transforms.push(format!("{image_format}->PNG"));

                return PreviewResponse {
                    status: PreviewStatus::Image,
                    text: None,
                    image: Some(image),
                    audio: None,
                    hex_head,
                    byte_len,
                    transforms,
                    message: None,
                };
            }
            Err(error) => {
                return PreviewResponse {
                    status: PreviewStatus::Binary,
                    text: None,
                    image: None,
                    audio: None,
                    hex_head,
                    byte_len,
                    transforms,
                    message: Some(error.to_string()),
                };
            }
        }
    }

    if is_previewable_audio(&entry.name, &data) {
        let cache_key = preview_cache_key(archive_path, entry, byte_len);
        match audio_preview_from_bytes_with_cache(&entry.name, &data, preview_cache_dir, &cache_key)
        {
            Ok(audio_result) => {
                let mut transforms = transforms;
                if let Some(transform) = audio_result.transform {
                    transforms.push(transform);
                }

                return PreviewResponse {
                    status: PreviewStatus::Audio,
                    text: None,
                    image: None,
                    audio: Some(audio_result.preview),
                    hex_head,
                    byte_len,
                    transforms,
                    message: None,
                };
            }
            Err(error) => {
                return PreviewResponse {
                    status: PreviewStatus::Binary,
                    text: None,
                    image: None,
                    audio: None,
                    hex_head,
                    byte_len,
                    transforms,
                    message: Some(error.to_string()),
                };
            }
        }
    }

    if byte_len > MAX_PREVIEW_BYTES {
        return PreviewResponse {
            status: PreviewStatus::TooLarge,
            text: None,
            image: None,
            audio: None,
            hex_head,
            byte_len,
            transforms,
            message: Some(format!(
                "decoded file is {} and exceeds the {} preview limit",
                format_bytes(byte_len as u64),
                format_bytes(MAX_PREVIEW_BYTES as u64)
            )),
        };
    }

    if is_previewable_text(&entry.name, &data) {
        return PreviewResponse {
            status: PreviewStatus::Text,
            text: Some(String::from_utf8_lossy(&data).into_owned()),
            image: None,
            audio: None,
            hex_head,
            byte_len,
            transforms,
            message: None,
        };
    }

    PreviewResponse {
        status: PreviewStatus::Binary,
        text: None,
        image: None,
        audio: None,
        hex_head,
        byte_len,
        transforms,
        message: Some("binary file, no text preview available".to_string()),
    }
}

#[cfg(test)]
fn image_preview_from_bytes(name: &str, data: &[u8]) -> Result<ImagePreview, PffError> {
    image_preview_from_bytes_with_cache(name, data, None, "")
}

fn image_preview_from_bytes_with_cache(
    name: &str,
    data: &[u8],
    preview_cache_dir: Option<&Path>,
    cache_key: &str,
) -> Result<ImagePreview, PffError> {
    let (rgba, format) = decode_image_rgba(name, data)?;
    let width = rgba.width();
    let height = rgba.height();
    if u64::from(width) * u64::from(height) > MAX_IMAGE_PIXELS {
        return Err(PffError::ImageTooLarge {
            name: name.to_string(),
            width,
            height,
        });
    }

    let mut png = Vec::new();
    image::DynamicImage::ImageRgba8(rgba)
        .write_to(&mut Cursor::new(&mut png), image::ImageFormat::Png)
        .map_err(|error| PffError::ImageDecode {
            name: name.to_string(),
            message: error.to_string(),
        })?;

    if let Some(preview_cache_dir) = preview_cache_dir {
        let preview_path = preview_cache_dir.join(format!("{cache_key}.png"));
        fs::write(&preview_path, &png)?;

        return Ok(ImagePreview {
            data_url: None,
            file_path: Some(preview_path.to_string_lossy().into_owned()),
            width,
            height,
            format,
        });
    }

    let data_url = {
        use base64::Engine as _;
        format!(
            "data:image/png;base64,{}",
            base64::engine::general_purpose::STANDARD.encode(png)
        )
    };

    Ok(ImagePreview {
        data_url: Some(data_url),
        file_path: None,
        width,
        height,
        format,
    })
}

struct AudioPreviewResult {
    preview: AudioPreview,
    transform: Option<String>,
}

#[derive(Debug, Clone)]
struct WavMetadata {
    audio_format: u16,
    channels: u16,
    sample_rate: u32,
    byte_rate: u32,
    block_align: u16,
    bits_per_sample: u16,
    data_start: usize,
    data_len: usize,
    samples_per_block: Option<u16>,
}

fn audio_preview_from_bytes_with_cache(
    name: &str,
    data: &[u8],
    preview_cache_dir: Option<&Path>,
    cache_key: &str,
) -> Result<AudioPreviewResult, PffError> {
    if !is_wav_data(data) {
        return Err(PffError::AudioDecode {
            name: name.to_string(),
            message: "expected RIFF/WAVE data".to_string(),
        });
    }

    let metadata = parse_wav_metadata(name, data)?;
    let (playback_data, playback_ext, mime_type, transform) =
        playback_audio_bytes(name, data, &metadata)?;
    let playback_format = if playback_ext == "mp3" { "MP3" } else { "WAV" };
    let duration_seconds = wav_duration_seconds(&metadata);

    let (data_url, file_path) = if let Some(preview_cache_dir) = preview_cache_dir {
        let preview_path = preview_cache_dir.join(format!("{cache_key}.{playback_ext}"));
        fs::write(&preview_path, &playback_data)?;
        (None, Some(preview_path.to_string_lossy().into_owned()))
    } else {
        let data_url = {
            use base64::Engine as _;
            format!(
                "data:{mime_type};base64,{}",
                base64::engine::general_purpose::STANDARD.encode(playback_data)
            )
        };
        (Some(data_url), None)
    };

    Ok(AudioPreviewResult {
        preview: AudioPreview {
            data_url,
            file_path,
            format: playback_format.to_string(),
            mime_type: mime_type.to_string(),
            codec: wav_codec_label(metadata.audio_format).to_string(),
            sample_rate: Some(metadata.sample_rate),
            channels: Some(metadata.channels),
            bits_per_sample: (metadata.bits_per_sample > 0).then_some(metadata.bits_per_sample),
            duration_seconds,
        },
        transform,
    })
}

fn playback_audio_bytes(
    name: &str,
    data: &[u8],
    metadata: &WavMetadata,
) -> Result<(Vec<u8>, &'static str, &'static str, Option<String>), PffError> {
    match metadata.audio_format {
        0x0001 | 0x0003 => Ok((data.to_vec(), "wav", "audio/wav", None)),
        0x0011 => {
            let pcm = decode_ima_adpcm_wav(name, data, metadata)?;
            Ok((
                pcm,
                "wav",
                "audio/wav",
                Some("IMA ADPCM->PCM WAV".to_string()),
            ))
        }
        0x0055 => {
            let mp3 = wav_data_chunk(name, data, metadata)?.to_vec();
            Ok((mp3, "mp3", "audio/mpeg", Some("WAV/MP3->MP3".to_string())))
        }
        _ => Ok((data.to_vec(), "wav", "audio/wav", None)),
    }
}

fn parse_wav_metadata(name: &str, data: &[u8]) -> Result<WavMetadata, PffError> {
    if !is_wav_data(data) {
        return Err(PffError::AudioDecode {
            name: name.to_string(),
            message: "missing RIFF/WAVE header".to_string(),
        });
    }

    let mut offset = 12_usize;
    let mut fmt: Option<WavMetadata> = None;
    let mut data_chunk: Option<(usize, usize)> = None;

    while offset + 8 <= data.len() {
        let chunk_id = &data[offset..offset + 4];
        let chunk_len = read_u32_at(data, offset + 4)? as usize;
        let chunk_start = offset + 8;
        let Some(chunk_end) = chunk_start.checked_add(chunk_len) else {
            break;
        };
        if chunk_end > data.len() {
            break;
        }

        if chunk_id == b"fmt " && chunk_len >= 16 {
            let audio_format = read_u16_at(data, chunk_start)?;
            let channels = read_u16_at(data, chunk_start + 2)?;
            let sample_rate = read_u32_at(data, chunk_start + 4)?;
            let byte_rate = read_u32_at(data, chunk_start + 8)?;
            let block_align = read_u16_at(data, chunk_start + 12)?;
            let bits_per_sample = read_u16_at(data, chunk_start + 14)?;
            let samples_per_block = if chunk_len >= 22 {
                Some(read_u16_at(data, chunk_start + 20)?).filter(|value| *value > 0)
            } else {
                None
            };

            fmt = Some(WavMetadata {
                audio_format,
                channels,
                sample_rate,
                byte_rate,
                block_align,
                bits_per_sample,
                data_start: 0,
                data_len: 0,
                samples_per_block,
            });
        } else if chunk_id == b"data" {
            data_chunk = Some((chunk_start, chunk_len));
        }

        offset = chunk_end + (chunk_len & 1);
    }

    let mut metadata = fmt.ok_or_else(|| PffError::AudioDecode {
        name: name.to_string(),
        message: "missing WAV fmt chunk".to_string(),
    })?;
    let (data_start, data_len) = data_chunk.ok_or_else(|| PffError::AudioDecode {
        name: name.to_string(),
        message: "missing WAV data chunk".to_string(),
    })?;
    metadata.data_start = data_start;
    metadata.data_len = data_len;
    Ok(metadata)
}

fn wav_duration_seconds(metadata: &WavMetadata) -> Option<f64> {
    if metadata.byte_rate > 0 {
        return Some(metadata.data_len as f64 / metadata.byte_rate as f64);
    }

    None
}

fn wav_codec_label(format: u16) -> &'static str {
    match format {
        0x0001 => "PCM",
        0x0003 => "IEEE FLOAT",
        0x0011 => "IMA ADPCM",
        0x0055 => "MP3",
        _ => "WAVE",
    }
}

fn decode_ima_adpcm_wav(
    name: &str,
    data: &[u8],
    metadata: &WavMetadata,
) -> Result<Vec<u8>, PffError> {
    if metadata.channels != 1 {
        return Err(PffError::AudioDecode {
            name: name.to_string(),
            message: "IMA ADPCM preview currently supports mono WAV only".to_string(),
        });
    }

    let block_align = usize::from(metadata.block_align);
    if block_align < 4 {
        return Err(PffError::AudioDecode {
            name: name.to_string(),
            message: "invalid IMA ADPCM block alignment".to_string(),
        });
    }

    let encoded = wav_data_chunk(name, data, metadata)?;
    let mut pcm = Vec::new();

    for block in encoded.chunks(block_align) {
        if block.len() < 4 {
            break;
        }

        let mut predictor = i16::from_le_bytes([block[0], block[1]]) as i32;
        let mut step_index = block[2].min(88);
        append_i16_le(&mut pcm, predictor as i16);

        for byte in &block[4..] {
            predictor = decode_ima_nibble(byte & 0x0F, predictor, &mut step_index);
            append_i16_le(&mut pcm, predictor as i16);
            predictor = decode_ima_nibble(byte >> 4, predictor, &mut step_index);
            append_i16_le(&mut pcm, predictor as i16);
        }
    }

    let expected_samples = metadata.samples_per_block.map(|samples_per_block| {
        let block_count = (encoded.len() + block_align.saturating_sub(1)) / block_align;
        block_count * usize::from(samples_per_block)
    });
    if let Some(expected_samples) = expected_samples {
        pcm.truncate(expected_samples * 2);
    }

    Ok(write_pcm_wav(
        metadata.sample_rate,
        metadata.channels,
        16,
        &pcm,
    ))
}

fn decode_ima_nibble(nibble: u8, predictor: i32, step_index: &mut u8) -> i32 {
    const INDEX_TABLE: [i32; 16] = [-1, -1, -1, -1, 2, 4, 6, 8, -1, -1, -1, -1, 2, 4, 6, 8];
    const STEP_TABLE: [i32; 89] = [
        7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60,
        66, 73, 80, 88, 97, 107, 118, 130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371,
        408, 449, 494, 544, 598, 658, 724, 796, 876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878,
        2066, 2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845,
        8630, 9493, 10442, 11487, 12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086,
        29794, 32767,
    ];

    let step = STEP_TABLE[*step_index as usize];
    let mut diff = step >> 3;
    if nibble & 0x01 != 0 {
        diff += step >> 2;
    }
    if nibble & 0x02 != 0 {
        diff += step >> 1;
    }
    if nibble & 0x04 != 0 {
        diff += step;
    }

    let next = if nibble & 0x08 != 0 {
        predictor - diff
    } else {
        predictor + diff
    }
    .clamp(i16::MIN as i32, i16::MAX as i32);

    let next_index = (*step_index as i32 + INDEX_TABLE[nibble as usize]).clamp(0, 88);
    *step_index = next_index as u8;
    next
}

fn wav_data_chunk<'a>(
    name: &str,
    data: &'a [u8],
    metadata: &WavMetadata,
) -> Result<&'a [u8], PffError> {
    let data_end = metadata
        .data_start
        .checked_add(metadata.data_len)
        .ok_or_else(|| PffError::AudioDecode {
            name: name.to_string(),
            message: "WAV data chunk range overflowed".to_string(),
        })?;

    data.get(metadata.data_start..data_end)
        .ok_or_else(|| PffError::AudioDecode {
            name: name.to_string(),
            message: "WAV data chunk is out of bounds".to_string(),
        })
}

fn write_pcm_wav(sample_rate: u32, channels: u16, bits_per_sample: u16, pcm: &[u8]) -> Vec<u8> {
    let byte_rate = sample_rate * u32::from(channels) * u32::from(bits_per_sample) / 8;
    let block_align = channels * bits_per_sample / 8;
    let riff_size = 36_u32 + pcm.len() as u32;

    let mut out = Vec::with_capacity(44 + pcm.len());
    out.extend_from_slice(b"RIFF");
    out.extend_from_slice(&riff_size.to_le_bytes());
    out.extend_from_slice(b"WAVE");
    out.extend_from_slice(b"fmt ");
    out.extend_from_slice(&16_u32.to_le_bytes());
    out.extend_from_slice(&1_u16.to_le_bytes());
    out.extend_from_slice(&channels.to_le_bytes());
    out.extend_from_slice(&sample_rate.to_le_bytes());
    out.extend_from_slice(&byte_rate.to_le_bytes());
    out.extend_from_slice(&block_align.to_le_bytes());
    out.extend_from_slice(&bits_per_sample.to_le_bytes());
    out.extend_from_slice(b"data");
    out.extend_from_slice(&(pcm.len() as u32).to_le_bytes());
    out.extend_from_slice(pcm);
    out
}

fn append_i16_le(out: &mut Vec<u8>, sample: i16) {
    out.extend_from_slice(&sample.to_le_bytes());
}

fn preview_cache_key(archive_path: &Path, entry: &PffEntry, byte_len: usize) -> String {
    let mut hasher = DefaultHasher::new();
    archive_path.to_string_lossy().hash(&mut hasher);
    entry.table_index.hash(&mut hasher);
    entry.offset.hash(&mut hasher);
    entry.size.hash(&mut hasher);
    entry.timestamp.hash(&mut hasher);
    entry.checksum.hash(&mut hasher);
    byte_len.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

fn decode_image_rgba(name: &str, data: &[u8]) -> Result<(image::RgbaImage, String), PffError> {
    if data.get(0..4) == Some(b"DDS ") {
        match decode_dds_rgba(data) {
            Ok(image) => return Ok((image, "DDS".to_string())),
            Err(error) => {
                let fallback = decode_image_crate_rgba(name, data);
                if fallback.is_ok() {
                    return fallback;
                }
                return Err(error);
            }
        }
    }

    if is_pcx_data(data) {
        return decode_pcx_rgba(data).map(|image| (image, "PCX".to_string()));
    }

    decode_image_crate_rgba(name, data)
}

fn decode_dds_rgba(data: &[u8]) -> Result<image::RgbaImage, PffError> {
    let mut cursor = Cursor::new(data);
    let dds =
        image_dds::ddsfile::Dds::read(&mut cursor).map_err(|error| PffError::ImageDecode {
            name: "DDS".to_string(),
            message: error.to_string(),
        })?;

    image_dds::image_from_dds(&dds, 0).map_err(|error| PffError::ImageDecode {
        name: "DDS".to_string(),
        message: error.to_string(),
    })
}

fn decode_pcx_rgba(data: &[u8]) -> Result<image::RgbaImage, PffError> {
    let mut reader = pcx::Reader::from_mem(data).map_err(|error| PffError::ImageDecode {
        name: "PCX".to_string(),
        message: error.to_string(),
    })?;
    let width = reader.width() as u32;
    let height = reader.height() as u32;
    let mut rgb = vec![0_u8; width as usize * height as usize * 3];
    reader
        .read_rgb_pixels(&mut rgb)
        .map_err(|error| PffError::ImageDecode {
            name: "PCX".to_string(),
            message: error.to_string(),
        })?;

    let mut rgba = Vec::with_capacity(width as usize * height as usize * 4);
    for pixel in rgb.chunks_exact(3) {
        rgba.extend_from_slice(&[pixel[0], pixel[1], pixel[2], 0xFF]);
    }

    image::RgbaImage::from_raw(width, height, rgba).ok_or_else(|| PffError::ImageDecode {
        name: "PCX".to_string(),
        message: "decoded pixel buffer size did not match dimensions".to_string(),
    })
}

fn decode_image_crate_rgba(
    name: &str,
    data: &[u8],
) -> Result<(image::RgbaImage, String), PffError> {
    let format = image_format_from_name(name);
    let decoded = match format {
        Some((format, _)) => image::load_from_memory_with_format(data, format)
            .or_else(|_| image::load_from_memory(data)),
        None => image::load_from_memory(data),
    }
    .map_err(|error| PffError::ImageDecode {
        name: name.to_string(),
        message: error.to_string(),
    })?;

    let label = format
        .map(|(_, label)| label.to_string())
        .unwrap_or_else(|| "IMAGE".to_string());
    Ok((decoded.to_rgba8(), label))
}

fn image_format_from_name(name: &str) -> Option<(image::ImageFormat, &'static str)> {
    match extension(name).as_str() {
        "tga" => Some((image::ImageFormat::Tga, "TGA")),
        "mdt" => Some((image::ImageFormat::Tga, "MDT/TGA")),
        "dds" => Some((image::ImageFormat::Tga, "TGA")),
        "bmp" => Some((image::ImageFormat::Bmp, "BMP")),
        "png" => Some((image::ImageFormat::Png, "PNG")),
        "jpg" | "jpeg" => Some((image::ImageFormat::Jpeg, "JPEG")),
        "gif" => Some((image::ImageFormat::Gif, "GIF")),
        "tif" | "tiff" => Some((image::ImageFormat::Tiff, "TIFF")),
        _ => None,
    }
}

fn is_previewable_image(name: &str) -> bool {
    matches!(
        extension(name).as_str(),
        "pcx" | "tga" | "dds" | "bmp" | "png" | "jpg" | "jpeg" | "gif" | "tif" | "tiff" | "mdt"
    )
}

fn is_previewable_audio(name: &str, data: &[u8]) -> bool {
    extension(name) == "wav" || is_wav_data(data)
}

fn is_wav_data(data: &[u8]) -> bool {
    data.len() >= 12 && data.get(0..4) == Some(b"RIFF") && data.get(8..12) == Some(b"WAVE")
}

fn is_pcx_data(data: &[u8]) -> bool {
    data.first().is_some_and(|byte| *byte == 0x0A)
}

fn is_previewable_text(name: &str, data: &[u8]) -> bool {
    let ext = extension(name);
    let known_text = matches!(
        ext.as_str(),
        "lua"
            | "xml"
            | "cfg"
            | "ini"
            | "txt"
            | "def"
            | "adm"
            | "lst"
            | "fx"
            | "vsh"
            | "psh"
            | "json"
            | "csv"
            | "toml"
    );

    if known_text {
        return true;
    }

    std::str::from_utf8(data).is_ok()
        && data
            .iter()
            .filter(|byte| byte.is_ascii_graphic() || byte.is_ascii_whitespace() || **byte == 0)
            .count()
            * 100
            >= data.len().max(1) * 95
}

fn extension(name: &str) -> String {
    name.rsplit_once('.')
        .map(|(_, ext)| ext.to_ascii_lowercase())
        .unwrap_or_default()
}

fn read_u16_at(data: &[u8], offset: usize) -> Result<u16, PffError> {
    data.get(offset..offset + 2)
        .and_then(|bytes| bytes.try_into().ok())
        .map(u16::from_le_bytes)
        .ok_or_else(|| PffError::AudioDecode {
            name: "WAV".to_string(),
            message: format!("offset {offset} out of bounds"),
        })
}

fn read_u32_at(data: &[u8], offset: usize) -> Result<u32, PffError> {
    data.get(offset..offset + 4)
        .and_then(|bytes| bytes.try_into().ok())
        .map(u32::from_le_bytes)
        .ok_or_else(|| PffError::AudioDecode {
            name: "WAV".to_string(),
            message: format!("offset {offset} out of bounds"),
        })
}

fn read_u32_le<R: Read>(reader: &mut R) -> io::Result<u32> {
    let mut buf = [0_u8; 4];
    reader.read_exact(&mut buf)?;
    Ok(u32::from_le_bytes(buf))
}

fn fixed_string(bytes: &[u8]) -> String {
    let end = bytes
        .iter()
        .position(|byte| *byte == 0)
        .unwrap_or(bytes.len());
    String::from_utf8_lossy(&bytes[..end]).trim().to_string()
}

fn is_bfc1(data: &[u8]) -> bool {
    data.len() >= 4 && data[..4] == *b"BFC1"
}

fn decompress_bfc1(data: &[u8]) -> Result<Vec<u8>, PffError> {
    if data.len() < BFC1_HEADER_SIZE {
        return Err(PffError::Bfc1TooShort);
    }

    let decoded_size = u32::from_le_bytes([data[4], data[5], data[6], data[7]]) as usize;
    if decoded_size > MAX_DECODED_SIZE {
        return Err(PffError::Bfc1TooLarge(decoded_size));
    }

    let compressed = &data[BFC1_HEADER_SIZE..];
    let mut out = Vec::with_capacity(decoded_size);
    match ZlibDecoder::new(compressed).read_to_end(&mut out) {
        Ok(_) => Ok(out),
        Err(zlib_err) => {
            let mut fallback = Vec::with_capacity(decoded_size);
            DeflateDecoder::new(compressed)
                .read_to_end(&mut fallback)
                .map_err(|deflate_err| {
                    PffError::Bfc1Decode(format!("zlib: {zlib_err}; raw deflate: {deflate_err}"))
                })?;
            Ok(fallback)
        }
    }
}

fn is_scr(data: &[u8]) -> bool {
    data.len() >= 4 && data[..4] == *b"SCR\x01"
}

fn decrypt_scr(data: &[u8], key: u32) -> Result<Vec<u8>, PffError> {
    if data.len() < 4 {
        return Err(PffError::ScrTooShort);
    }
    if !is_scr(data) {
        return Err(PffError::ScrInvalidMagic);
    }

    let mut out: Vec<u8> = data[4..].iter().copied().rev().collect();
    let mut k = key;

    for byte in &mut out {
        k = k.wrapping_add(k.rotate_left(11));
        k = k.rotate_left(4) ^ 1;
        *byte ^= (k & 0xff) as u8;
    }

    Ok(out)
}

fn is_rtxt(data: &[u8]) -> bool {
    data.len() >= 4 && data[..4] == *b"RTXT"
}

fn hex_head(data: &[u8], limit: usize) -> String {
    data.iter()
        .take(limit)
        .map(|byte| format!("{byte:02x}"))
        .collect::<Vec<_>>()
        .join(" ")
}

fn format_bytes(size: u64) -> String {
    const UNITS: [&str; 5] = ["B", "KB", "MB", "GB", "TB"];
    let mut value = size as f64;
    let mut unit = 0_usize;
    while value >= 1024.0 && unit < UNITS.len() - 1 {
        value /= 1024.0;
        unit += 1;
    }
    if unit == 0 {
        format!("{size} {}", UNITS[unit])
    } else {
        format!("{value:.1} {}", UNITS[unit])
    }
}

#[derive(Debug)]
struct RtxtEntry {
    key: String,
    value: String,
}

#[derive(Debug)]
struct RtxtSection {
    name: String,
    entries: Vec<RtxtEntry>,
}

#[derive(Debug)]
struct RtxtFile {
    sections: Vec<RtxtSection>,
}

impl RtxtFile {
    fn to_toml(&self) -> String {
        let mut root = toml::Table::new();
        for section in &self.sections {
            let mut table = toml::Table::new();
            for entry in &section.entries {
                table.insert(
                    entry.key.clone(),
                    toml::Value::String(entry.value.replace('\r', "")),
                );
            }
            root.insert(section.name.clone(), toml::Value::Table(table));
        }
        toml::to_string(&root).unwrap_or_default()
    }
}

fn parse_rtxt(data: &[u8]) -> Result<RtxtFile, PffError> {
    if data.len() < 16 {
        return Err(PffError::Rtxt("file too small".to_string()));
    }
    if !is_rtxt(data) {
        return Err(PffError::Rtxt("bad magic".to_string()));
    }

    let section_table_offset = rtxt_u32(data, 4)?;
    let value_count = rtxt_u32(data, 12)?;
    let string_pool_base = 16 * (value_count + 1);

    let section_count = rtxt_u32(data, section_table_offset)?;
    let entries_base = section_table_offset + 4;
    let mut section_name_offset = entries_base + 8 * section_count;
    let mut sections = Vec::with_capacity(section_count);
    let mut global_value_index = 0_usize;

    for section_index in 0..section_count {
        let entry_offset = entries_base + section_index * 8;
        let keys_rel = rtxt_u32(data, entry_offset)?;
        let sub_count = rtxt_u32(data, entry_offset + 4)?;
        let section_name = rtxt_cstring(data, section_name_offset)?;
        section_name_offset += section_name.len() + 1;

        let mut key_offset = entries_base + keys_rel;
        let mut entries = Vec::with_capacity(sub_count);

        for sub_index in 0..sub_count {
            let key = rtxt_cstring(data, key_offset)?;
            key_offset += key.len() + 1;

            let value_entry_offset = 16 + (global_value_index + sub_index) * 16;
            let value_rel = rtxt_u32(data, value_entry_offset)?;
            let value = if value_rel == 0 {
                String::new()
            } else {
                rtxt_cstring(data, string_pool_base + value_rel)?
            };

            entries.push(RtxtEntry { key, value });
        }

        global_value_index += sub_count;
        sections.push(RtxtSection {
            name: section_name,
            entries,
        });
    }

    Ok(RtxtFile { sections })
}

fn rtxt_u32(data: &[u8], offset: usize) -> Result<usize, PffError> {
    data.get(offset..offset + 4)
        .and_then(|bytes| bytes.try_into().ok())
        .map(u32::from_le_bytes)
        .map(|value| value as usize)
        .ok_or_else(|| PffError::Rtxt(format!("offset {offset} out of bounds")))
}

fn rtxt_cstring(data: &[u8], offset: usize) -> Result<String, PffError> {
    let slice = data
        .get(offset..)
        .ok_or_else(|| PffError::Rtxt(format!("offset {offset} out of bounds")))?;
    let end = slice
        .iter()
        .position(|byte| *byte == 0)
        .unwrap_or(slice.len());
    Ok(String::from_utf8_lossy(&slice[..end]).into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    use flate2::{write::ZlibEncoder, Compression};
    use std::io::Write;

    #[test]
    fn opens_minimal_pff3() {
        let path = temp_path("minimal.pff");
        write_fixture(&path, vec![fixture_entry(0, "hello.txt", b"hello")]);

        let archive = PffArchive::open(&path).expect("archive opens");
        assert_eq!(archive.header.version(), "PFF3");
        assert_eq!(archive.entries.len(), 1);
        assert_eq!(archive.entries[0].name, "hello.txt");
        assert_eq!(archive.extract_raw(&archive.entries[0]).unwrap(), b"hello");

        let _ = fs::remove_file(path);
    }

    #[test]
    fn filters_deleted_entries_from_snapshot() {
        let path = temp_path("deleted.pff");
        let live = fixture_entry(0, "live.txt", b"live");
        let mut deleted = fixture_entry(1, "dead.txt", b"dead");
        deleted.flags = PFF_FLAG_DELETED;
        write_fixture(&path, vec![live.clone(), deleted]);

        let snapshot = snapshot_from_archives(vec![PffArchive::open(&path).unwrap()], Vec::new());
        assert_eq!(snapshot.entries.len(), 1);
        assert_eq!(snapshot.entries[0].name, live.name);
        assert_eq!(snapshot.stats.deleted_count, 1);

        let _ = fs::remove_file(path);
    }

    #[test]
    fn decodes_bfc1() {
        let mut encoder = ZlibEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(b"decoded text").unwrap();
        let compressed = encoder.finish().unwrap();

        let mut data = Vec::new();
        data.extend_from_slice(b"BFC1");
        data.extend_from_slice(&(12_u32).to_le_bytes());
        data.extend_from_slice(&compressed);

        assert_eq!(decompress_bfc1(&data).unwrap(), b"decoded text");
    }

    #[test]
    fn previews_wav_audio() {
        let entry = PffEntry {
            table_index: 0,
            flags: 0,
            offset: 20,
            size: 48,
            timestamp: 0,
            name: "click.wav".to_string(),
            checksum: None,
        };
        let preview = preview_from_bytes(
            Path::new("fixture.pff"),
            &entry,
            fixture_wav(),
            Vec::new(),
            None,
        );

        assert!(matches!(preview.status, PreviewStatus::Audio));
        let audio = preview.audio.expect("audio preview");
        assert_eq!(audio.format, "WAV");
        assert_eq!(audio.mime_type, "audio/wav");
        assert_eq!(audio.codec, "PCM");
        assert_eq!(audio.sample_rate, Some(8000));
        assert_eq!(audio.channels, Some(1));
        assert_eq!(audio.bits_per_sample, Some(8));
        assert!(audio
            .data_url
            .as_deref()
            .is_some_and(|url| url.starts_with("data:audio/wav;base64,")));
    }

    #[test]
    fn opens_external_sample_when_env_is_set() {
        let Ok(path) = std::env::var("PFF_EXPLORER_SAMPLE_PFF") else {
            return;
        };

        let archive = PffArchive::open(path).expect("external sample opens");
        let visible_count = archive
            .entries
            .iter()
            .filter(|entry| !entry.is_deleted())
            .count();

        assert!(visible_count > 0);
    }

    #[test]
    fn previews_external_sample_image_when_env_is_set() {
        let Ok(path) = std::env::var("PFF_EXPLORER_SAMPLE_PFF") else {
            return;
        };

        let archive = PffArchive::open(path).expect("external sample opens");
        let mut failures = Vec::new();

        for entry in archive
            .entries
            .iter()
            .filter(|entry| !entry.is_deleted() && is_previewable_image(&entry.name))
            .take(128)
        {
            let ExtractedData { data, .. } =
                archive.extract_decoded(entry).expect("image bytes extract");

            match image_preview_from_bytes(&entry.name, &data) {
                Ok(preview) => {
                    assert!(preview.width > 0);
                    assert!(preview.height > 0);
                    assert!(preview.file_path.is_none());
                    assert!(preview
                        .data_url
                        .as_deref()
                        .is_some_and(|url| url.starts_with("data:image/png;base64,")));
                    return;
                }
                Err(error) => failures.push(format!("{}: {error}", entry.name)),
            }
        }

        panic!("no previewable images decoded: {}", failures.join("; "));
    }

    #[derive(Clone)]
    struct FixtureEntry {
        flags: u32,
        name: String,
        data: Vec<u8>,
    }

    fn fixture_entry(_index: u32, name: &str, data: &[u8]) -> FixtureEntry {
        FixtureEntry {
            flags: 0,
            name: name.to_string(),
            data: data.to_vec(),
        }
    }

    fn fixture_wav() -> Vec<u8> {
        let pcm = [0x80_u8, 0x80, 0x80, 0x80];
        write_pcm_wav(8000, 1, 8, &pcm)
    }

    fn write_fixture(path: &Path, fixtures: Vec<FixtureEntry>) {
        let header_size = 20_u32;
        let entry_size = 36_u32;
        let data_start = header_size as usize;
        let data_len = fixtures
            .iter()
            .map(|fixture| fixture.data.len())
            .sum::<usize>();
        let table_offset = (data_start + data_len) as u32;

        let mut bytes = Vec::new();
        bytes.extend_from_slice(&header_size.to_le_bytes());
        bytes.extend_from_slice(b"PFF3");
        bytes.extend_from_slice(&(fixtures.len() as u32).to_le_bytes());
        bytes.extend_from_slice(&entry_size.to_le_bytes());
        bytes.extend_from_slice(&table_offset.to_le_bytes());

        let mut offsets = Vec::new();
        for fixture in &fixtures {
            offsets.push(bytes.len() as u32);
            bytes.extend_from_slice(&fixture.data);
        }

        for (idx, fixture) in fixtures.iter().enumerate() {
            bytes.extend_from_slice(&fixture.flags.to_le_bytes());
            bytes.extend_from_slice(&offsets[idx].to_le_bytes());
            bytes.extend_from_slice(&(fixture.data.len() as u32).to_le_bytes());
            bytes.extend_from_slice(&0_u32.to_le_bytes());

            let mut name = [0_u8; 16];
            let name_bytes = fixture.name.as_bytes();
            let copy_len = name_bytes.len().min(16);
            name[..copy_len].copy_from_slice(&name_bytes[..copy_len]);
            bytes.extend_from_slice(&name);
            bytes.extend_from_slice(&0_u32.to_le_bytes());
        }

        fs::write(path, bytes).unwrap();
    }

    fn temp_path(name: &str) -> PathBuf {
        let unique = format!("pff-explorer-test-{}-{name}", std::process::id());
        std::env::temp_dir().join(unique)
    }
}
