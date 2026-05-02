import { css } from "@emotion/css";
import clsx from "clsx";
import type { SortKey } from "@/types";
import { HeaderCell } from "@/components/resource-table/HeaderCell";
import {
  RESOURCE_TABLE_COLUMNS,
  RESOURCE_TABLE_COLUMNS_WITH_ARCHIVE,
} from "@/components/resource-table/resourceTableLayout";

export type ResourceTableHeaderProps = {
  sortKey: SortKey;
  sortAsc: boolean;
  showArchiveColumn: boolean;
  onSort: (key: SortKey) => void;
};

export function ResourceTableHeader(props: ResourceTableHeaderProps) {
  return (
    <div
      className={clsx(resourceTableHeaderClass, props.showArchiveColumn && "with-archive-column")}
    >
      <HeaderCell center onClick={() => props.onSort("archiveName")}>
        #
      </HeaderCell>
      <HeaderCell
        active={props.sortKey === "name"}
        asc={props.sortAsc}
        onClick={() => props.onSort("name")}
      >
        FILENAME
      </HeaderCell>
      {props.showArchiveColumn && (
        <HeaderCell
          active={props.sortKey === "archiveName"}
          asc={props.sortAsc}
          onClick={() => props.onSort("archiveName")}
        >
          PACKAGE
        </HeaderCell>
      )}
      <HeaderCell
        active={props.sortKey === "kind"}
        asc={props.sortAsc}
        onClick={() => props.onSort("kind")}
      >
        TYPE
      </HeaderCell>
      <HeaderCell
        active={props.sortKey === "size"}
        asc={props.sortAsc}
        onClick={() => props.onSort("size")}
      >
        SIZE
      </HeaderCell>
      <HeaderCell
        active={props.sortKey === "offset"}
        asc={props.sortAsc}
        onClick={() => props.onSort("offset")}
      >
        OFFSET
      </HeaderCell>
      <HeaderCell
        active={props.sortKey === "checksum"}
        asc={props.sortAsc}
        onClick={() => props.onSort("checksum")}
      >
        CHECKSUM
      </HeaderCell>
    </div>
  );
}

const resourceTableHeaderClass = css`
  display: grid;
  grid-template-columns: ${RESOURCE_TABLE_COLUMNS};
  height: 24px;
  background: #030a03;
  border-bottom: 2px solid var(--border-hi);
  flex-shrink: 0;

  &.with-archive-column {
    grid-template-columns: ${RESOURCE_TABLE_COLUMNS_WITH_ARCHIVE};
  }
`;
