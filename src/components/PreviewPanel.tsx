import { FileArchive } from "lucide-react";
import type { PreviewResponse, ResourceEntry } from "@/types";
import { BinaryPreview } from "@/components/preview/BinaryPreview";
import { PreviewBody } from "@/components/preview/PreviewBody";
import { PreviewEmptyState } from "@/components/preview/PreviewEmptyState";
import { PreviewMeta } from "@/components/preview/PreviewMeta";
import { PreviewTextLine } from "@/components/preview/PreviewTextLine";

export type PreviewPanelProps = {
  entry: ResourceEntry | null;
  preview: PreviewResponse | null;
  loading: boolean;
};

export function PreviewPanel(props: PreviewPanelProps) {
  if (!props.entry) {
    return <PreviewEmptyState icon={FileArchive} message="SELECT A RESOURCE TO PREVIEW" />;
  }

  if (props.loading) {
    return <PreviewEmptyState loading message="DECODING PREVIEW" />;
  }

  if (!props.preview) {
    return <PreviewEmptyState marker="!" message="NO PREVIEW DATA" />;
  }

  if (props.preview.status === "text" && props.preview.text != null) {
    const ext = props.entry.name.split(".").pop()?.toLowerCase() ?? "";
    const lines = props.preview.text.split("\n");

    return (
      <PreviewBody>
        <PreviewMeta entry={props.entry} preview={props.preview} />
        {lines.map((line, index) => (
          <PreviewTextLine
            key={`${index}-${line}`}
            line={line}
            lineNumber={index + 1}
            extension={ext}
          />
        ))}
      </PreviewBody>
    );
  }

  return (
    <PreviewBody>
      <PreviewMeta entry={props.entry} preview={props.preview} />
      <BinaryPreview
        title={props.preview.message ?? "BINARY FILE"}
        hexHead={props.preview.hexHead}
      />
    </PreviewBody>
  );
}
