use std::sync::{Arc, RwLock};

use tauri::http::{header, Request, Response, StatusCode};

#[derive(Clone, Default)]
pub(crate) struct AudioPreviewCache {
    inner: Arc<RwLock<Option<CachedAudioPreview>>>,
}

#[derive(Clone)]
struct CachedAudioPreview {
    token: String,
    mime_type: String,
    bytes: Vec<u8>,
}

impl AudioPreviewCache {
    pub(crate) fn clear(&self) {
        if let Ok(mut cached) = self.inner.write() {
            *cached = None;
        }
    }

    pub(crate) fn store(&self, token: &str, mime_type: &str, bytes: Vec<u8>) -> String {
        if let Ok(mut cached) = self.inner.write() {
            *cached = Some(CachedAudioPreview {
                token: token.to_string(),
                mime_type: mime_type.to_string(),
                bytes,
            });
        }

        format!("pff-explorer://localhost/audio/{token}.wav")
    }

    fn get(&self, token: &str) -> Option<CachedAudioPreview> {
        let cached = self.inner.read().ok()?;
        let audio = cached.as_ref()?;
        (audio.token == token).then(|| audio.clone())
    }
}

pub(crate) fn handle_protocol(
    cache: &AudioPreviewCache,
    request: Request<Vec<u8>>,
) -> Response<Vec<u8>> {
    if request.method() == tauri::http::Method::OPTIONS {
        return response(StatusCode::NO_CONTENT, "text/plain", Vec::new());
    }

    let Some(token) = token_from_path(request.uri().path()) else {
        return response(
            StatusCode::BAD_REQUEST,
            "text/plain",
            b"missing audio token".to_vec(),
        );
    };

    let Some(audio) = cache.get(token) else {
        return response(
            StatusCode::NOT_FOUND,
            "text/plain",
            b"audio preview expired".to_vec(),
        );
    };

    response(StatusCode::OK, &audio.mime_type, audio.bytes)
}

fn token_from_path(path: &str) -> Option<&str> {
    let segment = path.rsplit('/').find(|segment| !segment.is_empty())?;
    segment.strip_suffix(".wav").or(Some(segment))
}

fn response(status: StatusCode, content_type: &str, body: Vec<u8>) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CACHE_CONTROL, "no-store")
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(header::ACCESS_CONTROL_ALLOW_METHODS, "GET, OPTIONS")
        .body(body)
        .expect("valid pff audio protocol response")
}
