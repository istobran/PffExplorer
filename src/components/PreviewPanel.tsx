import { css } from "@emotion/css";
import { FileArchive } from "lucide-react";
import { useEffect, useState } from "react";
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
import { playMissionBriefingSelect, playUiHover } from "@/lib/sounds";

export type PreviewPanelProps = {
  entry: ResourceEntry | null;
  preview: PreviewResponse | null;
  loading: boolean;
};

export function PreviewPanel(props: PreviewPanelProps) {
  const [nightVision, setNightVision] = useState(true);
  const imagePreviewActive =
    !props.loading && props.preview?.status === "image" && props.preview.image != null;

  useEffect(() => {
    if (!imagePreviewActive) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "n") return;
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditableShortcutTarget(event.target)) return;

      event.preventDefault();
      playMissionBriefingSelect();
      setNightVision((current) => !current);
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [imagePreviewActive]);

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
        <div className={imagePreviewHeaderClass}>
          <PreviewMeta entry={props.entry} preview={props.preview} />
          <ImagePreviewModeToggle value={nightVision} onChange={setNightVision} />
        </div>
        <ImagePreviewDisplay
          image={props.preview.image}
          name={props.entry.name}
          animationKey={`${props.entry.archivePath}::${props.entry.tableIndex}`}
          nightVision={nightVision}
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

function isEditableShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select"
  );
}

type ImagePreviewModeToggleProps = {
  value: boolean;
  onChange: (value: boolean) => void;
};

function ImagePreviewModeToggle(props: ImagePreviewModeToggleProps) {
  return (
    <div className={imagePreviewModeToggleClass} role="group" aria-label="Image preview mode">
      <button
        type="button"
        className={props.value ? "active" : undefined}
        aria-pressed={props.value}
        title="Night vision preview"
        onClick={() => props.onChange(true)}
        onPointerEnter={playUiHover}
        onPointerDown={playMissionBriefingSelect}
      >
        NV
      </button>
      <button
        type="button"
        className={!props.value ? "active" : undefined}
        aria-pressed={!props.value}
        title="Original color preview"
        onClick={() => props.onChange(false)}
        onPointerEnter={playUiHover}
        onPointerDown={playMissionBriefingSelect}
      >
        RGB
      </button>
    </div>
  );
}

const imagePreviewHeaderClass = css`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding-bottom: 8px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--border);

  > :first-child {
    flex: 1;
    min-width: 0;
    padding-bottom: 0;
    margin-bottom: 0;
    border-bottom: 0;
  }
`;

const imagePreviewModeToggleClass = css`
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  border: 1px solid var(--border-hi);
  background: #061206;
  height: 18px;

  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 16px;
    min-width: 38px;
    padding: 0 8px;
    border: 0;
    border-right: 1px solid var(--border-hi);
    background: transparent;
    color: var(--text-dim);
    font: inherit;
    font-size: 10px;
    line-height: 1;
    letter-spacing: 0.6px;
    cursor: pointer;
  }

  button:last-child {
    border-right: 0;
  }

  button:hover {
    color: var(--hover-text);
    background: var(--hover-row);
    font-weight: var(--hover-text-weight);
    text-shadow: var(--hover-text-glow);
  }

  button.active {
    color: var(--green-sel);
    background: rgba(0, 204, 0, 0.16);
    box-shadow: inset 0 0 8px rgba(0, 204, 0, 0.16);
  }
`;
