import { css } from "@emotion/css";
import clsx from "clsx";
import type { ReactNode } from "react";

export type PreviewBodyProps = {
  compact?: boolean;
  children: ReactNode;
};

export function PreviewBody(props: PreviewBodyProps) {
  return (
    <div id="preview-body" className={clsx(previewBodyClass, props.compact && "compact")}>
      {props.children}
    </div>
  );
}

const previewBodyClass = css`
  flex: 1;
  overflow: auto;
  padding: 8px 12px;
  font-size: 12px;
  line-height: 1.6;
  letter-spacing: 0.3px;
  color: var(--green);
  background: var(--surface-bg);
  box-shadow: inset 0 0 30px rgba(0, 0, 0, 0.18);

  &.compact {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
`;
