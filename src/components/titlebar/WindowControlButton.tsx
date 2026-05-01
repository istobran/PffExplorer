import { css } from "@emotion/css";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";

export type WindowControlButtonProps = {
  icon: LucideIcon;
  title: string;
  variant?: "close";
  onClick: () => void;
};

export function WindowControlButton(props: WindowControlButtonProps) {
  const Icon = props.icon;

  return (
    <button
      className={clsx(windowControlButtonClass, props.variant)}
      title={props.title}
      onClick={props.onClick}
    >
      <Icon size={props.variant === "close" ? 15 : 14} />
    </button>
  );
}

const windowControlButtonClass = css`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 26px;
  background: none;
  border: 1px solid var(--border);
  color: var(--green-dim);
  cursor: pointer;
  outline: none;
  transition: all 0.08s;

  &:hover {
    background: rgba(57, 232, 57, 0.08);
    color: var(--green);
    border-color: var(--green-dim);
  }

  &.close:hover {
    background: rgba(200, 40, 40, 0.18);
    color: #ff5555;
    border-color: #aa2222;
  }
`;
