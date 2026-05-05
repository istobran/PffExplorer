import { css } from "@emotion/css";
import type { KeyboardEvent } from "react";
import { Archive, Box, FileArchive } from "lucide-react";
import type { ArchiveSummary } from "@/types";
import { EmptyState } from "@/components/EmptyState";
import { PackageTreeItem } from "@/components/package-tree/PackageTreeItem";
import { useI18n } from "@/lib/i18n";

export type PackageTreeProps = {
  archives: ArchiveSummary[];
  allCount: number;
  activeArchivePath: string | null;
  onSelect: (path: string | null) => void;
  onCloseArchive: (path: string) => void;
  onCloseAllArchives: () => void;
};

export function PackageTree(props: PackageTreeProps) {
  const { t } = useI18n();

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

    event.preventDefault();

    const paths = [null, ...props.archives.map((archive) => archive.path)];
    if (paths.length === 0) return;

    const currentIndex = Math.max(
      paths.findIndex((path) => path === props.activeArchivePath),
      0,
    );
    const nextIndex =
      event.key === "ArrowDown"
        ? Math.min(currentIndex + 1, paths.length - 1)
        : Math.max(currentIndex - 1, 0);

    if (nextIndex !== currentIndex) {
      props.onSelect(paths[nextIndex]);
    }
  }

  return (
    <div
      className={packageTreeClass}
      tabIndex={0}
      role="listbox"
      aria-label={t("package.aria")}
      onKeyDown={handleKeyDown}
    >
      <PackageTreeItem
        icon={Archive}
        label={t("package.all")}
        count={props.allCount}
        active={props.activeArchivePath === null}
        all
        onClick={() => props.onSelect(null)}
        onClose={props.archives.length > 0 ? props.onCloseAllArchives : undefined}
        closeLabel={t("package.close", { name: t("package.all") })}
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
          onClose={() => props.onCloseArchive(archive.path)}
          closeLabel={t("package.close", { name: archive.name.toUpperCase() })}
        />
      ))}
      {props.archives.length === 0 && (
        <EmptyState icon={FileArchive} compact>
          {t("package.empty")}
        </EmptyState>
      )}
    </div>
  );
}

const packageTreeClass = css`
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
  background: var(--surface-bg);
  box-shadow: inset 0 0 30px rgba(0, 0, 0, 0.18);
  outline: none;

  &:focus-visible {
    box-shadow: inset 0 0 0 1px var(--green-dim);
  }
`;
