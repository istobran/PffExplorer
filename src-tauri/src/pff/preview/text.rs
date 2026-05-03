use super::util::extension;

pub(super) fn is_previewable_text(name: &str, data: &[u8]) -> bool {
    let ext = extension(name);
    let known_text = matches!(
        ext.as_str(),
        "lua"
            | "xml"
            | "cfg"
            | "ini"
            | "txt"
            | "def"
            | "adm"
            | "lst"
            | "fx"
            | "vsh"
            | "psh"
            | "json"
            | "csv"
            | "toml"
    );

    if known_text {
        return true;
    }

    std::str::from_utf8(data).is_ok()
        && data
            .iter()
            .filter(|byte| byte.is_ascii_graphic() || byte.is_ascii_whitespace() || **byte == 0)
            .count()
            * 100
            >= data.len().max(1) * 95
}
