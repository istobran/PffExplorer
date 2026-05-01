const TEXT_EXTENSIONS = new Set([
  "lua",
  "xml",
  "cfg",
  "ini",
  "txt",
  "def",
  "adm",
  "lst",
  "fx",
  "vsh",
  "psh",
  "json",
  "csv",
  "toml",
]);

export function syntaxHighlight(line: string, ext: string) {
  const esc = escapeHtml(line);
  if (ext === "lua") {
    return esc
      .replace(/^(--.*)/g, '<span class="preview-comment">$1</span>')
      .replace(
        /\b(local|function|return|if|then|else|end|for|in|do|while|and|or|not|true|false|nil)\b/g,
        '<span class="preview-keyword">$1</span>',
      )
      .replace(/"([^"]*)"/g, '<span class="preview-string">"$1"</span>');
  }
  if (ext === "xml") {
    return esc
      .replace(/(&lt;!--.*?--&gt;)/g, '<span class="preview-comment">$1</span>')
      .replace(/(&lt;\/?[\w:]+)/g, '<span class="preview-tag">$1</span>')
      .replace(/(\s[\w:]+)=/g, '<span class="preview-attr">$1</span>=')
      .replace(/&gt;/g, '<span class="preview-tag">&gt;</span>');
  }
  if (ext === "cfg" || ext === "ini" || ext === "def" || ext === "adm") {
    return esc
      .replace(/^(;.*)/g, '<span class="preview-comment">$1</span>')
      .replace(/^(\[[\w\s]+\])/gm, '<span class="preview-keyword">$1</span>')
      .replace(/^([\w.-]+)\s*=/gm, '<span class="preview-attr">$1</span>=');
  }
  if (ext === "fx" || ext === "vsh" || ext === "psh") {
    return esc.replace(
      /\b(vs_|ps_|mov|mul|add|sub|dp3|dp4|float|float2|float3|float4|float3x3|sampler|texture|return|void)\b/g,
      '<span class="preview-keyword">$1</span>',
    );
  }
  if (TEXT_EXTENSIONS.has(ext)) {
    return esc.replace(/^(#.*)/g, '<span class="preview-comment">$1</span>');
  }
  return esc;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
