use std::io;

use thiserror::Error;

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
