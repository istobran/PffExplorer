import { css } from "@emotion/css";
import type { PreviewResponse, ResourceEntry } from "@/types";
import { fileExtensionLabel, formatBytes } from "@/lib/format";
import { Tag } from "@/components/Tag";

export type PreviewMetaProps = {
  entry: ResourceEntry;
  preview: PreviewResponse;
};

export function PreviewMeta(props: PreviewMetaProps) {
  return (
    <div className={previewMetaClass}>
      <Tag>{formatBytes(props.preview.byteLen)}</Tag>
      <Tag>{fileExtensionLabel(props.entry.name)}</Tag>
      <Tag>
        {props.preview.transforms.length
          ? props.preview.transforms.map(sourceTransformLabel).join(" + ")
          : "RAW"}
      </Tag>
      {props.preview.image && (
        <Tag active>
          {props.preview.image.width}x{props.preview.image.height}
        </Tag>
      )}
      {props.preview.audio && <Tag active>{props.preview.audio.codec}</Tag>}
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
`;

function sourceTransformLabel(transform: string) {
  return transform.split("->", 1)[0].trim() || transform;
}
