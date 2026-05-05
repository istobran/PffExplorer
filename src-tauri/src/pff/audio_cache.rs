use std::sync::{Arc, RwLock};

#[derive(Clone, Default)]
pub(crate) struct AudioPreviewCache {
    inner: Arc<RwLock<Option<CachedAudioPreview>>>,
}

#[derive(Clone)]
struct CachedAudioPreview {
    token: String,
    bytes: Vec<u8>,
}

impl AudioPreviewCache {
    pub(crate) fn clear(&self) {
        if let Ok(mut cached) = self.inner.write() {
            *cached = None;
        }
    }

    pub(crate) fn store(&self, token: &str, bytes: Vec<u8>) -> String {
        if let Ok(mut cached) = self.inner.write() {
            *cached = Some(CachedAudioPreview {
                token: token.to_string(),
                bytes,
            });
        }

        token.to_string()
    }

    fn get(&self, token: &str) -> Option<CachedAudioPreview> {
        let cached = self.inner.read().ok()?;
        let audio = cached.as_ref()?;
        (audio.token == token).then(|| audio.clone())
    }

    pub(crate) fn bytes(&self, token: &str) -> Option<Vec<u8>> {
        self.get(token).map(|audio| audio.bytes)
    }
}
