use serde::{Deserialize, Serialize};

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

impl ResourceKind {
    pub(crate) fn from_name(name: &str) -> Self {
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
    pub preview_url: Option<String>,
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
