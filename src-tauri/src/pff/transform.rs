use std::io::Read;

use flate2::read::{DeflateDecoder, ZlibDecoder};

use super::error::PffError;

const BFC1_HEADER_SIZE: usize = 8;
pub(crate) const MAX_DECODED_SIZE: usize = 128 * 1024 * 1024;
pub(crate) const SCR_KEY_DEFAULT: u32 = 0x2A5A8EAD;
pub(crate) const SCR_KEY_FX: u32 = 0xA55B1EED;

pub(crate) fn is_bfc1(data: &[u8]) -> bool {
    data.len() >= 4 && data[..4] == *b"BFC1"
}

pub(crate) fn decompress_bfc1(data: &[u8]) -> Result<Vec<u8>, PffError> {
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

pub(crate) fn is_scr(data: &[u8]) -> bool {
    data.len() >= 4 && data[..4] == *b"SCR\x01"
}

pub(crate) fn decrypt_scr(data: &[u8], key: u32) -> Result<Vec<u8>, PffError> {
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

pub(crate) fn is_rtxt(data: &[u8]) -> bool {
    data.len() >= 4 && data[..4] == *b"RTXT"
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
pub(crate) struct RtxtFile {
    sections: Vec<RtxtSection>,
}

impl RtxtFile {
    pub(crate) fn to_toml(&self) -> String {
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

pub(crate) fn parse_rtxt(data: &[u8]) -> Result<RtxtFile, PffError> {
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
