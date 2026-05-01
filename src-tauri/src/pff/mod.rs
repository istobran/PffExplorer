use std::fs::{self, File};
use std::io::{self, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

use flate2::read::{DeflateDecoder, ZlibDecoder};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use walkdir::WalkDir;

const PFF3_MAGIC: [u8; 4] = *b"PFF3";
const PFF4_MAGIC: [u8; 4] = *b"PFF4";
const PFF_HEADER_SIZE: u64 = 20;
const PFF_FLAG_DELETED: u32 = 0x01;
const BFC1_HEADER_SIZE: usize = 8;
const MAX_DECODED_SIZE: usize = 128 * 1024 * 1024;
const MAX_PREVIEW_BYTES: usize = 512 * 1024;
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
    pub hex_head: String,
    pub byte_len: usize,
    pub transforms: Vec<String>,
    pub message: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum PreviewStatus {
    Text,
    Binary,
    TooLarge,
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
    let mut archives = Vec::new();
    let mut warnings = Vec::new();
    let paths = collect_project_pffs(Path::new(&path));

    for pff_path in paths {
        match PffArchive::open(&pff_path) {
            Ok(archive) => archives.push(archive),
            Err(err) => warnings.push(format!("{}: {err}", pff_path.display())),
        }
    }

    Ok(snapshot_from_archives(archives, warnings))
}

#[tauri::command]
pub fn preview_entry(archive_path: String, entry_index: u32) -> Result<PreviewResponse, String> {
    let archive = PffArchive::open(archive_path).map_err(command_error)?;
    let entry = archive
        .entry_by_index(entry_index)
        .ok_or_else(|| command_error(PffError::EntryNotFound(entry_index)))?;
    let ExtractedData { data, transforms } =
        archive.extract_decoded(entry).map_err(command_error)?;
    Ok(preview_from_bytes(entry, data, transforms))
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

fn preview_from_bytes(entry: &PffEntry, data: Vec<u8>, transforms: Vec<String>) -> PreviewResponse {
    let byte_len = data.len();
    let hex_head = hex_head(&data, 96);

    if byte_len > MAX_PREVIEW_BYTES {
        return PreviewResponse {
            status: PreviewStatus::TooLarge,
            text: None,
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
            hex_head,
            byte_len,
            transforms,
            message: None,
        };
    }

    PreviewResponse {
        status: PreviewStatus::Binary,
        text: None,
        hex_head,
        byte_len,
        transforms,
        message: Some("binary file, no text preview available".to_string()),
    }
}

fn is_previewable_text(name: &str, data: &[u8]) -> bool {
    let ext = name
        .rsplit_once('.')
        .map(|(_, ext)| ext.to_ascii_lowercase())
        .unwrap_or_default();
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
