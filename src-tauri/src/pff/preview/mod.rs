pub(crate) mod audio;
pub(crate) mod image;
mod text;
mod util;

use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::Path;

use super::archive::PffEntry;
use super::models::{PreviewResponse, PreviewStatus};
use audio::{audio_preview_from_bytes_with_cache, is_previewable_audio};
use image::{image_preview_from_bytes_with_cache, is_previewable_image};
use text::is_previewable_text;

const MAX_PREVIEW_BYTES: usize = 512 * 1024;

pub(crate) fn preview_from_bytes(
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
                transforms.push(image_format);

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
