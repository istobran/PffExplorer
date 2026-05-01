import { css } from "@emotion/css";
import clsx from "clsx";
import type { ResourceTableRow } from "@/types";
import { formatBytes, hex32 } from "@/lib/format";
import { FileExtensionPill } from "@/components/resource-table/FileExtensionPill";
import { HighlightedText } from "@/components/resource-table/HighlightedText";
import { RESOURCE_TABLE_COLUMNS } from "@/components/resource-table/resourceTableLayout";
import { TableCell } from "@/components/resource-table/TableCell";

export type ResourceTableRowItemProps = {
  row: ResourceTableRow;
  selected: boolean;
  searchText: string;
  showArchiveTag: boolean;
  top: number;
  onSelect: () => void;
};

export function ResourceTableRowItem(props: ResourceTableRowItemProps) {
  return (
    <button
      type="button"
      className={clsx(resourceTableRowItemClass, props.selected && "selected")}
      style={{ transform: `translateY(${props.top}px)` }}
      onClick={props.onSelect}
      title={`${props.row.archiveName} / ${props.row.name}`}
    >
      <TableCell center dim>
        {String(props.row.rowNumber).padStart(3, "0")}
      </TableCell>
      <TableCell className="file-cell">
        <HighlightedText text={props.row.name} query={props.searchText} />
        {props.showArchiveTag && <span className="src-tag">{props.row.archiveName}</span>}
      </TableCell>
      <TableCell>
        <FileExtensionPill name={props.row.name} />
      </TableCell>
      <TableCell num>{formatBytes(props.row.size)}</TableCell>
      <TableCell num>{hex32(props.row.offset)}</TableCell>
      <TableCell num>
        {props.row.checksum == null ? "-" : hex32(props.row.checksum)}
      </TableCell>
    </button>
  );
}

const resourceTableRowItemClass = css`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  height: 24px;
  min-height: 24px;
  display: grid;
  grid-template-columns: ${RESOURCE_TABLE_COLUMNS};
  align-items: stretch;
  padding: 0;
  border: none;
  border-bottom: 1px solid #0a1a0a;
  background: transparent;
  color: var(--green);
  cursor: pointer;
  transition: background 0.06s;
  text-align: left;

  &:hover {
    background: var(--hover-row);
  }

  &:hover .td {
    color: var(--green);
  }

  &.selected {
    background: var(--sel-row);
  }

  &.selected .td {
    color: var(--green-hi);
  }

  .file-cell {
    gap: 4px;
  }

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
`;
