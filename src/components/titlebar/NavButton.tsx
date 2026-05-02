import { css } from "@emotion/css";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type NavButtonProps = {
  icon: LucideIcon;
  title: string;
  onClick: () => void;
  children: ReactNode;
};

export function NavButton(props: NavButtonProps) {
  const Icon = props.icon;

  return (
    <button className={navButtonClass} onClick={props.onClick} title={props.title}>
      <Icon size={14} />
      <span>{props.children}</span>
    </button>
  );
}

const navButtonClass = css`
  display: flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 14px;
  background: #0a160a;
  border: 1px solid var(--border-hi);
  color: var(--green-dim);
  font-size: 11px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  cursor: var(--cursor-crosshair), crosshair;
  outline: none;
  position: relative;
  transition: all 0.1s;

  &:hover {
    background: var(--hover-row);
    color: var(--hover-text);
    border-color: var(--green-sel);
    box-shadow: none;
    text-shadow: var(--hover-text-glow);
  }

  &::before {
    content: "";
    position: absolute;
    top: -1px;
    left: -1px;
    width: 6px;
    height: 6px;
    border: 2px solid var(--green-sel);
    border-right: none;
    border-bottom: none;
  }

  &::after {
    content: "";
    position: absolute;
    right: -1px;
    bottom: -1px;
    width: 6px;
    height: 6px;
    border: 2px solid var(--green-sel);
    border-left: none;
    border-top: none;
  }
`;
