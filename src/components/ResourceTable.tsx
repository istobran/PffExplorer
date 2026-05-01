import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { css } from "@emotion/css";
import type { ResourceEntry, ResourceTableRow, SortKey } from "@/types";
import { entryKey } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { ResourceTableHeader } from "@/components/resource-table/ResourceTableHeader";
import { ResourceTableRowItem } from "@/components/resource-table/ResourceTableRowItem";

export type ResourceTableProps = {
  rows: ResourceTableRow[];
  selectedKey: string | null;
  searchText: string;
  sortKey: SortKey;
  sortAsc: boolean;
  onSort: (key: SortKey) => void;
  onSelect: (entry: ResourceEntry) => void;
};

export function ResourceTable(props: ResourceTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: props.rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 24,
    overscan: 16,
  });

  return (
    <div className={resourceTableClass}>
      <ResourceTableHeader
        sortKey={props.sortKey}
        sortAsc={props.sortAsc}
        onSort={props.onSort}
      />

      {props.rows.length === 0 ? (
        <EmptyState marker="0">NO MATCHING FILES</EmptyState>
      ) : (
        <div id="tbl-body" ref={parentRef}>
          <div className="virtual-pad" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((item) => {
              const row = props.rows[item.index];
              return (
                <ResourceTableRowItem
                  key={entryKey(row)}
                  row={row}
                  selected={props.selectedKey === entryKey(row)}
                  searchText={props.searchText}
                  top={item.start}
                  onSelect={() => props.onSelect(row)}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const resourceTableClass = css`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;

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
`;
