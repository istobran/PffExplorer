use std::fs::File;
use std::io::{self, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

use super::error::PffError;
use super::transform::{
    decompress_bfc1, decrypt_scr, is_bfc1, is_rtxt, is_scr, parse_rtxt, SCR_KEY_DEFAULT, SCR_KEY_FX,
};

const PFF3_MAGIC: [u8; 4] = *b"PFF3";
const PFF4_MAGIC: [u8; 4] = *b"PFF4";
const PFF_HEADER_SIZE: u64 = 20;
pub(crate) const PFF_FLAG_DELETED: u32 = 0x01;

#[derive(Debug, Clone)]
pub(crate) struct PffHeader {
    signature: [u8; 4],
}

#[derive(Debug, Clone)]
pub(crate) struct PffEntry {
    pub(crate) table_index: u32,
    pub(crate) flags: u32,
    pub(crate) offset: u32,
    pub(crate) size: u32,
    pub(crate) timestamp: u32,
    pub(crate) name: String,
    pub(crate) checksum: Option<u32>,
}

impl PffEntry {
    pub(crate) fn is_deleted(&self) -> bool {
        self.flags & PFF_FLAG_DELETED != 0
    }
}

#[derive(Debug, Clone)]
pub(crate) struct PffArchive {
    pub(crate) path: PathBuf,
    pub(crate) header: PffHeader,
    pub(crate) entries: Vec<PffEntry>,
    pub(crate) archive_size: u64,
}

impl PffHeader {
    pub(crate) fn version(&self) -> String {
        String::from_utf8_lossy(&self.signature).into_owned()
    }
}

impl PffArchive {
    pub(crate) fn open(path: impl AsRef<Path>) -> Result<Self, PffError> {
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

    pub(crate) fn display_name(&self) -> String {
        self.path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("unknown.pff")
            .to_string()
    }

    pub(crate) fn entry_by_index(&self, table_index: u32) -> Option<&PffEntry> {
        self.entries
            .iter()
            .find(|entry| entry.table_index == table_index && !entry.is_deleted())
    }

    pub(crate) fn extract_raw(&self, entry: &PffEntry) -> Result<Vec<u8>, PffError> {
        let mut file = File::open(&self.path)?;
        file.seek(SeekFrom::Start(entry.offset as u64))?;

        let mut data = vec![0_u8; entry.size as usize];
        file.read_exact(&mut data)?;
        Ok(data)
    }

    pub(crate) fn extract_decoded(&self, entry: &PffEntry) -> Result<ExtractedData, PffError> {
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
            transforms.push("RTXT".to_string());
        }

        Ok(ExtractedData { data, transforms })
    }
}

pub(crate) struct ExtractedData {
    pub(crate) data: Vec<u8>,
    pub(crate) transforms: Vec<String>,
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
