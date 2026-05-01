import { css } from "@emotion/css";
import clsx from "clsx";
import type { ReactNode } from "react";

export type StatusItemProps = {
  label: string;
  value: ReactNode;
  children?: ReactNode;
  className?: string;
  title?: string;
  wide?: boolean;
  truncate?: boolean;
};

export function StatusItem(props: StatusItemProps) {
  return (
    <div
      className={clsx(statusItemClass, props.wide && "wide", props.className)}
      title={props.title}
    >
      {props.children}
      <span>{props.label}:</span>
      <span className={clsx("sv", props.truncate && "truncate")}>{props.value}</span>
    </div>
  );
}

const statusItemClass = css`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0 12px;
  border-right: 1px solid var(--border);
  height: 100%;
  font-size: 10px;
  letter-spacing: 1px;
  color: var(--text-dim);
  text-transform: uppercase;
  white-space: nowrap;
  min-width: 0;

  &:first-child {
    padding-left: 0;
  }

  &:last-child {
    border-right: none;
  }

  &.wide {
    max-width: 280px;
  }

  &.warn .sv {
    color: #d6b34a;
  }

  .sv {
    color: var(--green-sel);
  }

  .truncate {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;
