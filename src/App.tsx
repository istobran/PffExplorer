import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open, save, message } from "@tauri-apps/plugin-dialog";
import { useVirtualizer } from "@tanstack/react-virtual";
import clsx from "clsx";
import {
  Archive,
  Box,
  Crosshair,
  Download,
  FileArchive,
  FolderOpen,
  Minus,
  Search,
  Square,
  X,
} from "lucide-react";
import "./App.css";

type ResourceKind = "TEX" | "SND" | "MDL" | "SHD" | "CFG" | "DAT";
type SortKey = "name" | "kind" | "size" | "offset" | "checksum" | "archiveName";
type ExportMode = "raw" | "decoded";

type ArchiveSummary = {
  path: string;
  name: string;
  version: string;
  fileCount: number;
  deletedCount: number;
  totalSize: number;
  archiveSize: number;
};

type ResourceEntry = {
  archivePath: string;
  archiveName: string;
  tableIndex: number;
  name: string;
  kind: ResourceKind;
  size: number;
  offset: number;
  timestamp: number;
  checksum: number | null;
  flags: number;
};

type WorkspaceSnapshot = {
  archives: ArchiveSummary[];
  entries: ResourceEntry[];
  stats: {
    archiveCount: number;
    entryCount: number;
    totalSize: number;
    deletedCount: number;
  };
  warnings: string[];
};

type PreviewResponse = {
  status: "text" | "binary" | "tooLarge";
  text: string | null;
  hexHead: string;
  byteLen: number;
  transforms: string[];
  message: string | null;
};

type ExportResult = {
  outputPath: string;
  byteLen: number;
  transforms: string[];
};

type StatusState = {
  label: string;
  target: string;
  progressLabel: string;
  progress: number | null;
};

const EMPTY_SNAPSHOT: WorkspaceSnapshot = {
  archives: [],
  entries: [],
  stats: {
    archiveCount: 0,
    entryCount: 0,
    totalSize: 0,
    deletedCount: 0,
  },
  warnings: [],
};

const FILTERS: Array<ResourceKind | "ALL"> = [
  "ALL",
  "TEX",
  "SND",
  "MDL",
  "SHD",
  "CFG",
  "DAT",
];

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

