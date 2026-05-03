use std::fs;
use std::io::{self, Cursor};
use std::path::Path;

use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::{CodecParameters, CodecType, DecoderOptions, CODEC_TYPE_NULL};
use symphonia::core::errors::Error as SymphoniaError;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::{MediaSourceStream, MediaSourceStreamOptions};
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

use super::super::error::PffError;
use super::super::models::AudioPreview;
use super::super::transform::MAX_DECODED_SIZE;
use super::util::extension;

pub(super) struct AudioPreviewResult {
    pub(super) preview: AudioPreview,
    pub(super) transform: Option<String>,
}

#[derive(Debug, Clone)]
struct DecodedAudio {
    pcm: Vec<u8>,
    format: String,
    channels: u16,
    sample_rate: u32,
    codec: String,
    bits_per_sample: Option<u16>,
    duration_seconds: Option<f64>,
}

pub(super) fn audio_preview_from_bytes_with_cache(
    name: &str,
    data: &[u8],
    preview_cache_dir: Option<&Path>,
    cache_key: &str,
) -> Result<AudioPreviewResult, PffError> {
    let decoded = decode_audio_to_pcm(name, data)?;
    let playback_data = write_pcm_wav(decoded.sample_rate, decoded.channels, 16, &decoded.pcm);
    let mime_type = "audio/wav";

    let (data_url, file_path) = if let Some(preview_cache_dir) = preview_cache_dir {
        let preview_path = preview_cache_dir.join(format!("{cache_key}.wav"));
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
            format: decoded.format,
            mime_type: mime_type.to_string(),
            codec: decoded.codec,
            sample_rate: Some(decoded.sample_rate),
            channels: Some(decoded.channels),
            bits_per_sample: decoded.bits_per_sample,
            duration_seconds: decoded.duration_seconds,
        },
        transform: Some("SYMPHONIA->PCM WAV".to_string()),
    })
}

fn decode_audio_to_pcm(name: &str, data: &[u8]) -> Result<DecodedAudio, PffError> {
    let cursor = Cursor::new(data.to_vec());
    let mss = MediaSourceStream::new(Box::new(cursor), MediaSourceStreamOptions::default());
    let mut hint = Hint::new();
    let ext = extension(name);
    if !ext.is_empty() {
        hint.with_extension(&ext);
    }

    let probed = symphonia::default::get_probe()
        .format(
            &hint,
            mss,
            &FormatOptions::default(),
            &MetadataOptions::default(),
        )
        .map_err(|error| symphonia_audio_error(name, "probe", error))?;
    let source_format = audio_format_label(name, data);
    let mut format = probed.format;
    let track = format
        .default_track()
        .or_else(|| {
            format
                .tracks()
                .iter()
                .find(|track| track.codec_params.codec != CODEC_TYPE_NULL)
        })
        .ok_or_else(|| PffError::AudioDecode {
            name: name.to_string(),
            message: "no audio track found".to_string(),
        })?;
    let track_id = track.id;
    let codec_params = track.codec_params.clone();
    let mut decoder = symphonia::default::get_codecs()
        .make(&codec_params, &DecoderOptions::default())
        .map_err(|error| symphonia_audio_error(name, "decoder", error))?;

    let mut pcm = Vec::new();
    let mut sample_rate = codec_params.sample_rate.unwrap_or(0);
    let mut channels = codec_params
        .channels
        .map(|channels| channels.count() as u16)
        .unwrap_or(0);

    loop {
        let packet = match format.next_packet() {
            Ok(packet) => packet,
            Err(SymphoniaError::IoError(error)) if error.kind() == io::ErrorKind::UnexpectedEof => {
                break
            }
            Err(error) => return Err(symphonia_audio_error(name, "packet", error)),
        };

        if packet.track_id() != track_id {
            continue;
        }

        let audio_buf = match decoder.decode(&packet) {
            Ok(audio_buf) => audio_buf,
            Err(SymphoniaError::DecodeError(_)) => continue,
            Err(error) => return Err(symphonia_audio_error(name, "decode", error)),
        };
        let spec = *audio_buf.spec();
        sample_rate = spec.rate;
        channels = spec.channels.count() as u16;

        let mut sample_buf = SampleBuffer::<i16>::new(audio_buf.capacity() as u64, spec);
        sample_buf.copy_interleaved_ref(audio_buf);
        pcm.reserve(sample_buf.samples().len() * 2);
        for sample in sample_buf.samples() {
            append_i16_le(&mut pcm, *sample);
        }
        if pcm.len() > MAX_DECODED_SIZE {
            return Err(PffError::AudioDecode {
                name: name.to_string(),
                message: format!("decoded audio exceeds {} bytes", MAX_DECODED_SIZE),
            });
        }
    }

    if pcm.is_empty() || sample_rate == 0 || channels == 0 {
        return Err(PffError::AudioDecode {
            name: name.to_string(),
            message: "no decodable audio samples found".to_string(),
        });
    }

    let sample_count = pcm.len() / 2;
    let frame_count = sample_count / usize::from(channels);

    Ok(DecodedAudio {
        pcm,
        format: source_format,
        channels,
        sample_rate,
        codec: concise_codec_label(&codec_params),
        bits_per_sample: codec_params
            .bits_per_sample
            .and_then(|value| u16::try_from(value).ok()),
        duration_seconds: Some(frame_count as f64 / sample_rate as f64),
    })
}

