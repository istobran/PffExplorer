import { css } from "@emotion/css";
import { Download } from "lucide-react";
import type { ResourceKind } from "@/types";
import { KindFilterButton } from "@/components/toolbar/KindFilterButton";
import { SearchBox } from "@/components/toolbar/SearchBox";
import { ToolbarButton } from "@/components/toolbar/ToolbarButton";
import { ToolbarSeparator } from "@/components/toolbar/ToolbarSeparator";

const FILTERS: Array<ResourceKind | "ALL"> = [
  "ALL",
  "TEX",
  "SND",
  "MDL",
  "SHD",
  "CFG",
  "DAT",
];

export type ResourceToolbarProps = {
  searchText: string;
  kindFilter: ResourceKind | "ALL";
  hasSelection: boolean;
  onSearch: (value: string) => void;
  onKindFilter: (value: ResourceKind | "ALL") => void;
  onExport: () => void;
};

export function ResourceToolbar(props: ResourceToolbarProps) {
  return (
    <div className={toolbarClass}>
      <span className="toolbar-label">FILTER:</span>
      <SearchBox value={props.searchText} onChange={props.onSearch} />
      <ToolbarSeparator />
      {FILTERS.map((filter) => (
        <KindFilterButton
          key={filter}
          filter={filter}
          active={props.kindFilter === filter}
          onClick={() => props.onKindFilter(filter)}
        />
      ))}
      <ToolbarSeparator />
      <ToolbarButton
        className="action"
        disabled={!props.hasSelection}
        onClick={props.onExport}
        title="Export exact bytes stored in the archive"
      >
        <Download size={12} />
        <span>EXPORT</span>
      </ToolbarButton>
    </div>
  );
}

const toolbarClass = css`
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

  .toolbar-label {
    font-size: 10px;
    letter-spacing: 1px;
    color: var(--text-dim);
    text-transform: uppercase;
    white-space: nowrap;
  }
`;
