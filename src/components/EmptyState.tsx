import clsx from "clsx";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { css } from "@emotion/css";

export type EmptyStateProps = {
  icon?: LucideIcon;
  marker?: ReactNode;
  leading?: ReactNode;
  children: ReactNode;
  compact?: boolean;
};

export function EmptyState(props: EmptyStateProps) {
  const Icon = props.icon;

  return (
    <div className={clsx(emptyStateClass, props.compact && "compact")}>
      {props.leading}
      {Icon && <Icon className="empty-icon" size={props.compact ? 20 : 24} />}
      {props.marker && <span className="empty-icon">{props.marker}</span>}
      <span>{props.children}</span>
    </div>
  );
}

const emptyStateClass = css`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: var(--text-dim);
  font-size: 11px;
  letter-spacing: 2px;
  text-transform: uppercase;
  flex-direction: column;
  gap: 8px;
  min-height: 0;

  &.compact {
    padding: 28px 8px;
    text-align: center;
  }

  .empty-icon {
    opacity: 0.35;
  }
`;
