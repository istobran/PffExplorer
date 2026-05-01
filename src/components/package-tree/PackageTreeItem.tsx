import { css } from "@emotion/css";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";

export type PackageTreeItemProps = {
  icon: LucideIcon;
  label: string;
  count: number;
  active: boolean;
  all?: boolean;
  title?: string;
  onClick: () => void;
};

export function PackageTreeItem(props: PackageTreeItemProps) {
  const Icon = props.icon;

  return (
    <button
      type="button"
      className={clsx(packageTreeItemClass, props.all && "all-node", props.active && "active")}
      onClick={props.onClick}
      title={props.title}
    >
      <Icon className="pff-icon" size={props.all ? 15 : 14} />
      <span className="pff-name">{props.label}</span>
      <span className="pff-count">{props.count}</span>
    </button>
  );
}

const packageTreeItemClass = css`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 30px;
  padding: 0 10px;
  background: transparent;
  color: var(--green);
  border: none;
  border-bottom: 1px solid transparent;
  cursor: pointer;
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
    color: var(--green-hi);
  }

  &:hover::after {
    background: var(--green-dim);
  }

  &.active {
    background: var(--sel-row);
    color: var(--green-hi);
    border-bottom-color: var(--border);
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

  .pff-icon {
    color: var(--green-dim);
    flex-shrink: 0;
  }

  .pff-name {
    flex: 1;
    font-size: 11px;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pff-count {
    font-size: 9px;
    color: var(--text-dim);
    letter-spacing: 0.5px;
    background: #0a1a0a;
    border: 1px solid var(--border);
    padding: 0 4px;
  }
`;
