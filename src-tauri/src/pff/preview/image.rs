use std::fs;
use std::io::Cursor;
use std::path::Path;

use super::super::error::PffError;
use super::super::models::ImagePreview;
use super::util::extension;

const MAX_IMAGE_PIXELS: u64 = 16 * 1024 * 1024;

#[cfg(test)]
pub(crate) fn image_preview_from_bytes(name: &str, data: &[u8]) -> Result<ImagePreview, PffError> {
    image_preview_from_bytes_with_cache(name, data, None, "")
}

pub(super) fn image_preview_from_bytes_with_cache(
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
        fs::create_dir_all(preview_cache_dir)?;
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

pub(crate) fn is_previewable_image(name: &str) -> bool {
    matches!(
        extension(name).as_str(),
        "pcx" | "tga" | "dds" | "bmp" | "png" | "jpg" | "jpeg" | "gif" | "tif" | "tiff" | "mdt"
    )
}

fn is_pcx_data(data: &[u8]) -> bool {
    data.first().is_some_and(|byte| *byte == 0x0A)
}
