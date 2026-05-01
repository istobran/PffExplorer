import { css } from "@emotion/css";

export type ToolbarSeparatorProps = Record<string, never>;

export function ToolbarSeparator(_props: ToolbarSeparatorProps) {
  return <div className={toolbarSeparatorClass} />;
}

const toolbarSeparatorClass = css`
  width: 1px;
  height: 16px;
  background: var(--border);
  flex-shrink: 0;
`;
