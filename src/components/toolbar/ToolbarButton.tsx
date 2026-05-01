import { css } from "@emotion/css";
import clsx from "clsx";
import type { ReactNode } from "react";

export type ToolbarButtonProps = {
  active?: boolean;
  className?: string;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
  children: ReactNode;
};

export function ToolbarButton(props: ToolbarButtonProps) {
  return (
    <button
      className={clsx(toolbarButtonClass, props.active && "on", props.className)}
      disabled={props.disabled}
      title={props.title}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

export const toolbarButtonClass = css`
  background: none;
  border: 1px solid var(--border);
  color: var(--green-dim);
  font-size: 10px;
  letter-spacing: 1px;
  text-transform: uppercase;
  padding: 0 8px;
  height: 20px;
  cursor: pointer;
  outline: none;
  transition: all 0.08s;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;

  &:hover {
    border-color: var(--green-sel);
    color: var(--green);
    background: rgba(57, 232, 57, 0.05);
  }

  &.on {
    border-color: var(--green);
    color: var(--green-hi);
    background: var(--sel-bg);
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;

    &:hover {
      background: none;
      border-color: var(--border);
      color: var(--green-dim);
    }
  }
`;
