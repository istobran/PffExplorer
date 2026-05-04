import { css } from "@emotion/css";
import type { StatusState, WorkspaceSnapshot } from "@/types";
import { basename, formatBytes } from "@/lib/format";
import { StatusDot } from "@/components/status/StatusDot";
import { StatusItem } from "@/components/status/StatusItem";
import { StatusProgress } from "@/components/status/StatusProgress";
import { useI18n, type TranslationKey } from "@/lib/i18n";

export type StatusBarProps = {
  status: StatusState;
  snapshot: WorkspaceSnapshot;
  activeArchivePath: string | null;
};

export function StatusBar(props: StatusBarProps) {
  const { t } = useI18n();
  const pkg = packageStatusLabel(props.snapshot, props.activeArchivePath);

  return (
    <footer id="statusbar" className={statusBarClass}>
      <StatusItem label={t("status.ver")} value="1.0.0" />
      <StatusItem label={t("status.status")} value={localizeStatusText(props.status.label, t)}>
        <StatusDot error={props.status.label === "ERROR"} />
      </StatusItem>
      <StatusItem
        label={t("status.pkg")}
        value={localizeStatusText(pkg || "-", t)}
        wide
        truncate
      />
      <StatusItem label={t("status.total")} value={props.snapshot.stats.entryCount} />
      <StatusItem label={t("status.data")} value={formatBytes(props.snapshot.stats.totalSize)} />
      {props.snapshot.warnings.length > 0 && (
        <StatusItem
          label={t("status.warn")}
          value={props.snapshot.warnings.length}
          className="warn"
          title={props.snapshot.warnings.join("\n")}
        />
      )}
      {props.status.progress != null && (
        <StatusProgress
          label={localizeStatusText(props.status.progressLabel, t)}
          progress={props.status.progress}
        />
      )}
    </footer>
  );
}

const statusBarClass = css`
  display: flex;
  align-items: center;
  height: 26px;
  flex-shrink: 0;
  background: #030803;
  border-top: 2px solid var(--border-hi);
  padding: 0 12px;
  gap: 0;
  min-width: 0;
`;

function packageStatusLabel(snapshot: WorkspaceSnapshot, activeArchivePath: string | null) {
  if (activeArchivePath) return basename(activeArchivePath).toUpperCase();
  if (snapshot.archives.length > 0) return "ALL PACKAGES";
  return "-";
}

function localizeStatusText(
  value: string,
  t: (key: TranslationKey) => string,
) {
  const keyByValue: Record<string, TranslationKey> = {
    "ALL PACKAGES": "package.all",
    "SAVED PACKAGES": "status.savedPackages",
    READY: "status.ready",
    "READY WITH WARNINGS": "status.readyWarnings",
    "READY WITH ERRORS": "status.readyErrors",
    ERROR: "status.error",
    SCANNING: "status.scanning",
    LOADED: "status.loaded",
    EXPORTING: "status.exporting",
    IDLE: "status.idle",
    "PFF LOAD": "status.pffLoad",
    EXPORT: "status.export",
  };

  const key = keyByValue[value];
  return key ? t(key) : value;
}
