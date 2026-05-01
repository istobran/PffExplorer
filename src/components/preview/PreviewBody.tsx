import { css } from "@emotion/css";
import type { ReactNode } from "react";

export type PreviewBodyProps = {
  children: ReactNode;
};

export function PreviewBody(props: PreviewBodyProps) {
  return (
    <div id="preview-body" className={previewBodyClass}>
      {props.children}
    </div>
  );
}

const previewBodyClass = css`
  flex: 1;
  overflow: auto;
  padding: 8px 12px;
  font-size: 11px;
  line-height: 1.6;
  letter-spacing: 0.3px;
  color: var(--green);
`;
