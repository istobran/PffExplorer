import { css } from "@emotion/css";
import { FileArchive } from "lucide-react";
import { useEffect } from "react";
import type { PreviewResponse, ResourceEntry } from "@/types";
import { BinaryPreview } from "@/components/preview/BinaryPreview";
import {
  AudioPreviewDisplay,
  AudioPreviewLoadingBox,
} from "@/components/preview/AudioPreviewDisplay";
import {
  ImagePreviewDisplay,
  ImagePreviewLoadingBox,
} from "@/components/preview/ImagePreviewDisplay";
import { PreviewBody } from "@/components/preview/PreviewBody";
import { PreviewEmptyState } from "@/components/preview/PreviewEmptyState";
import { PreviewMeta } from "@/components/preview/PreviewMeta";
import { PreviewTextBlock, PreviewTextLoading } from "@/components/preview/PreviewTextBlock";
import { useI18n } from "@/lib/i18n";
import { isPlainAppShortcut } from "@/lib/shortcutPolicy";
import {
  playMissionBriefingSelect,
  playUiHover,
  resumeDf1MenuMusic,
  suspendDf1MenuMusic,
} from "@/lib/sounds";

export type PreviewPanelProps = {
  entry: ResourceEntry | null;
  preview: PreviewResponse | null;
  loading: boolean;
  nightVision: boolean;
  onNightVisionChange: (nightVision: boolean) => void;
};

export function PreviewPanel(props: PreviewPanelProps) {
  const { t } = useI18n();
  const nightVision = props.nightVision;
  const onNightVisionChange = props.onNightVisionChange;
  const imagePreviewActive =
    !props.loading && props.preview?.status === "image" && props.preview.image != null;
  const audioPreviewActive =
    props.entry != null &&
    isPreviewableAudioName(props.entry.name) &&
    (props.loading || (props.preview?.status === "audio" && props.preview.audio != null));

  useEffect(() => {
    if (!imagePreviewActive) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (!isPlainAppShortcut(event, ["n"])) return;

      event.preventDefault();
      playMissionBriefingSelect();
      onNightVisionChange(!nightVision);
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [imagePreviewActive, nightVision, onNightVisionChange]);

  useEffect(() => {
    if (!audioPreviewActive) return;

    suspendDf1MenuMusic();

    return () => {
      resumeDf1MenuMusic();
    };
  }, [audioPreviewActive]);

  if (!props.entry) {
    return <PreviewEmptyState icon={FileArchive} message={t("preview.select")} />;
  }

  if (props.loading) {
    if (isPreviewableAudioName(props.entry.name)) {
      return (
        <PreviewBody compact>
          <AudioPreviewLoadingBox />
        </PreviewBody>
      );
    }

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
          <PreviewTextLoading message={t("preview.loading.text")} />
        </PreviewBody>
      );
    }

    return <PreviewEmptyState loading message={t("preview.decoding")} />;
  }

  if (!props.preview) {
    return <PreviewEmptyState marker="!" message={t("preview.noData")} />;
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
          <ImagePreviewModeToggle
            value={nightVision}
            onChange={onNightVisionChange}
          />
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

  if (props.preview.status === "audio" && props.preview.audio != null) {
    return (
      <PreviewBody compact>
        <PreviewMeta entry={props.entry} preview={props.preview} />
        <AudioPreviewDisplay
          audio={props.preview.audio}
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
        title={props.preview.message ?? t("preview.binary")}
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

function isPreviewableAudioName(name: string) {
  return matchesExtension(name, "wav");
}

function matchesExtension(name: string, ...extensions: string[]) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return extensions.includes(ext);
}

type ImagePreviewModeToggleProps = {
  value: boolean;
  onChange: (value: boolean) => void;
};

function ImagePreviewModeToggle(props: ImagePreviewModeToggleProps) {
  const { t } = useI18n();

  return (
    <div className={imagePreviewModeToggleClass} role="group" aria-label={t("preview.imageMode")}>
      <button
        type="button"
        className={props.value ? "active" : undefined}
        aria-pressed={props.value}
        title={t("preview.nightVision")}
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
        title={t("preview.originalColor")}
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
    background: var(--sel-row);
    font-weight: var(--hover-text-weight);
    text-shadow: var(--hover-text-glow);
  }

  button.active {
    color: var(--green-sel);
    background: rgba(0, 204, 0, 0.16);
    box-shadow: inset 0 0 8px rgba(0, 204, 0, 0.16);
  }
`;