function App() {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>(EMPTY_SNAPSHOT);
  const [activeArchivePath, setActiveArchivePath] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [kindFilter, setKindFilter] = useState<ResourceKind | "ALL">("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [exportMode, setExportMode] = useState<ExportMode>("decoded");
  const [status, setStatus] = useState<StatusState>({
    label: "READY",
    target: "-",
    progressLabel: "IDLE",
    progress: null,
  });

  const selectedEntry = useMemo(() => {
    if (!selectedKey) return null;
    return snapshot.entries.find((entry) => entryKey(entry) === selectedKey) ?? null;
  }, [selectedKey, snapshot.entries]);

  const visibleRows = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const source =
      query.length > 0 || activeArchivePath === null
        ? snapshot.entries
        : snapshot.entries.filter((entry) => entry.archivePath === activeArchivePath);

    const rows = source
      .filter((entry) => kindFilter === "ALL" || entry.kind === kindFilter)
      .filter((entry) => {
        if (!query) return true;
        return (
          entry.name.toLowerCase().includes(query) ||
          entry.archiveName.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => compareRows(a, b, sortKey, sortAsc));

    return rows.map((entry, index) => ({ ...entry, rowNumber: index + 1 }));
  }, [activeArchivePath, kindFilter, searchText, snapshot.entries, sortAsc, sortKey]);

  useEffect(() => {
    if (!selectedEntry) {
      setPreview(null);
      setPreviewLoading(false);
      return;
    }

    let cancelled = false;
    setPreview(null);
    setPreviewLoading(true);

    invoke<PreviewResponse>("preview_entry", {
      archivePath: selectedEntry.archivePath,
      entryIndex: selectedEntry.tableIndex,
    })
      .then((response) => {
        if (!cancelled) setPreview(response);
      })
      .catch((error) => {
        if (!cancelled) {
          setPreview({
            status: "binary",
            text: null,
            hexHead: "",
            byteLen: selectedEntry.size,
            transforms: [],
            message: String(error),
          });
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedEntry]);

  async function openProject() {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Open game/resource directory",
    });
    const path = singlePath(selected);
    if (!path) return;

    await loadWorkspace("load_pff_project", path);
  }

  async function openFile() {
    const selected = await open({
      directory: false,
      multiple: false,
      title: "Open PFF file",
      filters: [{ name: "PFF archives", extensions: ["pff"] }],
    });
    const path = singlePath(selected);
    if (!path) return;

    await loadWorkspace("load_pff_file", path);
  }

  async function loadWorkspace(command: "load_pff_file" | "load_pff_project", path: string) {
    setStatus({
      label: "SCANNING",
      target: basename(path),
      progressLabel: "LOADING",
      progress: 35,
    });

    try {
      const next = await invoke<WorkspaceSnapshot>(command, { path });
      setSnapshot(next);
      setActiveArchivePath(null);
      setSearchText("");
      setKindFilter("ALL");
      setSelectedKey(null);
      setPreview(null);
      setStatus({
        label: next.warnings.length ? "READY WITH WARNINGS" : "READY",
        target: command === "load_pff_file" ? basename(path) : "ALL PACKAGES",
        progressLabel: "COMPLETE",
        progress: 100,
      });
    } catch (error) {
      setStatus({
        label: "ERROR",
        target: basename(path),
        progressLabel: "FAILED",
        progress: null,
      });
      await message(String(error), { title: "PFF load failed", kind: "error" });
    }
  }

  function selectArchive(path: string | null) {
    setActiveArchivePath(path);
    setSearchText("");
    setKindFilter("ALL");
    setSelectedKey(null);
    setPreview(null);
    setStatus({
      label: "LOADED",
      target: path ? basename(path).toUpperCase() : "ALL PACKAGES",
      progressLabel: "READY",
      progress: 100,
    });
  }

  function changeSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortAsc((value) => !value);
    } else {
      setSortKey(nextKey);
      setSortAsc(true);
    }
  }

  async function exportSelected() {
    if (!selectedEntry) return;

    const defaultPath = exportDefaultName(selectedEntry.name, exportMode);
    const outputPath = await save({
      title: `Export ${exportMode.toUpperCase()} resource`,
      defaultPath,
    });
    if (!outputPath) return;

    setStatus({
      label: "EXPORTING",
      target: selectedEntry.name,
      progressLabel: exportMode.toUpperCase(),
      progress: 55,
    });

    try {
      const result = await invoke<ExportResult>("export_entry", {
        request: {
          archivePath: selectedEntry.archivePath,
          entryIndex: selectedEntry.tableIndex,
          outputPath,
          mode: exportMode,
        },
      });
      setStatus({
        label: "READY",
        target: basename(result.outputPath),
        progressLabel: "EXPORTED",
        progress: 100,
      });
    } catch (error) {
      setStatus({
        label: "ERROR",
        target: selectedEntry.name,
        progressLabel: "FAILED",
        progress: null,
      });
      await message(String(error), { title: "Export failed", kind: "error" });
    }
  }

  async function minimizeWindow() {
    await getCurrentWindow().minimize();
  }

  async function toggleMaximizeWindow() {
    await getCurrentWindow().toggleMaximize();
  }

  async function closeWindow() {
    await getCurrentWindow().close();
  }

  return (
    <main id="app-shell">
      <style>{styles}</style>
      <nav id="navbar">
        <button className="nav-btn" onClick={openProject} title="Open game directory">
          <FolderOpen size={14} />
          <span>OPEN PROJECT</span>
        </button>
        <button className="nav-btn" onClick={openFile} title="Open single PFF file">
          <FileArchive size={14} />
          <span>OPEN FILE</span>
        </button>
        <div id="nav-center">
          <div id="nav-title">PFF RESOURCE EXPLORER</div>
        </div>
        <div id="logo-area">
          <div id="logo-mark">
            <Crosshair size={22} />
          </div>
          <div id="logo-text">
            DELTA FORCE<span>TACTICAL TOOLS v2.1</span>
          </div>
        </div>
        <div id="win-controls">
          <button className="win-btn" title="Minimize" onClick={minimizeWindow}>
            <Minus size={15} />
          </button>
          <button className="win-btn" title="Maximize" onClick={toggleMaximizeWindow}>
            <Square size={13} />
          </button>
          <button className="win-btn close" title="Close" onClick={closeWindow}>
            <X size={15} />
          </button>
        </div>
      </nav>

      <div id="content">
        <Panel id="tree-panel" title="PACKAGES" sub={`${snapshot.archives.length} PFF`}>
          <PackageTree
            archives={snapshot.archives}
            allCount={snapshot.entries.length}
            activeArchivePath={activeArchivePath}
            onSelect={selectArchive}
          />
        </Panel>

        <div id="right-col">
          <Panel id="table-panel" title="RESOURCE FILES" sub={`${visibleRows.length} FILES`}>
            <ResourceToolbar
              searchText={searchText}
              kindFilter={kindFilter}
              exportMode={exportMode}
              hasSelection={Boolean(selectedEntry)}
              onSearch={setSearchText}
              onKindFilter={setKindFilter}
              onExportMode={setExportMode}
              onExport={exportSelected}
            />
            <ResourceTable
              rows={visibleRows}
              selectedKey={selectedKey}
              searchText={searchText}
              sortKey={sortKey}
              sortAsc={sortAsc}
              onSort={changeSort}
              onSelect={(entry) => setSelectedKey(entryKey(entry))}
            />
          </Panel>

          {selectedEntry && (
            <Panel id="preview-panel" title="FILE PREVIEW" sub={selectedEntry.name}>
              <PreviewPanel
                entry={selectedEntry}
                preview={preview}
                loading={previewLoading}
              />
            </Panel>
          )}
        </div>
      </div>

      <StatusBar
        status={status}
        snapshot={snapshot}
        activeArchivePath={activeArchivePath}
      />
    </main>
  );
}

