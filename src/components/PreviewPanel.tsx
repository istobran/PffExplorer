import { FileArchive } from "lucide-react";
import type { PreviewResponse, ResourceEntry } from "@/types";
import { BinaryPreview } from "@/components/preview/BinaryPreview";
import {
  ImagePreviewDisplay,
  ImagePreviewLoadingBox,
} from "@/components/preview/ImagePreviewDisplay";
import { PreviewBody } from "@/components/preview/PreviewBody";
import { PreviewEmptyState } from "@/components/preview/PreviewEmptyState";
import { PreviewMeta } from "@/components/preview/PreviewMeta";
import { PreviewTextBlock, PreviewTextLoading } from "@/components/preview/PreviewTextBlock";

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
    if (isPreviewableImageName(props.entry.name)) {
      return (
        <PreviewBody compact>
          <ImagePreviewLoadingBox />
        </PreviewBody>
      );
    }

    if (isPreviewableTextName(props.entry.name)) {
      return (
        <PreviewBody>
          <PreviewTextLoading message="正在加载文本预览..." />
        </PreviewBody>
      );
    }

    return <PreviewEmptyState loading message="DECODING PREVIEW" />;
  }

  if (!props.preview) {
    return <PreviewEmptyState marker="!" message="NO PREVIEW DATA" />;
  }

  if (props.preview.status === "text" && props.preview.text != null) {
    const ext = props.entry.name.split(".").pop()?.toLowerCase() ?? "";

    return (
      <PreviewBody>
        <PreviewMeta entry={props.entry} preview={props.preview} />
        <PreviewTextBlock
          text={props.preview.text}
          extension={ext}
          animationKey={`${props.entry.archivePath}::${props.entry.tableIndex}`}
        />
      </PreviewBody>
    );
  }

  if (props.preview.status === "image" && props.preview.image != null) {
    return (
      <PreviewBody compact>
        <PreviewMeta entry={props.entry} preview={props.preview} />
        <ImagePreviewDisplay
          image={props.preview.image}
          name={props.entry.name}
          animationKey={`${props.entry.archivePath}::${props.entry.tableIndex}`}
        />
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

function isPreviewableImageName(name: string) {
  return matchesExtension(
    name,
    "pcx",
    "tga",
    "dds",
    "bmp",
    "png",
    "jpg",
    "jpeg",
    "gif",
    "tif",
    "tiff",
    "mdt",
  );
}

function isPreviewableTextName(name: string) {
  return matchesExtension(
    name,
    "lua",
    "xml",
    "cfg",
    "ini",
    "txt",
    "def",
    "adm",
    "lst",
    "fx",
    "vsh",
    "psh",
    "json",
    "csv",
    "toml",
  );
}

function matchesExtension(name: string, ...extensions: string[]) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return extensions.includes(ext);
}
