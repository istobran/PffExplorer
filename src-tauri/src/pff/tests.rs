use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use flate2::{write::ZlibEncoder, Compression};

use super::archive::{ExtractedData, PffArchive, PffEntry, PFF_FLAG_DELETED};
use super::commands::snapshot_from_archives;
use super::models::PreviewStatus;
use super::preview::audio::{is_previewable_audio, write_pcm_wav};
use super::preview::image::{image_preview_from_bytes, is_previewable_image};
use super::preview::preview_from_bytes;
use super::transform::decompress_bfc1;

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
    assert_eq!(audio.waveform.len(), 48);
    assert!(audio.waveform.iter().all(|value| value.is_finite()));
    assert!(audio.waveform.iter().any(|value| *value > 0.0));
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

#[test]
fn previews_external_sample_audio_when_env_is_set() {
    let Ok(path) = std::env::var("PFF_EXPLORER_SAMPLE_PFF") else {
        return;
    };

    let archive = PffArchive::open(&path).expect("external sample opens");
    let mut saw_audio = false;
    let mut failures = Vec::new();

    for entry in archive
        .entries
        .iter()
        .filter(|entry| !entry.is_deleted() && is_previewable_audio(&entry.name, &[]))
        .take(128)
    {
        saw_audio = true;
        let ExtractedData { data, transforms } =
            archive.extract_decoded(entry).expect("audio bytes extract");
        let preview = preview_from_bytes(Path::new(&path), entry, data, transforms, None);

        if matches!(preview.status, PreviewStatus::Audio) {
            let audio = preview.audio.expect("audio preview");
            assert_eq!(audio.mime_type, "audio/wav");
            assert!(audio.sample_rate.is_some());
            assert!(audio.channels.is_some());
            assert!(audio
                .data_url
                .as_deref()
                .is_some_and(|url| url.starts_with("data:audio/wav;base64,")));
            return;
        }

        failures.push(format!(
            "{}: {}",
            entry.name,
            preview.message.unwrap_or_else(|| "not audio".to_string())
        ));
    }

    if saw_audio {
        panic!("no previewable audio decoded: {}", failures.join("; "));
    }
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
    let pcm = [0x00_u8, 0x40, 0x80, 0xff];
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
