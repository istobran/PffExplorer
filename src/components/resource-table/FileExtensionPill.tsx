import { css } from "@emotion/css";
import { fileExtensionLabel } from "@/lib/format";

export type FileExtensionPillProps = {
  name: string;
};

export function FileExtensionPill(props: FileExtensionPillProps) {
  return <span className={fileExtensionPillClass}>{fileExtensionLabel(props.name)}</span>;
}

const fileExtensionPillClass = css`
  font-size: 9px;
  padding: 0 5px;
  height: 14px;
  display: flex;
  align-items: center;
  border: 1px solid var(--border);
  color: var(--green-dim);
  letter-spacing: 0.5px;
`;
