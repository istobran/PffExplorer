import { css } from "@emotion/css";
import clsx from "clsx";
import type { ReactNode } from "react";

export type TagProps = {
  active?: boolean;
  className?: string;
  title?: string;
  children: ReactNode;
};

export function Tag(props: TagProps) {
  return (
    <span
      className={clsx(tagClass, props.active && "active", props.className)}
      title={props.title}
    >
      {props.children}
    </span>
  );
}

const tagClass = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 16px;
  padding: 0 8px;
  background: #0a1a0a;
  border: 1px solid var(--border-hi);
  color: var(--green-dim);
  font-size: 11px;
  line-height: 1;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  flex-shrink: 0;

  &:hover {
    color: var(--green-dim);
    text-shadow: none;
  }

  &.active {
    color: var(--green);
    border-color: var(--green-sel);
  }

  &.active:hover {
    color: var(--green);
  }
`;
