import { css } from "@emotion/css";
import type { StatusState, WorkspaceSnapshot } from "@/types";
import { basename, formatBytes } from "@/lib/format";
import { StatusDot } from "@/components/status/StatusDot";
import { StatusItem } from "@/components/status/StatusItem";
import { StatusProgress } from "@/components/status/StatusProgress";

export type StatusBarProps = {
  status: StatusState;
  snapshot: WorkspaceSnapshot;
  activeArchivePath: string | null;
};

export function StatusBar(props: StatusBarProps) {
  const pkg = packageStatusLabel(props.snapshot, props.activeArchivePath);

  return (
    <footer id="statusbar" className={statusBarClass}>
      <StatusItem label="VER" value="1.0.0" />
      <StatusItem label="STATUS" value={props.status.label}>
        <StatusDot error={props.status.label === "ERROR"} />
      </StatusItem>
      <StatusItem label="PKG" value={pkg || "-"} wide truncate />
      <StatusItem label="TOTAL" value={props.snapshot.stats.entryCount} />
      <StatusItem label="DATA" value={formatBytes(props.snapshot.stats.totalSize)} />
      {props.snapshot.warnings.length > 0 && (
        <StatusItem
          label="WARN"
          value={props.snapshot.warnings.length}
          className="warn"
          title={props.snapshot.warnings.join("\n")}
        />
      )}
      {props.status.progress != null && (
        <StatusProgress label={props.status.progressLabel} progress={props.status.progress} />
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