function Panel({
  id,
  title,
  sub,
  children,
}: {
  id: string;
  title: string;
  sub: string;
  children: ReactNode;
}) {
  return (
    <section className="panel" id={id}>
      <div className="corner-br" />
      <div className="corner-tr" />
      <div className="corner-bl" />
      <header className="panel-header">
        <div className="panel-title">{title}</div>
        <div className="panel-sub">{sub}</div>
      </header>
      {children}
    </section>
  );
}

function PackageTree({
  archives,
  allCount,
  activeArchivePath,
  onSelect,
}: {
  archives: ArchiveSummary[];
  allCount: number;
  activeArchivePath: string | null;
  onSelect: (path: string | null) => void;
}) {
  return (
    <div id="tree-list">
      <button
        className={clsx("pff-node all-node", activeArchivePath === null && "active")}
        onClick={() => onSelect(null)}
      >
        <Archive className="pff-icon" size={15} />
        <span className="pff-name">ALL PACKAGES</span>
        <span className="pff-count">{allCount}</span>
      </button>
      {archives.map((archive) => (
        <button
          key={archive.path}
          className={clsx("pff-node", activeArchivePath === archive.path && "active")}
          onClick={() => onSelect(archive.path)}
          title={archive.path}
        >
          <Box className="pff-icon" size={14} />
          <span className="pff-name">{archive.name.toUpperCase()}</span>
          <span className="pff-count">{archive.fileCount}</span>
        </button>
      ))}
      {archives.length === 0 && (
        <div className="empty-state compact">
          <FileArchive size={20} />
          <span>OPEN A PFF OR PROJECT</span>
        </div>
      )}
    </div>
  );
}

function ResourceToolbar({
  searchText,
  kindFilter,
  exportMode,
  hasSelection,
  onSearch,
  onKindFilter,
  onExportMode,
  onExport,
}: {
  searchText: string;
  kindFilter: ResourceKind | "ALL";
  exportMode: ExportMode;
  hasSelection: boolean;
  onSearch: (value: string) => void;
  onKindFilter: (value: ResourceKind | "ALL") => void;
  onExportMode: (value: ExportMode) => void;
  onExport: () => void;
}) {
  return (
    <div id="table-toolbar">
      <span className="toolbar-label">FILTER:</span>
      <label id="search-wrap">
        <Search className="search-icon" size={12} />
        <input
          id="search-box"
          type="text"
          placeholder="SEARCH FILES..."
          value={searchText}
          onChange={(event) => onSearch(event.currentTarget.value)}
        />
      </label>
      <div className="sep" />
      {FILTERS.map((filter) => (
        <button
          key={filter}
          className={clsx("tb-btn", kindFilter === filter && "on")}
          onClick={() => onKindFilter(filter)}
        >
          {filter}
        </button>
      ))}
      <div className="sep" />
      <div className="segmented" aria-label="Export mode">
        <button
          className={clsx(exportMode === "decoded" && "on")}
          onClick={() => onExportMode("decoded")}
          title="Export decoded bytes after BFC1/SCR/RTXT transforms"
        >
          DECODED
        </button>
        <button
          className={clsx(exportMode === "raw" && "on")}
          onClick={() => onExportMode("raw")}
          title="Export exact bytes stored in the archive"
        >
          RAW
        </button>
      </div>
      <button className="tb-btn action" disabled={!hasSelection} onClick={onExport}>
        <Download size={12} />
        EXPORT
      </button>
    </div>
  );
}

