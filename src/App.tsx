import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  currentMonitor,
  getCurrentWindow,
  PhysicalPosition,
  PhysicalSize,
  primaryMonitor,
} from "@tauri-apps/api/window";
import { message, open, save } from "@tauri-apps/plugin-dialog";
import { PackageTree } from "@/components/PackageTree";
import { Panel } from "@/components/Panel";
import { PreviewPanel } from "@/components/PreviewPanel";
import { ResourceTable } from "@/components/ResourceTable";
import { ResourceToolbar } from "@/components/ResourceToolbar";
import { StatusBar } from "@/components/StatusBar";
import { TitleBar } from "@/components/TitleBar";
import {
  basename,
  compareRows,
  entryKey,
  fileExtensionLabel,
} from "@/lib/format";
import type {
  AppConfig,
  ExportResult,
  PreviewResponse,
  SortKey,
  StatusState,
  WorkspaceSnapshot,
} from "@/types";
import { css } from "@emotion/css";
import "@/assets/styles/global.css";

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

type LoadOpenedPffPathsOptions = {
  progressTarget: string;
  readyTarget: string;
  persist: boolean;
};

function App() {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>(EMPTY_SNAPSHOT);
  const [activeArchivePath, setActiveArchivePath] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [status, setStatus] = useState<StatusState>({
    label: "READY",
    target: "-",
    progressLabel: "IDLE",
    progress: null,
  });

  useEffect(() => {
    void fitWindowToWorkArea();
    void restoreSavedWorkspace();
  }, []);

  const selectedEntry = useMemo(() => {
    if (!selectedKey) return null;
    return snapshot.entries.find((entry) => entryKey(entry) === selectedKey) ?? null;
  }, [selectedKey, snapshot.entries]);

  const visibleRows = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const formatSet = new Set(selectedFormats);
    const source =
      query.length > 0 || activeArchivePath === null
        ? snapshot.entries
        : snapshot.entries.filter((entry) => entry.archivePath === activeArchivePath);

    const rows = source
      .filter((entry) => {
        if (formatSet.size > 0 && !formatSet.has(fileExtensionLabel(entry.name))) {
          return false;
        }

        if (!query) return true;
        return (
          entry.name.toLowerCase().includes(query) ||
          entry.archiveName.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => compareRows(a, b, sortKey, sortAsc));

    return rows.map((entry, index) => ({ ...entry, rowNumber: index + 1 }));
  }, [activeArchivePath, searchText, selectedFormats, snapshot.entries, sortAsc, sortKey]);

  const availableFormats = useMemo(() => {
    const formats = new Set<string>();
    for (const entry of snapshot.entries) {
      formats.add(fileExtensionLabel(entry.name));
    }

    return Array.from(formats).sort((a, b) => a.localeCompare(b));
  }, [snapshot.entries]);

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
            image: null,
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

    try {
      const projectPaths = await invoke<string[]>("scan_pff_project", { path });
      if (projectPaths.length === 0) {
        await message("No PFF files were found in this project directory.", {
          title: "Open project",
          kind: "info",
        });
        return;
      }

      await loadOpenedPffPaths([...openedArchivePaths(), ...projectPaths], {
        progressTarget: basename(path),
        readyTarget: "ALL PACKAGES",
        persist: true,
      });
    } catch (error) {
      setStatus({
        label: "ERROR",
        target: basename(path),
        progressLabel: "IDLE",
        progress: null,
      });
      await message(String(error), { title: "Project scan failed", kind: "error" });
    }
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

    await loadOpenedPffPaths([...openedArchivePaths(), path], {
      progressTarget: basename(path),
      readyTarget: basename(path),
      persist: true,
    });
  }

  async function restoreSavedWorkspace() {
    try {
      const config = await invoke<AppConfig>("load_app_config");
      const paths = uniquePaths(config.openedPffPaths ?? []);
      if (paths.length === 0) return;

      await loadOpenedPffPaths(paths, {
        progressTarget: "SAVED PACKAGES",
        readyTarget: "SAVED PACKAGES",
        persist: false,
      });
    } catch (error) {
      console.error("Config restore failed", error);
      await message(String(error), { title: "Config restore failed", kind: "warning" });
    }
  }

  async function loadOpenedPffPaths(paths: string[], options: LoadOpenedPffPathsOptions) {
    const nextPaths = uniquePaths(paths);

    if (nextPaths.length === 0) {
      setSnapshot(EMPTY_SNAPSHOT);
      setActiveArchivePath(null);
      setSelectedKey(null);
      setPreview(null);
      setPreviewLoading(false);
      if (options.persist) {
        await persistOpenedPffPaths([]);
      }
      setStatus({
        label: "READY",
        target: "-",
        progressLabel: "IDLE",
        progress: null,
      });
      return;
    }

    setStatus({
      label: "SCANNING",
      target: options.progressTarget,
      progressLabel: "PFF LOAD",
      progress: 8,
    });

    const progressTimer = window.setInterval(() => {
      setStatus((current) => {
        if (current.progress == null) return current;

        const step = current.progress < 55 ? 7 : 3;
        return {
          ...current,
          progress: Math.min(current.progress + step, 95),
        };
      });
    }, 180);

    try {
      const next = await invoke<WorkspaceSnapshot>("load_pff_paths", { paths: nextPaths });
      const loadedPathSet = new Set(next.archives.map((archive) => archive.path));
      const loadedEntryKeySet = new Set(next.entries.map((entry) => entryKey(entry)));

      setSnapshot(next);
      setActiveArchivePath((current) => (current && loadedPathSet.has(current) ? current : null));
      setSelectedKey((current) => (current && loadedEntryKeySet.has(current) ? current : null));
      setPreview(null);
      setPreviewLoading(false);

      if (options.persist) {
        await persistOpenedPffPaths(next.archives.map((archive) => archive.path));
      }

      setStatus({
        label: next.warnings.length ? "READY WITH WARNINGS" : "READY",
        target: options.readyTarget,
        progressLabel: "IDLE",
        progress: null,
      });
    } catch (error) {
      setStatus({
        label: "ERROR",
        target: options.progressTarget,
        progressLabel: "IDLE",
        progress: null,
      });
      await message(String(error), { title: "PFF load failed", kind: "error" });
    } finally {
      window.clearInterval(progressTimer);
    }
  }

  async function persistOpenedPffPaths(paths: string[]) {
    const config: AppConfig = {
      openedPffPaths: uniquePaths(paths),
    };

    try {
      await invoke("save_app_config", { config });
    } catch (error) {
      console.error("Config save failed", error);
      await message(String(error), { title: "Config save failed", kind: "warning" });
    }
  }

  async function closeArchive(path: string) {
    await loadOpenedPffPaths(
      openedArchivePaths().filter((archivePath) => archivePath !== path),
      {
        progressTarget: basename(path),
        readyTarget: "ALL PACKAGES",
        persist: true,
      },
    );
  }

  function openedArchivePaths() {
    return snapshot.archives.map((archive) => archive.path);
  }

  function selectArchive(path: string | null) {
    setActiveArchivePath(path);
    setSelectedKey(null);
    setPreview(null);
    setStatus({
      label: "LOADED",
      target: path ? basename(path).toUpperCase() : "ALL PACKAGES",
      progressLabel: "IDLE",
      progress: null,
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

  function selectResource(nextKey: string) {
    setSelectedKey((current) => (current === nextKey ? null : nextKey));
  }

  function toggleFormat(format: string) {
    setSelectedFormats((current) => {
      if (current.includes(format)) {
        return current.filter((item) => item !== format);
      }

      return [...current, format].sort((a, b) => a.localeCompare(b));
    });
    setSelectedKey(null);
    setPreview(null);
  }

  function clearFormats() {
    setSelectedFormats([]);
    setSelectedKey(null);
    setPreview(null);
  }

  async function exportSelected() {
    if (!selectedEntry) return;

    const outputPath = await save({
      title: "Export RAW resource",
      defaultPath: selectedEntry.name,
    });
    if (!outputPath) return;

    setStatus({
      label: "EXPORTING",
      target: selectedEntry.name,
      progressLabel: "IDLE",
      progress: null,
    });

    try {
      const result = await invoke<ExportResult>("export_entry", {
        request: {
          archivePath: selectedEntry.archivePath,
          entryIndex: selectedEntry.tableIndex,
          outputPath,
          mode: "raw",
        },
      });
      setStatus({
        label: "READY",
        target: basename(result.outputPath),
        progressLabel: "IDLE",
        progress: null,
      });
    } catch (error) {
      setStatus({
        label: "ERROR",
        target: selectedEntry.name,
        progressLabel: "IDLE",
        progress: null,
      });
      await message(String(error), { title: "Export failed", kind: "error" });
    }
  }

  async function minimizeWindow() {
    await runWindowAction(() => getCurrentWindow().minimize());
  }

  async function closeWindow() {
    await runWindowAction(() => getCurrentWindow().close());
  }

  return (
    <main className={appShellClass}>
      <TitleBar
        onOpenProject={openProject}
        onOpenFile={openFile}
        onMinimize={minimizeWindow}
        onClose={closeWindow}
      />

      <div className={contentClass}>
        <Panel id="tree-panel" title="PACKAGES" sub={`${snapshot.archives.length} PFF`}>
          <PackageTree
            archives={snapshot.archives}
            allCount={snapshot.entries.length}
            activeArchivePath={activeArchivePath}
            onSelect={selectArchive}
            onCloseArchive={closeArchive}
          />
        </Panel>

        <div className={rightColumnClass}>
          <Panel id="table-panel" title="RESOURCE FILES" sub={`${visibleRows.length} FILES`}>
            <ResourceToolbar
              searchText={searchText}
              formatOptions={availableFormats}
              selectedFormats={selectedFormats}
              hasSelection={Boolean(selectedEntry)}
              onSearch={setSearchText}
              onToggleFormat={toggleFormat}
              onClearFormats={clearFormats}
              onExport={exportSelected}
            />
            <ResourceTable
              rows={visibleRows}
              selectedKey={selectedKey}
              searchText={searchText}
              sortKey={sortKey}
              sortAsc={sortAsc}
              showArchiveColumn={activeArchivePath === null}
              onSort={changeSort}
              onSelect={(entry) => selectResource(entryKey(entry))}
            />
          </Panel>

          {selectedEntry && (
            <Panel id="preview-panel" title="FILE PREVIEW" sub={selectedEntry.name}>
              <PreviewPanel entry={selectedEntry} preview={preview} loading={previewLoading} />
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

async function runWindowAction(action: () => Promise<void>) {
  try {
    await action();
  } catch (error) {
    console.error("Window action failed", error);
  }
}

async function fitWindowToWorkArea() {
  const appWindow = getCurrentWindow();

  try {
    const monitor = (await currentMonitor()) ?? (await primaryMonitor());
    if (!monitor) return;

    const workArea = monitor.workArea;
    await appWindow.setPosition(
      new PhysicalPosition(workArea.position.x, workArea.position.y),
    );
    await appWindow.setSize(new PhysicalSize(workArea.size.width, workArea.size.height));
  } catch (error) {
    console.error("Window sizing failed", error);
  } finally {
    try {
      await appWindow.show();
    } catch (error) {
      console.error("Window show failed", error);
    }
  }
}

function singlePath(value: string | string[] | null): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function uniquePaths(paths: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const path of paths) {
    if (!path || seen.has(path)) continue;
    seen.add(path);
    unique.push(path);
  }

  return unique;
}

const appShellClass = css`
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  background: var(--bg);
  color: var(--green);
`;

const contentClass = css`
  display: flex;
  flex: 1;
  overflow: hidden;
  padding: 8px;
  gap: 8px;
  min-height: 0;

  #tree-panel {
    width: 260px;
    flex-shrink: 0;
  }

  @media (max-width: 1100px) {
    #tree-panel {
      width: 220px;
    }
  }
`;

const rightColumnClass = css`
  flex: 1;
  display: flex;
  flex-direction: row;
  gap: 8px;
  overflow: hidden;
  min-width: 0;

  #table-panel {
    flex: 1;
    min-width: 0;
  }

  #preview-panel {
    width: 550px;
    flex-shrink: 0;
  }

  @media (max-width: 1100px) {
    #preview-panel {
      width: 550px;
    }
  }
`;

export default App;
