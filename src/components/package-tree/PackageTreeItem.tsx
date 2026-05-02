import { css } from "@emotion/css";
import clsx from "clsx";
import { X } from "lucide-react";
import type { MouseEvent } from "react";
import type { LucideIcon } from "lucide-react";
import { Tag } from "@/components/Tag";
import { playUiHover, playUiPress } from "@/lib/sounds";

export type PackageTreeItemProps = {
  icon: LucideIcon;
  label: string;
  count: number;
  active: boolean;
  all?: boolean;
  title?: string;
  onClick: () => void;
  onClose?: () => void;
};

export function PackageTreeItem(props: PackageTreeItemProps) {
  const Icon = props.icon;

  function handleClose(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    props.onClose?.();
  }

  return (
    <div
      className={clsx(packageTreeItemClass, props.all && "all-node", props.active && "active")}
      title={props.title}
    >
      <button
        type="button"
        className="pff-main"
        data-menu-select-sound
        onPointerEnter={playUiHover}
        onClick={props.onClick}
      >
        <Icon className="pff-icon" size={props.all ? 15 : 14} />
        <span className="pff-name">{props.label}</span>
        <Tag className="pff-count" active={props.active}>
          {props.count}
        </Tag>
      </button>
      {props.onClose && (
        <button
          type="button"
          className="pff-close"
          title={`Close ${props.label}`}
          aria-label={`Close ${props.label}`}
          onPointerEnter={playUiHover}
          onPointerDown={playUiPress}
          onClick={handleClose}
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

const packageTreeItemClass = css`
  width: 100%;
  display: flex;
  align-items: center;
  height: 30px;
  background: transparent;
  color: var(--green);
  border-bottom: 1px solid transparent;
  transition: background 0.08s, color 0.08s;
  position: relative;
  text-align: left;

  &::after {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 2px;
    background: transparent;
    transition: background 0.1s;
  }

  &:hover {
    background: rgba(57, 232, 57, 0.07);
    color: var(--hover-text);
    font-weight: var(--hover-text-weight);
  }

  &:hover::after {
    background: var(--green-dim);
  }

  &.active {
    background: var(--sel-row);
    color: var(--green-hi);
    border-bottom-color: var(--border);
  }

  &.active:hover {
    color: var(--hover-text);
    font-weight: var(--hover-text-weight);
  }

  &.active::after {
    background: var(--green-sel);
    box-shadow: 0 0 6px var(--green-sel);
  }

  &.all-node {
    border-bottom: 1px solid var(--border);
    margin-bottom: 2px;
  }

  &.active .pff-icon {
    color: var(--green-hi);
  }

  &:hover .pff-icon,
  &:hover .pff-name {
    color: var(--hover-text);
    font-weight: var(--hover-text-weight);
    text-shadow: var(--hover-text-glow);
  }

  .pff-main {
    flex: 1;
    min-width: 0;
    height: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 8px 0 10px;
    background: transparent;
    color: inherit;
    border: none;
    cursor: var(--cursor-crosshair), crosshair;
    outline: none;
    text-align: left;
  }

  .pff-main:focus-visible,
  .pff-close:focus-visible {
    box-shadow: inset 0 0 0 1px var(--green-sel);
  }

  .pff-icon {
    color: var(--text-dim);
    flex-shrink: 0;
  }

  .pff-name {
    flex: 1;
    font-size: 12px;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pff-count {
    min-width: 24px;
  }

  .pff-close {
    width: 24px;
    height: 100%;
    display: none;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: transparent;
    color: var(--text-dim);
    border: none;
    border-left: 1px solid transparent;
    cursor: var(--cursor-crosshair), crosshair;
    outline: none;
    transition: opacity 0.08s, color 0.08s, background 0.08s, border-color 0.08s;
  }

  &:hover .pff-close,
  &:focus-within .pff-close,
  .pff-close:focus-visible {
    display: inline-flex;
  }

  .pff-close:hover {
    color: var(--danger);
    background: rgba(255, 85, 85, 0.1);
    border-left-color: rgba(255, 85, 85, 0.35);
  }
`;
