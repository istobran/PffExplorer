import { css } from "@emotion/css";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import { playUiHover, playUiPress } from "@/lib/sounds";

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
      onPointerEnter={playUiHover}
      onPointerDown={playUiPress}
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
  color: var(--text-dim);
  cursor: var(--cursor-crosshair), crosshair;
  outline: none;
  transition: all 0.08s;

  &:hover {
    background: var(--sel-row);
    color: var(--hover-text);
    border-color: var(--green-sel);
    font-weight: var(--hover-text-weight);
    box-shadow: none;
    text-shadow: var(--hover-text-glow);
  }

  &.close:hover {
    background: rgba(200, 40, 40, 0.18);
    color: #ff5555;
    border-color: #aa2222;
  }
`;
