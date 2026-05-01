import { css } from "@emotion/css";
import type { PreviewResponse, ResourceEntry } from "@/types";
import { formatBytes } from "@/lib/format";

export type PreviewMetaProps = {
  entry: ResourceEntry;
  preview: PreviewResponse;
};

export function PreviewMeta(props: PreviewMetaProps) {
  return (
    <div className={previewMetaClass}>
      <span>{formatBytes(props.preview.byteLen)}</span>
      <span>{props.entry.kind}</span>
      <span>
        {props.preview.transforms.length ? props.preview.transforms.join(" + ") : "RAW"}
      </span>
    </div>
  );
}

const previewMetaClass = css`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-bottom: 8px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--border);

  span {
    font-size: 9px;
    color: var(--green-dim);
    border: 1px solid var(--border);
    padding: 0 5px;
    letter-spacing: 1px;
  }
`;
