import { css } from "@emotion/css";
import clsx from "clsx";
import type { SortKey } from "@/types";
import { HeaderCell } from "@/components/resource-table/HeaderCell";
import {
  RESOURCE_TABLE_COLUMNS,
  RESOURCE_TABLE_COLUMNS_WITH_ARCHIVE,
} from "@/components/resource-table/resourceTableLayout";
import { useI18n } from "@/lib/i18n";

export type ResourceTableHeaderProps = {
  sortKey: SortKey;
  sortAsc: boolean;
  showArchiveColumn: boolean;
  onSort: (key: SortKey) => void;
};

export function ResourceTableHeader(props: ResourceTableHeaderProps) {
  const { t } = useI18n();

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
        {t("resource.header.filename")}
      </HeaderCell>
      {props.showArchiveColumn && (
        <HeaderCell
          active={props.sortKey === "archiveName"}
          asc={props.sortAsc}
          onClick={() => props.onSort("archiveName")}
        >
          {t("resource.header.package")}
        </HeaderCell>
      )}
      <HeaderCell
        active={props.sortKey === "kind"}
        asc={props.sortAsc}
        onClick={() => props.onSort("kind")}
      >
        {t("resource.header.type")}
      </HeaderCell>
      <HeaderCell
        active={props.sortKey === "size"}
        asc={props.sortAsc}
        onClick={() => props.onSort("size")}
      >
        {t("resource.header.size")}
      </HeaderCell>
      <HeaderCell
        active={props.sortKey === "offset"}
        asc={props.sortAsc}
        onClick={() => props.onSort("offset")}
      >
        {t("resource.header.offset")}
      </HeaderCell>
      <HeaderCell
        active={props.sortKey === "checksum"}
        asc={props.sortAsc}
        onClick={() => props.onSort("checksum")}
      >
        {t("resource.header.checksum")}
      </HeaderCell>
    </div>
  );
}

const resourceTableHeaderClass = css`
  display: grid;
  grid-template-columns: ${RESOURCE_TABLE_COLUMNS};
  height: 24px;
  background: var(--panel-header-bg);
  border-bottom: 2px solid var(--border-hi);
  flex-shrink: 0;

  &.with-archive-column {
    grid-template-columns: ${RESOURCE_TABLE_COLUMNS_WITH_ARCHIVE};
  }
`;
