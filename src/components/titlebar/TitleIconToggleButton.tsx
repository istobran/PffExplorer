import { css } from "@emotion/css";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import { playUiHover, playUiPress } from "@/lib/sounds";

export type TitleIconToggleButtonProps = {
  active: boolean;
  activeTitle: string;
  inactiveTitle: string;
  icon: LucideIcon;
  offTone?: "danger" | "dim";
  onToggle: () => void;
};

export function TitleIconToggleButton(props: TitleIconToggleButtonProps) {
  const Icon = props.icon;
  const title = props.active ? props.activeTitle : props.inactiveTitle;

  return (
    <button
      type="button"
      className={clsx(
        titleIconToggleButtonClass,
        !props.active && "inactive",
        !props.active && props.offTone === "danger" && "danger",
      )}
      title={title}
      aria-label={title}
      aria-pressed={props.active}
      onClick={props.onToggle}
      onPointerEnter={playUiHover}
      onPointerDown={playUiPress}
    >
      <Icon size={14} />
    </button>
  );
}

const titleIconToggleButtonClass = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 26px;
  background: none;
  border: 1px solid var(--border);
  color: var(--green-dim);
  cursor: var(--cursor-crosshair), crosshair;
  outline: none;
  transition: all 0.08s;
  flex-shrink: 0;

  &:hover {
    background: var(--sel-row);
    color: var(--hover-text);
    border-color: var(--green-sel);
    box-shadow: none;
    text-shadow: var(--hover-text-glow);
  }

  &.inactive {
    opacity: 0.84;
  }

  &.danger {
    color: var(--danger);
    border-color: rgba(255, 85, 85, 0.45);
    background: rgba(200, 40, 40, 0.08);
  }

  &.danger:hover {
    color: var(--hover-text);
    border-color: var(--green-sel);
    background: var(--sel-row);
  }
`;
