import { css } from "@emotion/css";
import clsx from "clsx";
import type { ReactNode } from "react";

export type TableCellProps = {
  center?: boolean;
  dim?: boolean;
  num?: boolean;
  className?: string;
  title?: string;
  children: ReactNode;
};

export function TableCell(props: TableCellProps) {
  return (
    <div
      className={clsx(
        tableCellClass,
        "td",
        props.center && "center",
        props.dim && "dim",
        props.num && "num",
        props.className,
      )}
      title={props.title}
    >
      {props.children}
    </div>
  );
}

const tableCellClass = css`
  display: flex;
  align-items: center;
  align-self: stretch;
  height: 100%;
  line-height: 1;
  padding: 0 8px;
  font-size: 12px;
  letter-spacing: 0.5px;
  border-right: 1px solid #0d200d;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--green);
  min-width: 0;

  &:last-child {
    border-right: none;
  }

  &.dim {
    color: var(--text-dim);
    font-size: 10px;
  }

  &.num {
    color: var(--text-dim);
    font-size: 10px;
    letter-spacing: 0;
    font-variant-numeric: tabular-nums;
  }

  &.center {
    justify-content: center;
  }
`;