function ResourceTable({
  rows,
  selectedKey,
  searchText,
  sortKey,
  sortAsc,
  onSort,
  onSelect,
}: {
  rows: Array<ResourceEntry & { rowNumber: number }>;
  selectedKey: string | null;
  searchText: string;
  sortKey: SortKey;
  sortAsc: boolean;
  onSort: (key: SortKey) => void;
  onSelect: (entry: ResourceEntry) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 24,
    overscan: 16,
  });

  return (
    <div id="table-wrap">
      <div id="tbl-head">
        <HeaderCell center onClick={() => onSort("archiveName")}>
          #
        </HeaderCell>
        <HeaderCell
          active={sortKey === "name"}
          asc={sortAsc}
          onClick={() => onSort("name")}
        >
          FILENAME
        </HeaderCell>
        <HeaderCell
          active={sortKey === "kind"}
          asc={sortAsc}
          onClick={() => onSort("kind")}
        >
          TYPE
        </HeaderCell>
        <HeaderCell
          active={sortKey === "size"}
          asc={sortAsc}
          onClick={() => onSort("size")}
        >
          SIZE
        </HeaderCell>
        <HeaderCell
          active={sortKey === "offset"}
          asc={sortAsc}
          onClick={() => onSort("offset")}
        >
          OFFSET
        </HeaderCell>
        <HeaderCell
          active={sortKey === "checksum"}
          asc={sortAsc}
          onClick={() => onSort("checksum")}
        >
          CHECKSUM
        </HeaderCell>
      </div>

      {rows.length === 0 ? (
        <div id="no-results">
          <div className="empty-icon">0</div>
          <div>NO MATCHING FILES</div>
        </div>
      ) : (
        <div id="tbl-body" ref={parentRef}>
          <div
            className="virtual-pad"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualizer.getVirtualItems().map((item) => {
              const row = rows[item.index];
              const selected = selectedKey === entryKey(row);
              return (
                <button
                  key={entryKey(row)}
                  className={clsx("tbl-row", selected && "selected")}
                  style={{ transform: `translateY(${item.start}px)` }}
                  onClick={() => onSelect(row)}
                  onDoubleClick={() => onSelect(row)}
                  title={`${row.archiveName} / ${row.name}`}
                >
                  <div className="td center dim">
                    {String(row.rowNumber).padStart(3, "0")}
                  </div>
                  <div className="td file-cell">
                    <HighlightedText text={row.name} query={searchText} />
                    <span className="src-tag">{row.archiveName}</span>
                  </div>
                  <div className="td">
                    <span className={clsx("type-pill", `tp-${row.kind}`)}>
                      {row.kind}
                    </span>
                  </div>
                  <div className="td num">{formatBytes(row.size)}</div>
                  <div className="td num">{hex32(row.offset)}</div>
                  <div className="td num">{row.checksum == null ? "-" : hex32(row.checksum)}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function HeaderCell({
  children,
  active,
  asc,
  center,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  asc?: boolean;
  center?: boolean;
  onClick: () => void;
}) {
  return (
    <button className={clsx("th", center && "center", active && "sorted")} onClick={onClick}>
      <span>{children}</span>
      <span className="th-arrow">{active ? (asc ? "▲" : "▼") : ""}</span>
    </button>
  );
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const needle = query.trim().toLowerCase();
  if (!needle) return <>{text}</>;
  const index = text.toLowerCase().indexOf(needle);
  if (index < 0) return <>{text}</>;

  return (
    <>
      {text.slice(0, index)}
      <span className="hl">{text.slice(index, index + needle.length)}</span>
      {text.slice(index + needle.length)}
    </>
  );
}

function PreviewPanel({
  entry,
  preview,
  loading,
}: {
  entry: ResourceEntry | null;
  preview: PreviewResponse | null;
  loading: boolean;
}) {
  if (!entry) {
    return (
      <div id="preview-empty">
        <FileArchive className="empty-icon" size={24} />
        <div>SELECT A RESOURCE TO PREVIEW</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div id="preview-empty">
        <div className="loader-line" />
        <div>DECODING PREVIEW</div>
      </div>
    );
  }

  if (!preview) {
    return (
      <div id="preview-empty">
        <div className="empty-icon">!</div>
        <div>NO PREVIEW DATA</div>
      </div>
    );
  }

  if (preview.status === "text" && preview.text != null) {
    const ext = entry.name.split(".").pop()?.toLowerCase() ?? "";
    const lines = preview.text.split("\n");
    return (
      <div id="preview-body" className="has-content">
        <PreviewMeta entry={entry} preview={preview} />
        {lines.map((line, index) => (
          <div className="preview-line" key={`${index}-${line}`}>
            <span className="preview-line-num">{String(index + 1).padStart(3, " ")}</span>
            <span
              dangerouslySetInnerHTML={{
                __html: syntaxHighlight(line, ext),
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div id="preview-body" className="has-content">
      <PreviewMeta entry={entry} preview={preview} />
      <div className="binary-preview">
        <div className="binary-title">{preview.message ?? "BINARY FILE"}</div>
        <pre>{preview.hexHead || "-"}</pre>
      </div>
    </div>
  );
}

function PreviewMeta({
  entry,
  preview,
}: {
  entry: ResourceEntry;
  preview: PreviewResponse;
}) {
  return (
    <div className="preview-meta">
      <span>{formatBytes(preview.byteLen)}</span>
      <span>{entry.kind}</span>
      <span>{preview.transforms.length ? preview.transforms.join(" + ") : "RAW"}</span>
    </div>
  );
}

function StatusBar({
  status,
  snapshot,
  activeArchivePath,
}: {
  status: StatusState;
  snapshot: WorkspaceSnapshot;
  activeArchivePath: string | null;
}) {
  const pkg = activeArchivePath ? basename(activeArchivePath).toUpperCase() : status.target;
  return (
    <footer id="statusbar">
      <div className="ss">
        <span>VER</span>
        <span className="sv">0.1.0</span>
      </div>
      <div className="ss">
        <div className={clsx("dot", status.label === "ERROR" && "error")} />
        <span>STATUS:</span>
        <span className="sv">{status.label}</span>
      </div>
      <div className="ss wide">
        <span>PKG:</span>
        <span className="sv truncate">{pkg || "-"}</span>
      </div>
      <div className="ss">
        <span>TOTAL:</span>
        <span className="sv">{snapshot.stats.entryCount}</span>
      </div>
      <div className="ss">
        <span>DATA:</span>
        <span className="sv">{formatBytes(snapshot.stats.totalSize)}</span>
      </div>
      {snapshot.warnings.length > 0 && (
        <div className="ss warn" title={snapshot.warnings.join("\n")}>
          <span>WARN:</span>
          <span className="sv">{snapshot.warnings.length}</span>
        </div>
      )}
      <div id="progress-area">
        <div id="prog-label">{status.progressLabel}</div>
        <div id="prog-outer">
          <div
            id="prog-inner"
            style={{ width: `${status.progress == null ? 0 : status.progress}%` }}
          />
        </div>
        <div id="prog-pct">{status.progress == null ? "-" : `${status.progress}%`}</div>
      </div>
    </footer>
  );
}

function compareRows(a: ResourceEntry, b: ResourceEntry, key: SortKey, asc: boolean) {
  let left: string | number | null = a[key];
  let right: string | number | null = b[key];

  if (key === "checksum") {
    left = a.checksum ?? -1;
    right = b.checksum ?? -1;
  }

  if (typeof left === "string") left = left.toLowerCase();
  if (typeof right === "string") right = right.toLowerCase();

  let result = 0;
  if (left == null && right != null) result = -1;
  else if (left != null && right == null) result = 1;
  else if (left != null && right != null) result = left > right ? 1 : left < right ? -1 : 0;

  if (result === 0) {
    result = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  }

  return asc ? result : -result;
}

function singlePath(value: string | string[] | null): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function entryKey(entry: Pick<ResourceEntry, "archivePath" | "tableIndex">) {
  return `${entry.archivePath}::${entry.tableIndex}`;
}

function basename(path: string) {
  return path.split(/[\\/]/).pop() || path;
}

function exportDefaultName(name: string, mode: ExportMode) {
  if (mode === "decoded" && name.toLowerCase().endsWith(".rtxt")) {
    return `${name.slice(0, -5)}.toml`;
  }
  return name;
}

function hex32(value: number) {
  return `0x${(value >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
}

function formatBytes(size: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = size;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return unit === 0 ? `${size} ${units[unit]}` : `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
}

function syntaxHighlight(line: string, ext: string) {
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

const styles = `
:root {
  --bg: #050c05;
  --panel-bg: #070e07;
  --border: #1c4a1c;
  --border-hi: #2d8a2d;
  --green: #39e839;
  --green-dim: #1e7a1e;
  --green-hi: #7fff7f;
  --green-sel: #00cc00;
  --sel-bg: #092909;
  --sel-row: #0b3d0b;
  --hover-row: #091809;
  --title: #55ff55;
  --text-dim: #255525;
  --font-mono: "Share Tech Mono", "Courier New", monospace;
  --font-vt: "VT323", "Share Tech Mono", monospace;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body,
#root {
  width: 100%;
  height: 100%;
}

body {
  margin: 0;
  overflow: hidden;
  background: var(--bg);
  color: var(--green);
  font-family: var(--font-mono);
  font-size: 13px;
  user-select: none;
}

body::after {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 9998;
  pointer-events: none;
  background: repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(0, 0, 0, 0.10) 2px, rgba(0, 0, 0, 0.10) 4px);
}

button,
input {
  font: inherit;
}

button {
  border-radius: 0;
}

#app-shell {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  background: var(--bg);
  color: var(--green);
}

#navbar {
  display: flex;
  align-items: center;
  height: 42px;
  flex-shrink: 0;
  background: #030803;
  border-bottom: 2px solid var(--border-hi);
  padding: 0 12px;
  gap: 8px;
  -webkit-app-region: drag;
  app-region: drag;
}

#navbar button,
#navbar input {
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 14px;
  background: #0a160a;
  border: 1px solid var(--border-hi);
  color: var(--green-dim);
  font-size: 11px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  cursor: pointer;
  outline: none;
  position: relative;
  transition: all 0.1s;
}

.nav-btn:hover {
  background: var(--sel-bg);
  color: var(--green-hi);
  border-color: var(--green);
  box-shadow: 0 0 8px rgba(57, 232, 57, 0.2);
}

.nav-btn::before {
  content: "";
  position: absolute;
  top: -1px;
  left: -1px;
  width: 6px;
  height: 6px;
  border: 2px solid var(--green-sel);
  border-right: none;
  border-bottom: none;
}

.nav-btn::after {
  content: "";
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 6px;
  height: 6px;
  border: 2px solid var(--green-sel);
  border-left: none;
  border-top: none;
}

#nav-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
}

#nav-title {
  font-family: var(--font-vt);
  font-size: 22px;
  letter-spacing: 5px;
  color: var(--title);
  text-transform: uppercase;
  text-shadow: 0 0 14px rgba(85, 255, 85, 0.55), 0 0 28px rgba(85, 255, 85, 0.2);
  white-space: nowrap;
}

#logo-area {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 14px;
  border-left: 1px solid var(--border);
  flex-shrink: 0;
}

#logo-mark {
  width: 30px;
  height: 30px;
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--green-hi);
  background: #050c05;
}

#logo-text {
  font-family: var(--font-vt);
  font-size: 15px;
  letter-spacing: 2px;
  color: var(--green-sel);
  text-transform: uppercase;
  line-height: 1.1;
}

#logo-text span {
  display: block;
  font-size: 9px;
  letter-spacing: 1px;
  color: var(--text-dim);
}

#win-controls {
  display: flex;
  align-items: center;
  gap: 2px;
  padding-left: 14px;
  border-left: 1px solid var(--border);
  height: 100%;
  flex-shrink: 0;
}

.win-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 26px;
  background: none;
  border: 1px solid var(--border);
  color: var(--green-dim);
  cursor: pointer;
  outline: none;
  transition: all 0.08s;
}

.win-btn:hover {
  background: rgba(57, 232, 57, 0.08);
  color: var(--green);
  border-color: var(--green-dim);
}

.win-btn.close:hover {
  background: rgba(200, 40, 40, 0.18);
  color: #ff5555;
  border-color: #aa2222;
}

#content {
  display: flex;
  flex: 1;
  overflow: hidden;
  padding: 8px;
  gap: 8px;
  min-height: 0;
}

.panel {
  background: var(--panel-bg);
  border: 1px solid var(--border-hi);
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.panel::before {
  content: "";
  position: absolute;
  top: -1px;
  left: -1px;
  width: 12px;
  height: 12px;
  border: 3px solid var(--green-sel);
  border-right: none;
  border-bottom: none;
  z-index: 2;
}

.corner-br,
.corner-tr,
.corner-bl {
  position: absolute;
  width: 12px;
  height: 12px;
  border: 3px solid var(--green-sel);
  z-index: 2;
  pointer-events: none;
}

.corner-br {
  right: -1px;
  bottom: -1px;
  border-left: none;
  border-top: none;
}

.corner-tr {
  top: -1px;
  right: -1px;
  border-left: none;
  border-bottom: none;
}

.corner-bl {
  bottom: -1px;
  left: -1px;
  border-right: none;
  border-top: none;
}

.panel-header {
  display: flex;
  align-items: center;
  height: 26px;
  background: #030a03;
  border-bottom: 1px solid var(--border-hi);
  padding: 0 10px;
  flex-shrink: 0;
  gap: 8px;
}

.panel-title {
  font-family: var(--font-vt);
  font-size: 16px;
  letter-spacing: 2px;
  color: var(--title);
  text-transform: uppercase;
  text-shadow: 0 0 8px rgba(85, 255, 85, 0.35);
}

.panel-sub {
  font-size: 10px;
  color: var(--text-dim);
  letter-spacing: 1px;
  margin-left: auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #030803;
}

::-webkit-scrollbar-thumb {
  background: var(--border-hi);
}

::-webkit-scrollbar-thumb:hover {
  background: var(--green-dim);
}

#tree-panel {
  width: 260px;
  flex-shrink: 0;
}

#tree-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.pff-node {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 30px;
  padding: 0 10px;
  background: transparent;
  color: var(--green);
  border: none;
  border-bottom: 1px solid transparent;
  cursor: pointer;
  transition: background 0.08s, color 0.08s;
  position: relative;
  text-align: left;
}

.pff-node::after {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: transparent;
  transition: background 0.1s;
}

.pff-node:hover {
  background: rgba(57, 232, 57, 0.07);
  color: var(--green-hi);
}

.pff-node:hover::after {
  background: var(--green-dim);
}

.pff-node.active {
  background: var(--sel-row);
  color: var(--green-hi);
  border-bottom-color: var(--border);
}

.pff-node.active::after {
  background: var(--green-sel);
  box-shadow: 0 0 6px var(--green-sel);
}

.pff-icon {
  color: var(--green-dim);
  flex-shrink: 0;
}

.pff-node.active .pff-icon {
  color: var(--green-hi);
}

.pff-name {
  flex: 1;
  font-size: 11px;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pff-count {
  font-size: 9px;
  color: var(--text-dim);
  letter-spacing: 0.5px;
  background: #0a1a0a;
  border: 1px solid var(--border);
  padding: 0 4px;
}

.pff-node.all-node {
  border-bottom: 1px solid var(--border);
  margin-bottom: 2px;
}

#right-col {
  flex: 1;
  display: flex;
  flex-direction: row;
  gap: 8px;
  overflow: hidden;
  min-width: 0;
}

#table-panel {
  flex: 1;
  min-width: 0;
}

#table-toolbar {
  display: flex;
  align-items: center;
  height: 32px;
  border-bottom: 1px solid var(--border);
  padding: 0 10px;
  gap: 8px;
  flex-shrink: 0;
  background: #040b04;
  overflow-x: auto;
  overflow-y: hidden;
}

.toolbar-label {
  font-size: 10px;
  letter-spacing: 1px;
  color: var(--text-dim);
  text-transform: uppercase;
  white-space: nowrap;
}

#search-wrap {
  position: relative;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

#search-box {
  background: #030803;
  border: 1px solid var(--border-hi);
  color: var(--green);
  font-size: 11px;
  padding: 1px 8px 1px 24px;
  height: 20px;
  outline: none;
  letter-spacing: 1px;
  width: 210px;
  transition: border-color 0.1s;
}

#search-box::placeholder {
  color: var(--text-dim);
}

#search-box:focus {
  border-color: var(--green-sel);
  box-shadow: 0 0 6px rgba(0, 204, 0, 0.15);
}

.search-icon {
  position: absolute;
  left: 7px;
  color: var(--text-dim);
  pointer-events: none;
}

.sep {
  width: 1px;
  height: 16px;
  background: var(--border);
  flex-shrink: 0;
}

.tb-btn,
.segmented button {
  background: none;
  border: 1px solid var(--border);
  color: var(--green-dim);
  font-size: 10px;
  letter-spacing: 1px;
  text-transform: uppercase;
  padding: 0 8px;
  height: 20px;
  cursor: pointer;
  outline: none;
  transition: all 0.08s;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}

.tb-btn:hover,
.segmented button:hover {
  border-color: var(--green-sel);
  color: var(--green);
  background: rgba(57, 232, 57, 0.05);
}

.tb-btn.on,
.segmented button.on {
  border-color: var(--green);
  color: var(--green-hi);
  background: var(--sel-bg);
}

.tb-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.tb-btn:disabled:hover {
  background: none;
  border-color: var(--border);
  color: var(--green-dim);
}

.segmented {
  display: flex;
  align-items: center;
  height: 20px;
}

.segmented button + button {
  margin-left: -1px;
}

#table-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

#tbl-head,
.tbl-row {
  display: grid;
  grid-template-columns: 44px minmax(220px, 1fr) 68px 88px 108px 118px;
}

#tbl-head {
  height: 24px;
  background: #030a03;
  border-bottom: 2px solid var(--border-hi);
  flex-shrink: 0;
}

.th {
  display: flex;
  align-items: center;
  padding: 0 8px;
  font-size: 10px;
  letter-spacing: 1.5px;
  color: var(--green-sel);
  text-transform: uppercase;
  border: none;
  border-right: 1px solid var(--border);
  background: transparent;
  cursor: pointer;
  gap: 4px;
  transition: background 0.08s;
}

.th:last-child {
  border-right: none;
}

.th:hover {
  background: rgba(57, 232, 57, 0.04);
  color: var(--green-hi);
}

.th.center {
  justify-content: center;
}

.th.sorted {
  color: var(--green-hi);
}

.th-arrow {
  font-size: 8px;
  color: var(--text-dim);
  min-width: 8px;
}

#tbl-body {
  flex: 1;
  overflow: auto;
  position: relative;
  min-height: 0;
}

.virtual-pad {
  position: relative;
  width: 100%;
}

.tbl-row {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  height: 24px;
  min-height: 24px;
  align-items: stretch;
  padding: 0;
  border: none;
  border-bottom: 1px solid #0a1a0a;
  background: transparent;
  color: var(--green);
  cursor: pointer;
  transition: background 0.06s;
  text-align: left;
}

.tbl-row:hover {
  background: var(--hover-row);
}

.tbl-row:hover .td {
  color: var(--green);
}

.tbl-row.selected {
  background: var(--sel-row);
}

.tbl-row.selected .td {
  color: var(--green-hi);
}

.td {
  display: flex;
  align-items: center;
  align-self: stretch;
  height: 100%;
  line-height: 1;
  padding: 0 8px;
  font-size: 11px;
  letter-spacing: 0.5px;
  border-right: 1px solid #0d200d;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--green);
  min-width: 0;
}

.td:last-child {
  border-right: none;
}

.td.dim {
  color: var(--text-dim);
  font-size: 10px;
}

.td.num {
  color: var(--green-dim);
  font-size: 10px;
  letter-spacing: 0;
  font-variant-numeric: tabular-nums;
}

.td.center {
  justify-content: center;
}

.file-cell {
  gap: 4px;
}

.type-pill {
  font-size: 9px;
  padding: 0 5px;
  height: 14px;
  display: flex;
  align-items: center;
  border: 1px solid;
  letter-spacing: 1px;
}

.tp-TEX { border-color: #1a5a2a; color: #4aaa6a; }
.tp-SND { border-color: #1a3a5a; color: #4a8aba; }
.tp-MDL { border-color: #4a3a1a; color: #ba8a4a; }
.tp-SHD { border-color: #3a1a4a; color: #9a5aaa; }
.tp-CFG { border-color: #3a2a1a; color: #aa7a4a; }
.tp-DAT { border-color: #333333; color: #888888; }

.src-tag {
  font-size: 9px;
  padding: 0 4px;
  border: 1px solid var(--border);
  color: var(--text-dim);
  margin-left: 4px;
  flex-shrink: 0;
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
}

#no-results,
.empty-state,
#preview-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: var(--text-dim);
  font-size: 11px;
  letter-spacing: 2px;
  text-transform: uppercase;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}

.empty-state.compact {
  padding: 28px 8px;
  text-align: center;
}

.empty-icon {
  opacity: 0.35;
}

#preview-panel {
  width: 330px;
  flex-shrink: 0;
}

#preview-body {
  flex: 1;
  overflow: auto;
  padding: 8px 12px;
  font-size: 11px;
  line-height: 1.6;
  letter-spacing: 0.3px;
  color: var(--green-dim);
}

#preview-body.has-content {
  color: var(--green);
}

.preview-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-bottom: 8px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

.preview-meta span {
  font-size: 9px;
  color: var(--green-dim);
  border: 1px solid var(--border);
  padding: 0 5px;
  letter-spacing: 1px;
}

.preview-line {
  white-space: pre-wrap;
  word-break: break-all;
}

.preview-line-num {
  color: var(--text-dim);
  user-select: none;
  margin-right: 12px;
  font-size: 10px;
  display: inline-block;
  min-width: 24px;
  text-align: right;
}

.preview-keyword { color: var(--green-hi); }
.preview-string { color: #6aee6a; }
.preview-comment { color: var(--text-dim); font-style: italic; }
.preview-tag { color: #4aaa7a; }
.preview-attr { color: #aa8a4a; }

.binary-preview {
  color: var(--green-dim);
}

.binary-title {
  margin-bottom: 8px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.binary-preview pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--green);
}

.loader-line {
  width: 120px;
  height: 8px;
  border: 1px solid var(--border-hi);
  background: repeating-linear-gradient(90deg, var(--green-sel) 0px, var(--green-sel) 5px, #004000 5px, #004000 7px);
  animation: prog-scroll 0.6s linear infinite;
}

#statusbar {
  display: flex;
  align-items: center;
  height: 26px;
  flex-shrink: 0;
  background: #030803;
  border-top: 2px solid var(--border-hi);
  padding: 0 12px;
  gap: 0;
  min-width: 0;
}

.ss {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0 12px;
  border-right: 1px solid var(--border);
  height: 100%;
  font-size: 10px;
  letter-spacing: 1px;
  color: var(--text-dim);
  text-transform: uppercase;
  white-space: nowrap;
  min-width: 0;
}

.ss:first-child {
  padding-left: 0;
}

.ss:last-child {
  border-right: none;
}

.ss.wide {
  max-width: 280px;
}

.ss.warn .sv {
  color: #d6b34a;
}

.sv {
  color: var(--green-sel);
}

.truncate {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--green-sel);
  box-shadow: 0 0 5px var(--green-sel);
  animation: pulse 2s ease-in-out infinite;
}

.dot.error {
  background: #ff5555;
  box-shadow: 0 0 5px #ff5555;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

#progress-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 160px;
}

#prog-label {
  font-size: 10px;
  letter-spacing: 1px;
  color: var(--text-dim);
  text-transform: uppercase;
}

#prog-outer {
  width: 160px;
  height: 8px;
  background: #030803;
  border: 1px solid var(--border-hi);
  overflow: hidden;
}

#prog-inner {
  height: 100%;
  width: 0%;
  background: repeating-linear-gradient(90deg, var(--green-sel) 0px, var(--green-sel) 5px, #004000 5px, #004000 7px);
  background-size: 7px 100%;
  transition: width 0.4s ease;
  animation: prog-scroll 0.6s linear infinite;
}

@keyframes prog-scroll {
  from { background-position: 0 0; }
  to { background-position: 7px 0; }
}

#prog-pct {
  font-size: 10px;
  color: var(--green-dim);
  min-width: 32px;
  text-align: right;
  letter-spacing: 1px;
}

.hl {
  background: rgba(57, 232, 57, 0.15);
  color: var(--green-hi);
}

@media (max-width: 1100px) {
  #tree-panel {
    width: 220px;
  }

  #preview-panel {
    width: 300px;
  }

  #nav-title {
    font-size: 18px;
    letter-spacing: 3px;
  }

  #logo-area {
    display: none;
  }
}
`;

export default App;
