import { css } from "@emotion/css";
import { Archive, Box, FileArchive } from "lucide-react";
import type { ArchiveSummary } from "@/types";
import { EmptyState } from "@/components/EmptyState";
import { PackageTreeItem } from "@/components/package-tree/PackageTreeItem";

export type PackageTreeProps = {
  archives: ArchiveSummary[];
  allCount: number;
  activeArchivePath: string | null;
  onSelect: (path: string | null) => void;
};

export function PackageTree(props: PackageTreeProps) {
  return (
    <div className={packageTreeClass}>
      <PackageTreeItem
        icon={Archive}
        label="ALL PACKAGES"
        count={props.allCount}
        active={props.activeArchivePath === null}
        all
        onClick={() => props.onSelect(null)}
      />
      {props.archives.map((archive) => (
        <PackageTreeItem
          key={archive.path}
          icon={Box}
          label={archive.name.toUpperCase()}
          count={archive.fileCount}
          active={props.activeArchivePath === archive.path}
          title={archive.path}
          onClick={() => props.onSelect(archive.path)}
        />
      ))}
      {props.archives.length === 0 && (
        <EmptyState icon={FileArchive} compact>
          OPEN A PFF OR PROJECT
        </EmptyState>
      )}
    </div>
  );
}

const packageTreeClass = css`
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
`;
