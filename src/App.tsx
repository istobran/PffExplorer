import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  currentMonitor,
  cursorPosition,
  getCurrentWindow,
  monitorFromPoint,
  PhysicalPosition,
  PhysicalSize,
  primaryMonitor,
  type Monitor,
} from "@tauri-apps/api/window";
import { join } from "@tauri-apps/api/path";
import { message, open, save } from "@tauri-apps/plugin-dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PackageTree } from "@/components/PackageTree";
import { Panel } from "@/components/Panel";
import { PreviewPanel } from "@/components/PreviewPanel";
import {
  ResourceTable,
  type ResourceSelectionMode,
} from "@/components/ResourceTable";
import { ResourceToolbar } from "@/components/ResourceToolbar";
import { StatusBar } from "@/components/StatusBar";
import { TitleBar } from "@/components/TitleBar";
import {
  basename,
  compareRows,
  entryKey,
  fileExtensionLabel,
} from "@/lib/format";
import {
  DEFAULT_LOCALE,
  I18nProvider,
  isLocale,
  translate,
  type Locale,
  type TranslationKey,
  type TranslationParams,
} from "@/lib/i18n";
import {
  DF1_MENU_SLIDE_DURATION_MS,
  isBackgroundMusicEnabled,
  isSoundMuted,
  playMenuButton,
  playUiPress,
  playWhoosh,
  preloadDf1MenuSounds,
  setBackgroundMusicEnabled,
  setSoundMuted,
  startDf1MenuMusic,
} from "@/lib/sounds";
import {
  isPlainAppShortcut,
  isSelectAllResourcesShortcut,
  shouldBlockWebViewShortcut,
  shouldBlockWebViewZoomShortcut,
} from "@/lib/shortcutPolicy";
import type {
  AppConfig,
  ExportResult,
  PreviewResponse,
  ResourceTableRow,
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

type ConfirmDialogState = {
  title: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  closing: boolean;
  resolve: (accepted: boolean) => void;
};

const CONFIRM_DIALOG_EXIT_MS = 360;

function App() {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>(EMPTY_SNAPSHOT);
  const [activeArchivePath, setActiveArchivePath] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [selectionAnchorKey, setSelectionAnchorKey] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmDialogState, setConfirmDialogState] =
    useState<ConfirmDialogState | null>(null);
  const [resourceFilesSlideKey, setResourceFilesSlideKey] = useState(0);
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const [soundMuted, setSoundMutedState] = useState(() => isSoundMuted());
  const [backgroundMusicEnabled, setBackgroundMusicEnabledState] = useState(() =>
    isBackgroundMusicEnabled(),
  );
  const [status, setStatus] = useState<StatusState>({
    label: "READY",
    target: "-",
    progressLabel: "IDLE",
    progress: null,
  });
  const t = (key: TranslationKey, params?: TranslationParams) =>
    translate(locale, key, params);

  useEffect(() => {
    void fitWindowToWorkArea();
    void restoreSavedWorkspace();
  }, []);

  useEffect(() => {
    preloadDf1MenuSounds();
    startDf1MenuMusic();
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const selectedEntry = useMemo(() => {
    if (!focusedKey) return null;
    return snapshot.entries.find((entry) => entryKey(entry) === focusedKey) ?? null;
  }, [focusedKey, snapshot.entries]);

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

  const selectedRows = useMemo(
    () => visibleRows.filter((row) => selectedKeys.has(entryKey(row))),
    [selectedKeys, visibleRows],
  );

  useEffect(() => {
    function handleGlobalBrowserShortcuts(event: globalThis.KeyboardEvent) {
      if (!shouldBlockWebViewShortcut(event)) return;

      event.preventDefault();
      event.stopPropagation();
    }

    function handleGlobalBrowserZoom(event: WheelEvent) {
      if (!shouldBlockWebViewZoomShortcut(event)) return;

      event.preventDefault();
      event.stopPropagation();
    }

    window.addEventListener("keydown", handleGlobalBrowserShortcuts, true);
    window.addEventListener("wheel", handleGlobalBrowserZoom, { capture: true, passive: false });

    return () => {
      window.removeEventListener("keydown", handleGlobalBrowserShortcuts, true);
      window.removeEventListener("wheel", handleGlobalBrowserZoom, true);
    };
  }, []);

  useEffect(() => {
    function handleGlobalSelectAll(event: globalThis.KeyboardEvent) {
      if (!isSelectAllResourcesShortcut(event)) return;

      event.preventDefault();
      event.stopPropagation();

      if (event.repeat || visibleRows.length === 0) return;
      selectAllVisibleResources();
    }

    window.addEventListener("keydown", handleGlobalSelectAll, true);
    return () => window.removeEventListener("keydown", handleGlobalSelectAll, true);
  }, [focusedKey, selectedKeys, visibleRows]);

  useEffect(() => {
    function handleGlobalTitleBarShortcuts(event: globalThis.KeyboardEvent) {
      if (!isPlainAppShortcut(event, ["b", "m", "l"])) return;

      const key = event.key.toLowerCase();

      event.preventDefault();
      event.stopPropagation();

      if (key === "b") {
        toggleBackgroundMusic();
      } else if (key === "m") {
        toggleSoundMuted();
      } else {
        toggleLocale();
      }
    }

    window.addEventListener("keydown", handleGlobalTitleBarShortcuts, true);
    return () => window.removeEventListener("keydown", handleGlobalTitleBarShortcuts, true);
  }, [backgroundMusicEnabled, locale, soundMuted]);

  useEffect(() => {
    const visibleKeySet = new Set(visibleRows.map((row) => entryKey(row)));

    setSelectedKeys((current) => {
      const next = new Set([...current].filter((key) => visibleKeySet.has(key)));
      return areSetsEqual(current, next) ? current : next;
    });
    setFocusedKey((current) => (current && visibleKeySet.has(current) ? current : null));
    setSelectionAnchorKey((current) =>
      current && visibleKeySet.has(current) ? current : null,
    );
  }, [visibleRows]);

  useEffect(() => {
    if (!selectedEntry) {
      setPreview(null);
      setPreviewLoading(false);
      return;
    }

    let cancelled = false;
    let frameId = 0;
    let timerId = 0;
    setPreview(null);
    setPreviewLoading(true);

    frameId = window.requestAnimationFrame(() => {
      timerId = window.setTimeout(() => {
        if (cancelled) return;

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
                audio: null,
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
      }, 0);
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timerId);
    };
  }, [selectedEntry]);

  async function openProject() {
    const selected = await open({
      directory: true,
      multiple: false,
      title: t("system.openProject.title"),
    });
    const path = singlePath(selected);
    if (!path) return;

    try {
      const projectPaths = await invoke<string[]>("scan_pff_project", { path });
      if (projectPaths.length === 0) {
        await message(t("system.openProject.empty"), {
          title: t("system.openProject.messageTitle"),
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
      await message(String(error), { title: t("system.openProject.failed"), kind: "error" });
    }
  }

  async function openFile() {
    const selected = await open({
      directory: false,
      multiple: false,
      title: t("system.openFile.title"),
      filters: [{ name: t("system.openFile.filter"), extensions: ["pff"] }],
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
      setLocale(isLocale(config.locale) ? config.locale : DEFAULT_LOCALE);

      const paths = uniquePaths(config.openedPffPaths ?? []);
      if (paths.length === 0) return;

      await loadOpenedPffPaths(paths, {
        progressTarget: "SAVED PACKAGES",
        readyTarget: "SAVED PACKAGES",
        persist: false,
      });
    } catch (error) {
      console.error("Config restore failed", error);
      await message(String(error), { title: t("system.configRestoreFailed"), kind: "warning" });
    }
  }

  async function loadOpenedPffPaths(paths: string[], options: LoadOpenedPffPathsOptions) {
    const nextPaths = uniquePaths(paths);

    if (nextPaths.length === 0) {
      setSnapshot(EMPTY_SNAPSHOT);
      setActiveArchivePath(null);
      clearResourceSelection();
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
      setSelectedKeys((current) => {
        const retained = new Set([...current].filter((key) => loadedEntryKeySet.has(key)));
        return areSetsEqual(current, retained) ? current : retained;
      });
      setFocusedKey((current) => (current && loadedEntryKeySet.has(current) ? current : null));
      setSelectionAnchorKey((current) =>
        current && loadedEntryKeySet.has(current) ? current : null,
      );
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
      await message(String(error), { title: t("system.pffLoadFailed"), kind: "error" });
    } finally {
      window.clearInterval(progressTimer);
    }
  }

  async function persistOpenedPffPaths(paths: string[], nextLocale = locale) {
    const config: AppConfig = {
      openedPffPaths: uniquePaths(paths),
      locale: nextLocale,
    };

    try {
      await invoke("save_app_config", { config });
    } catch (error) {
      console.error("Config save failed", error);
      await message(String(error), { title: t("system.configSaveFailed"), kind: "warning" });
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

  async function closeAllArchives() {
    if (snapshot.archives.length === 0) return;

    await loadOpenedPffPaths([], {
      progressTarget: "ALL PACKAGES",
      readyTarget: "ALL PACKAGES",
      persist: true,
    });
  }

  function openedArchivePaths() {
    return snapshot.archives.map((archive) => archive.path);
  }

  function selectArchive(path: string | null) {
    if (path !== activeArchivePath) {
      playMenuButton();
      playWhoosh();
      setResourceFilesSlideKey((key) => key + 1);
    }

    setActiveArchivePath(path);
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

  function selectResource(row: ResourceTableRow, mode: ResourceSelectionMode) {
    const nextKey = entryKey(row);

    if (mode === "range") {
      selectResourceRange(nextKey);
      return;
    }

    if (mode === "toggle") {
      toggleResourceSelection(nextKey);
      return;
    }

    if (selectedKeys.size === 1 && selectedKeys.has(nextKey)) {
      clearResourceSelection();
      return;
    }

    playResourceSelectionSound();
    setSelectedKeys(new Set([nextKey]));
    setSelectionAnchorKey(nextKey);
    focusResource(nextKey);
  }

  function toggleResourceSelection(nextKey: string) {
    const nextSelectedKeys = new Set(selectedKeys);
    const wasSelected = nextSelectedKeys.has(nextKey);

    if (wasSelected) {
      nextSelectedKeys.delete(nextKey);
    } else {
      nextSelectedKeys.add(nextKey);
    }

    playResourceSelectionSound();
    setSelectedKeys(nextSelectedKeys);
    setSelectionAnchorKey(nextSelectedKeys.size === 0 ? null : nextKey);

    if (!wasSelected) {
      focusResource(nextKey);
      return;
    }

    if (focusedKey === nextKey) {
      focusResource(firstSelectedVisibleKey(nextSelectedKeys));
    }
  }

  function selectResourceRange(targetKey: string) {
    const anchorKey = visibleAnchorKey(targetKey);
    const anchorIndex = visibleRows.findIndex((row) => entryKey(row) === anchorKey);
    const targetIndex = visibleRows.findIndex((row) => entryKey(row) === targetKey);
    if (anchorIndex < 0 || targetIndex < 0) return;

    playResourceSelectionSound();
    setSelectedKeys(new Set(resourceRangeKeys(anchorIndex, targetIndex)));
    setSelectionAnchorKey(anchorKey);
    focusResource(targetKey);
  }

  function dragSelectResources(startIndex: number, endIndex: number, committed: boolean) {
    const anchorRow = visibleRows[startIndex];
    const focusRow = visibleRows[endIndex];
    if (!anchorRow || !focusRow) return;

    setSelectedKeys(new Set(resourceRangeKeys(startIndex, endIndex)));
    setSelectionAnchorKey(entryKey(anchorRow));

    if (committed) {
      playResourceSelectionSound();
      focusResource(entryKey(focusRow));
    }
  }

  function selectAllVisibleResources() {
    const firstVisibleRow = visibleRows[0];
    if (!firstVisibleRow) return;

    const visibleKeys = visibleRows.map((row) => entryKey(row));
    const nextAnchorKey =
      focusedKey && visibleKeys.includes(focusedKey)
        ? focusedKey
        : entryKey(firstVisibleRow);

    playResourceSelectionSound();
    setSelectedKeys(new Set(visibleKeys));
    setSelectionAnchorKey(nextAnchorKey);
  }

  function resourceRangeKeys(startIndex: number, endIndex: number) {
    const lower = Math.min(startIndex, endIndex);
    const upper = Math.max(startIndex, endIndex);
    return visibleRows.slice(lower, upper + 1).map((row) => entryKey(row));
  }

  function visibleAnchorKey(fallbackKey: string) {
    if (
      selectionAnchorKey &&
      visibleRows.some((row) => entryKey(row) === selectionAnchorKey)
    ) {
      return selectionAnchorKey;
    }

    if (focusedKey && visibleRows.some((row) => entryKey(row) === focusedKey)) {
      return focusedKey;
    }

    return fallbackKey;
  }

  function firstSelectedVisibleKey(keys: ReadonlySet<string>) {
    const firstSelectedRow = visibleRows.find((row) => keys.has(entryKey(row)));
    return firstSelectedRow ? entryKey(firstSelectedRow) : null;
  }

  function focusResource(nextKey: string | null) {
    if (focusedKey !== nextKey) {
      setPreview(null);
      setPreviewLoading(Boolean(nextKey));
    }

    setFocusedKey(nextKey);
  }

  function clearResourceSelection() {
    setSelectedKeys(new Set());
    setSelectionAnchorKey(null);
    focusResource(null);
  }

  function playResourceSelectionSound() {
    if (selectedKeys.size === 0) {
      playMenuButton();
      playWhoosh();
    } else {
      playUiPress();
    }
  }

  function toggleFormat(format: string) {
    setSelectedFormats((current) => {
      if (current.includes(format)) {
        return current.filter((item) => item !== format);
      }

      return [...current, format].sort((a, b) => a.localeCompare(b));
    });
  }

  function clearFormats() {
    setSelectedFormats([]);
  }

  async function exportSelected() {
    if (exporting) return;
    if (selectedRows.length === 0) return;

    if (selectedRows.length === 1) {
      await exportSingleResource(selectedRows[0]);
      return;
    }

    await exportSelectedResources(selectedRows);
  }

  async function exportSingleResource(entry: ResourceTableRow) {
    const outputPath = await save({
      title: t("system.exportSingle.title"),
      defaultPath: entry.name,
    });
    if (!outputPath) return;

    setExporting(true);
    setStatus({
      label: "EXPORTING",
      target: entry.name,
      progressLabel: "IDLE",
      progress: null,
    });

    try {
      const result = await invoke<ExportResult>("export_entry", {
        request: {
          archivePath: entry.archivePath,
          entryIndex: entry.tableIndex,
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
        target: entry.name,
        progressLabel: "IDLE",
        progress: null,
      });
      await message(String(error), { title: t("system.exportFailed"), kind: "error" });
    } finally {
      setExporting(false);
    }
  }

  async function exportSelectedResources(entries: ResourceTableRow[]) {
    const selected = await open({
      directory: true,
      multiple: false,
      title: t("system.exportBatch.title", { count: entries.length }),
    });
    const outputDirectory = singlePath(selected);
    if (!outputDirectory) return;

    const archiveCount = new Set(entries.map((entry) => entry.archivePath)).size;
    const groupByPackage = activeArchivePath === null || archiveCount > 1;

    if (groupByPackage) {
      const accepted = await showConfirmDialog({
        title: t("dialog.batchExport.title"),
        message: t("dialog.batchExport.message"),
        detail: outputDirectory,
        confirmLabel: t("dialog.batchExport.confirm"),
        cancelLabel: t("dialog.cancel"),
      });
      if (!accepted) return;
    }

    const usedOutputPaths = new Set<string>();
    const failures: string[] = [];
    let exportedCount = 0;

    setExporting(true);
    setStatus({
      label: "EXPORTING",
      target: `0/${entries.length}`,
      progressLabel: "EXPORT",
      progress: 0,
    });

    try {
      for (const [index, entry] of entries.entries()) {
        try {
          const outputPath = await buildUniqueBatchExportPath(
            outputDirectory,
            entry,
            groupByPackage,
            usedOutputPaths,
          );
          await invoke<ExportResult>("export_entry", {
            request: {
              archivePath: entry.archivePath,
              entryIndex: entry.tableIndex,
              outputPath,
              mode: "raw",
            },
          });
          exportedCount += 1;
        } catch (error) {
          failures.push(`${entry.archiveName} / ${entry.name}: ${String(error)}`);
        }

        setStatus({
          label: "EXPORTING",
          target: `${index + 1}/${entries.length}`,
          progressLabel: "EXPORT",
          progress: Math.round(((index + 1) / entries.length) * 100),
        });
      }

      const hasFailures = failures.length > 0;
      setStatus({
        label: hasFailures
          ? exportedCount > 0
            ? "READY WITH ERRORS"
            : "ERROR"
          : "READY",
        target: t("app.exportedCount", { exported: exportedCount, total: entries.length }),
        progressLabel: "IDLE",
        progress: null,
      });

      if (hasFailures) {
        const shownFailures = failures.slice(0, 10).join("\n");
        const hiddenCount = Math.max(0, failures.length - 10);
        await message(
          [
            t("system.exportErrors.summary", {
              exported: exportedCount,
              total: entries.length,
            }),
            "",
            shownFailures,
            hiddenCount > 0 ? t("system.exportErrors.more", { count: hiddenCount }) : "",
          ]
            .filter(Boolean)
            .join("\n"),
          { title: t("system.exportErrors.title"), kind: "warning" },
        );
      }
    } finally {
      setExporting(false);
    }
  }

  async function minimizeWindow() {
    await runWindowAction(() => getCurrentWindow().minimize());
  }

  async function closeWindow() {
    await runWindowAction(() => getCurrentWindow().close());
  }

  function toggleSoundMuted() {
    const nextMuted = !soundMuted;
    setSoundMuted(nextMuted);
    setSoundMutedState(nextMuted);
  }

  function toggleBackgroundMusic() {
    const nextEnabled = !backgroundMusicEnabled;
    setBackgroundMusicEnabled(nextEnabled);
    setBackgroundMusicEnabledState(nextEnabled);
  }

  function toggleLocale() {
    const nextLocale = locale === "zh-CN" ? "en-US" : "zh-CN";
    setLocale(nextLocale);
    void persistOpenedPffPaths(openedArchivePaths(), nextLocale);
  }

  function showConfirmDialog(options: Omit<ConfirmDialogState, "closing" | "resolve">) {
    return new Promise<boolean>((resolve) => {
      setConfirmDialogState({ ...options, closing: false, resolve });
    });
  }

  function closeConfirmDialog(accepted: boolean) {
    const current = confirmDialogState;
    if (!current || current.closing) return;

    setConfirmDialogState({ ...current, closing: true });
    window.setTimeout(() => {
      setConfirmDialogState(null);
      current.resolve(accepted);
    }, CONFIRM_DIALOG_EXIT_MS);
  }

  return (
    <I18nProvider locale={locale}>
      <main className={appShellClass}>
        <TitleBar
          soundMuted={soundMuted}
          backgroundMusicEnabled={backgroundMusicEnabled}
          locale={locale}
          onOpenProject={openProject}
          onOpenFile={openFile}
          onToggleSoundMuted={toggleSoundMuted}
          onToggleBackgroundMusic={toggleBackgroundMusic}
          onToggleLocale={toggleLocale}
          onMinimize={minimizeWindow}
          onClose={closeWindow}
          onStartDrag={startWindowDrag}
          onTitleDoubleClick={fitWindowToCursorWorkAreaFromTitle}
        />

        <div className={contentClass}>
          <Panel
            id="tree-panel"
            title={t("panel.packages")}
            sub={t("app.packageCount", { count: snapshot.archives.length })}
          >
            <PackageTree
              archives={snapshot.archives}
              allCount={snapshot.entries.length}
              activeArchivePath={activeArchivePath}
              onSelect={selectArchive}
              onCloseArchive={closeArchive}
              onCloseAllArchives={closeAllArchives}
            />
          </Panel>

          <div className={rightColumnClass}>
            <Panel
              id="table-panel"
              title={t("panel.resources")}
              sub={t("app.fileCount", { count: visibleRows.length })}
            >
              <div key={resourceFilesSlideKey} className={df1HorizontalWipeClass}>
                <div className="df1-wipe-content">
                  <ResourceToolbar
                    searchText={searchText}
                    formatOptions={availableFormats}
                    selectedFormats={selectedFormats}
                    selectionCount={selectedRows.length}
                    exporting={exporting}
                    onSearch={setSearchText}
                    onToggleFormat={toggleFormat}
                    onClearFormats={clearFormats}
                    onExport={exportSelected}
                  />
                  <ResourceTable
                    rows={visibleRows}
                    focusedKey={focusedKey}
                    selectedKeys={selectedKeys}
                    searchText={searchText}
                    sortKey={sortKey}
                    sortAsc={sortAsc}
                    showArchiveColumn={activeArchivePath === null}
                    onSort={changeSort}
                    onSelect={selectResource}
                    onDragSelect={dragSelectResources}
                  />
                </div>
              </div>
            </Panel>

            {selectedEntry && (
              <Panel id="preview-panel" title={t("panel.preview")} sub={selectedEntry.name}>
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

        {confirmDialogState && (
          <ConfirmDialog
            title={confirmDialogState.title}
            message={confirmDialogState.message}
            detail={confirmDialogState.detail}
            confirmLabel={confirmDialogState.confirmLabel}
            cancelLabel={confirmDialogState.cancelLabel}
            closing={confirmDialogState.closing}
            onConfirm={() => closeConfirmDialog(true)}
            onCancel={() => closeConfirmDialog(false)}
          />
        )}
      </main>
    </I18nProvider>
  );
}

function startWindowDrag(event: MouseEvent<HTMLElement>) {
  if (event.button !== 0 || event.detail > 1) return;

  void runWindowAction(() => getCurrentWindow().startDragging());
}

function fitWindowToCursorWorkAreaFromTitle(event: MouseEvent<HTMLElement>) {
  event.preventDefault();
  event.stopPropagation();

  window.setTimeout(() => {
    void fitWindowToCursorWorkArea();
  }, 0);
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

    await fitWindowToMonitorWorkArea(monitor);
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

async function fitWindowToCursorWorkArea() {
  try {
    const cursor = await cursorPosition();
    const monitor =
      (await monitorFromPoint(cursor.x, cursor.y)) ??
      (await currentMonitor()) ??
      (await primaryMonitor());
    if (!monitor) return;

    await fitWindowToMonitorWorkArea(monitor);
  } catch (error) {
    console.error("Window sizing failed", error);
  }
}

async function fitWindowToMonitorWorkArea(monitor: Monitor) {
  const appWindow = getCurrentWindow();
  const workArea = monitor.workArea;

  try {
    if (await appWindow.isMaximized()) {
      await appWindow.unmaximize();
    }
  } catch (error) {
    console.error("Window unmaximize failed", error);
  }

  await appWindow.setPosition(new PhysicalPosition(workArea.position.x, workArea.position.y));
  await appWindow.setSize(new PhysicalSize(workArea.size.width, workArea.size.height));
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

function areSetsEqual(left: ReadonlySet<string>, right: ReadonlySet<string>) {
  if (left.size !== right.size) return false;

  for (const value of left) {
    if (!right.has(value)) return false;
  }

  return true;
}

async function buildUniqueBatchExportPath(
  outputDirectory: string,
  entry: ResourceTableRow,
  groupByPackage: boolean,
  usedOutputPaths: Set<string>,
) {
  const baseParts = groupByPackage ? [packageFolderName(entry)] : [];
  const resourceParts = resourcePathParts(entry.name);
  let duplicateIndex = 1;

  while (true) {
    const candidateParts =
      duplicateIndex === 1 ? resourceParts : withFileSuffix(resourceParts, duplicateIndex);
    const outputPath = await join(outputDirectory, ...baseParts, ...candidateParts);
    const outputKey = outputPath.toLowerCase();

    if (!usedOutputPaths.has(outputKey)) {
      usedOutputPaths.add(outputKey);
      return outputPath;
    }

    duplicateIndex += 1;
  }
}

function packageFolderName(entry: Pick<ResourceTableRow, "archiveName" | "archivePath">) {
  const archiveName = basename(entry.archiveName || entry.archivePath);
  const dotIndex = archiveName.lastIndexOf(".");
  const stem = dotIndex > 0 ? archiveName.slice(0, dotIndex) : archiveName;
  return sanitizePathSegment(stem, "package");
}

function resourcePathParts(name: string) {
  const parts = name
    .split(/[\\/]/)
    .filter((part) => {
      const trimmed = part.trim();
      return trimmed.length > 0 && trimmed !== "." && trimmed !== "..";
    })
    .map((part) => sanitizePathSegment(part, "resource"))
    .filter(Boolean);

  return parts.length > 0 ? parts : ["resource.bin"];
}

function withFileSuffix(parts: string[], duplicateIndex: number) {
  const nextParts = [...parts];
  const fileName = nextParts[nextParts.length - 1] ?? "resource.bin";
  const dotIndex = fileName.lastIndexOf(".");
  const hasExtension = dotIndex > 0 && dotIndex < fileName.length - 1;
  const stem = hasExtension ? fileName.slice(0, dotIndex) : fileName;
  const extension = hasExtension ? fileName.slice(dotIndex) : "";

  nextParts[nextParts.length - 1] = `${stem}_${duplicateIndex}${extension}`;
  return nextParts;
}

function sanitizePathSegment(value: string, fallback: string) {
  const sanitized = value
    .trim()
    .replace(/[<>:"|?*\u0000-\u001f]/g, "_")
    .replace(/^\.+$/, "_");

  return sanitized || fallback;
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
    animation: df1-preview-panel-reveal ${DF1_MENU_SLIDE_DURATION_MS}ms linear both;
    will-change: clip-path;
  }

  #preview-panel::after {
    content: "";
    position: absolute;
    top: 26px;
    bottom: 0;
    left: -84px;
    width: 84px;
    z-index: 5;
    pointer-events: none;
    background:
      repeating-linear-gradient(
        0deg,
        rgba(120, 255, 120, 0.18) 0,
        rgba(120, 255, 120, 0.18) 1px,
        rgba(0, 0, 0, 0.12) 1px,
        rgba(0, 0, 0, 0.12) 3px
      ),
      linear-gradient(
        90deg,
        rgba(0, 0, 0, 0),
        rgba(57, 232, 57, 0.14) 18%,
        rgba(127, 255, 127, 0.28) 52%,
        rgba(57, 232, 57, 0.12) 82%,
        rgba(0, 0, 0, 0)
      );
    border-right: 1px solid rgba(127, 255, 127, 0.38);
    box-shadow: 0 0 18px rgba(57, 232, 57, 0.18);
    animation: df1-preview-panel-sweep ${DF1_MENU_SLIDE_DURATION_MS}ms linear both;
  }

  @keyframes df1-preview-panel-reveal {
    0% {
      clip-path: inset(0 100% 0 0);
    }

    100% {
      clip-path: inset(0 0 0 0);
    }
  }

  @keyframes df1-preview-panel-sweep {
    0% {
      left: -84px;
    }

    100% {
      left: 100%;
    }
  }

  @media (max-width: 1100px) {
    #preview-panel {
      width: 550px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    #preview-panel {
      animation: none;
      clip-path: none;
    }

    #preview-panel::after {
      display: none;
    }
  }
`;

const df1HorizontalWipeClass = css`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  background: var(--panel-bg);
  contain: paint;

  .df1-wipe-content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    animation: df1-menu-reveal ${DF1_MENU_SLIDE_DURATION_MS}ms linear both;
    will-change: clip-path;
  }

  &::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: -84px;
    width: 84px;
    z-index: 4;
    pointer-events: none;
    background:
      repeating-linear-gradient(
        0deg,
        rgba(120, 255, 120, 0.18) 0,
        rgba(120, 255, 120, 0.18) 1px,
        rgba(0, 0, 0, 0.12) 1px,
        rgba(0, 0, 0, 0.12) 3px
      ),
      linear-gradient(
        90deg,
        rgba(0, 0, 0, 0),
        rgba(57, 232, 57, 0.14) 18%,
        rgba(127, 255, 127, 0.28) 52%,
        rgba(57, 232, 57, 0.12) 82%,
        rgba(0, 0, 0, 0)
      );
    border-left: 1px solid rgba(127, 255, 127, 0.16);
    border-right: 1px solid rgba(127, 255, 127, 0.38);
    box-shadow:
      0 0 18px rgba(57, 232, 57, 0.18),
      inset 0 0 18px rgba(127, 255, 127, 0.08);
    animation: df1-menu-sweep ${DF1_MENU_SLIDE_DURATION_MS}ms linear both;
  }

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 3;
    pointer-events: none;
    background:
      linear-gradient(90deg, rgba(0, 0, 0, 0.28), rgba(0, 0, 0, 0) 26%),
      repeating-linear-gradient(
        0deg,
        rgba(127, 255, 127, 0.04) 0,
        rgba(127, 255, 127, 0.04) 1px,
        rgba(0, 0, 0, 0) 1px,
        rgba(0, 0, 0, 0) 4px
      );
    animation: df1-menu-overlay ${DF1_MENU_SLIDE_DURATION_MS}ms linear both;
  }

  @keyframes df1-menu-reveal {
    0% {
      clip-path: inset(0 100% 0 0);
    }

    100% {
      clip-path: inset(0 0 0 0);
    }
  }

  @keyframes df1-menu-sweep {
    0% {
      left: -84px;
    }

    100% {
      left: 100%;
    }
  }

  @keyframes df1-menu-overlay {
    0%,
    70% {
      opacity: 1;
    }

    100% {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .df1-wipe-content,
    &::before,
    &::after {
      animation: none;
    }

    .df1-wipe-content {
      clip-path: none;
    }

    &::before,
    &::after {
      display: none;
    }
  }
`;

export default App;
