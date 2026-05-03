import { css } from "@emotion/css";
import { Download, LoaderCircle } from "lucide-react";
import { FormatFilterDropdown } from "@/components/toolbar/FormatFilterDropdown";
import { SearchBox } from "@/components/toolbar/SearchBox";
import { ToolbarButton } from "@/components/toolbar/ToolbarButton";
import { ToolbarSeparator } from "@/components/toolbar/ToolbarSeparator";

export type ResourceToolbarProps = {
  searchText: string;
  formatOptions: string[];
  selectedFormats: string[];
  selectionCount: number;
  exporting: boolean;
  onSearch: (value: string) => void;
  onToggleFormat: (format: string) => void;
  onClearFormats: () => void;
  onExport: () => void;
};

export function ResourceToolbar(props: ResourceToolbarProps) {
  return (
    <div className={toolbarClass}>
      <span className="toolbar-label">FILTER:</span>
      <SearchBox value={props.searchText} onChange={props.onSearch} />
      <ToolbarSeparator />
      <FormatFilterDropdown
        options={props.formatOptions}
        selected={props.selectedFormats}
        onToggle={props.onToggleFormat}
        onClear={props.onClearFormats}
      />
      <ToolbarSeparator />
      <ToolbarButton
        className="action"
        disabled={props.selectionCount === 0 || props.exporting}
        onClick={props.onExport}
        title="Export exact bytes stored in the archive"
      >
        {props.exporting ? (
          <LoaderCircle className="toolbar-spin" size={12} />
        ) : (
          <Download size={12} />
        )}
        <span>
          {props.exporting
            ? "EXPORTING"
            : props.selectionCount > 1
              ? `EXPORT (${props.selectionCount})`
              : "EXPORT"}
        </span>
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
  overflow: visible;
  position: relative;
  z-index: 20;

  .toolbar-label {
    font-size: 10px;
    letter-spacing: 1px;
    color: var(--text-dim);
    text-transform: uppercase;
    white-space: nowrap;
  }

  .toolbar-spin {
    animation: resource-toolbar-spin 0.8s linear infinite;
  }

  @keyframes resource-toolbar-spin {
    to {
      transform: rotate(360deg);
    }
  }
`;
