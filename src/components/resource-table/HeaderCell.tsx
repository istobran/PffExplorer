import { css } from "@emotion/css";
import clsx from "clsx";
import type { ReactNode } from "react";

export type HeaderCellProps = {
  children: ReactNode;
  active?: boolean;
  asc?: boolean;
  center?: boolean;
  onClick: () => void;
};

export function HeaderCell(props: HeaderCellProps) {
  return (
    <button
      className={clsx(headerCellClass, props.center && "center", props.active && "sorted")}
      onClick={props.onClick}
    >
      <span>{props.children}</span>
      <span className="th-arrow">{props.active ? (props.asc ? "▲" : "▼") : ""}</span>
    </button>
  );
}

const headerCellClass = css`
  display: flex;
  align-items: center;
  padding: 0 8px;
  font-size: 10px;
  letter-spacing: 1.5px;
  color: var(--green-sel);
  text-transform: uppercase;
  border: none;
  border-right: 1px solid var(--border);
  background: transparent;
  cursor: var(--cursor-crosshair), crosshair;
  gap: 4px;
  transition: background 0.08s;

  &:last-child {
    border-right: none;
  }

  &:hover {
    background: rgba(57, 232, 57, 0.04);
    color: var(--hover-text);
    text-shadow: var(--hover-text-glow);
  }

  &.center {
    justify-content: center;
  }

  &.sorted {
    color: var(--green-hi);
  }

  &.sorted:hover {
    color: var(--hover-text);
  }

  .th-arrow {
    font-size: 8px;
    color: var(--text-dim);
    min-width: 8px;
  }
`;