fn symphonia_audio_error(name: &str, phase: &str, error: SymphoniaError) -> PffError {
    PffError::AudioDecode {
        name: name.to_string(),
        message: format!("{phase} failed: {error}"),
    }
}

fn audio_format_label(name: &str, data: &[u8]) -> String {
    match extension(name).as_str() {
        "wav" | "wave" => "WAV".to_string(),
        "mp3" => "MP3".to_string(),
        ext if !ext.is_empty() => ext.to_ascii_uppercase(),
        _ if is_wav_data(data) => "WAV".to_string(),
        _ if is_mp3_data(data) => "MP3".to_string(),
        _ => "AUDIO".to_string(),
    }
}

fn concise_codec_label(codec_params: &CodecParameters) -> String {
    let Some(descriptor) = symphonia::default::get_codecs().get_codec(codec_params.codec) else {
        return codec_type_label(codec_params.codec);
    };

    match descriptor.short_name {
        "adpcm_ima_wav" => "IMA ADPCM".to_string(),
        "adpcm_ms" => "MS ADPCM".to_string(),
        "mp1" => "MP1".to_string(),
        "mp2" => "MP2".to_string(),
        "mp3" => "MP3".to_string(),
        short_name if short_name.starts_with("pcm") => "PCM".to_string(),
        short_name => {
            let label = short_name.replace('_', " ").to_ascii_uppercase();
            if label.starts_with("ADPCM ") {
                label.replace("ADPCM ", "") + " ADPCM"
            } else {
                label
            }
        }
    }
}

fn codec_type_label(codec: CodecType) -> String {
    format!("codec {codec}")
}

pub(crate) fn write_pcm_wav(
    sample_rate: u32,
    channels: u16,
    bits_per_sample: u16,
    pcm: &[u8],
) -> Vec<u8> {
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

pub(crate) fn is_previewable_audio(name: &str, data: &[u8]) -> bool {
    matches!(extension(name).as_str(), "wav" | "mp3") || is_wav_data(data) || is_mp3_data(data)
}

fn is_wav_data(data: &[u8]) -> bool {
    data.len() >= 12 && data.get(0..4) == Some(b"RIFF") && data.get(8..12) == Some(b"WAVE")
}

fn is_mp3_data(data: &[u8]) -> bool {
    data.get(0..3) == Some(b"ID3")
        || data
            .get(0..2)
            .is_some_and(|bytes| bytes[0] == 0xFF && bytes[1] & 0xE0 == 0xE0)
}
