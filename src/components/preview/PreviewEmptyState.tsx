import { css, keyframes } from "@emotion/css";
import type { LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export type PreviewEmptyStateProps = {
  message: string;
  icon?: LucideIcon;
  marker?: string;
  loading?: boolean;
};

export function PreviewEmptyState(props: PreviewEmptyStateProps) {
  return (
    <EmptyState
      icon={props.icon}
      marker={props.marker}
      leading={props.loading ? <div className={previewLoaderClass} /> : undefined}
    >
      {props.message}
    </EmptyState>
  );
}

const previewLoaderScroll = keyframes`
  from {
    background-position: 0 0;
  }

  to {
    background-position: 7px 0;
  }
`;

const previewLoaderClass = css`
  width: 120px;
  height: 8px;
  border: 1px solid var(--border-hi);
  background: repeating-linear-gradient(
    90deg,
    var(--green-sel) 0px,
    var(--green-sel) 5px,
    #004000 5px,
    #004000 7px
  );
  animation: ${previewLoaderScroll} 0.6s linear infinite;
`;
