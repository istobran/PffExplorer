import { css } from "@emotion/css";
import { convertFileSrc } from "@tauri-apps/api/core";
import clsx from "clsx";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { ImagePreview } from "@/types";
import { useI18n } from "@/lib/i18n";
import { playImageReveal } from "@/lib/sounds";

const RADAR_STEPS = 8;
const RADAR_LOOP_STEP_DELAY_MS = 72;
const RADAR_LOOP_SWEEP_MS = 640;
const RADAR_REVEAL_STEP_DELAY_MS = 20;
const RADAR_REVEAL_BOX_ANIMATION_MS = 160;
const RADAR_REVEAL_MS =
  (RADAR_STEPS - 1) * RADAR_REVEAL_STEP_DELAY_MS + RADAR_REVEAL_BOX_ANIMATION_MS + 20;

export type ImagePreviewDisplayProps = {
  image: ImagePreview;
  name: string;
  animationKey: string;
  nightVision: boolean;
};

export function ImagePreviewLoadingBox() {
  return (
    <div className={imagePreviewDisplayClass}>
      <div className="image-frame loading-frame square-radar-frame">
        <RadarLoader />
      </div>
    </div>
  );
}

export function ImagePreviewDisplay(props: ImagePreviewDisplayProps) {
  const { t } = useI18n();
  const imageSrc = useMemo(() => {
    if (props.image.filePath) return convertFileSrc(props.image.filePath);
    return props.image.dataUrl;
  }, [props.image.dataUrl, props.image.filePath]);
  const [decodedSrc, setDecodedSrc] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [revealDone, setRevealDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.decoding = "async";

    setDecodedSrc(null);
    setLoadFailed(false);
    setRevealDone(false);

    if (!imageSrc) {
      setLoadFailed(true);
      return;
    }

    const src = imageSrc;

    async function decodeImage() {
      image.src = src;

      try {
        if (image.decode) {
          await image.decode();
        } else if (!image.complete) {
          await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = () => reject(new Error("image load failed"));
          });
        }

        if (!cancelled) setDecodedSrc(src);
      } catch {
        if (!cancelled) setLoadFailed(true);
      }
    }

    void decodeImage();

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
      image.src = "";
    };
  }, [imageSrc, props.animationKey]);

  useEffect(() => {
    setRevealDone(false);

    if (!decodedSrc || loadFailed) return;

    playImageReveal();

    const timer = window.setTimeout(() => {
      setRevealDone(true);
    }, RADAR_REVEAL_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [decodedSrc, loadFailed, props.animationKey]);

  const loading = !decodedSrc && !loadFailed;
  const revealing = Boolean(decodedSrc && !loadFailed && !revealDone);
  const imageVisible = Boolean(decodedSrc && !loadFailed && revealDone);

  return (
    <div className={imagePreviewDisplayClass}>
      <div
        key={props.animationKey}
        className="image-frame"
        style={{
          aspectRatio: `${props.image.width} / ${props.image.height}`,
        }}
      >
        {loading && <RadarLoader mode="loop" />}
        {revealing && <RadarLoader key={`${props.animationKey}-reveal`} mode="reveal" />}
        {decodedSrc && !loadFailed && (
          <img
            className={clsx(imageVisible && "revealed", props.nightVision && "night-vision")}
            src={decodedSrc}
            alt={props.name}
          />
        )}
        {loadFailed && <div className="image-load-error">{t("preview.imageFailed")}</div>}
      </div>
    </div>
  );
}

type RadarLoaderProps = {
  mode?: "loop" | "reveal";
};

function RadarLoader({ mode = "loop" }: RadarLoaderProps) {
  const reveal = mode === "reveal";
  const stepDelay = reveal ? RADAR_REVEAL_STEP_DELAY_MS : RADAR_LOOP_STEP_DELAY_MS;
  const animationDuration = reveal ? RADAR_REVEAL_BOX_ANIMATION_MS : RADAR_LOOP_SWEEP_MS;

  return (
    <div className={clsx("radar-loader", mode)} aria-hidden="true">
      {Array.from({ length: RADAR_STEPS }).map((_, index) => {
        const scale = 0.12 + (index / (RADAR_STEPS - 1)) * 0.88;
        const size = Math.round(scale * 100);
        const style = {
          "--s": scale,
          width: `${size}%`,
          height: `${size}%`,
          animationDelay: `${index * stepDelay}ms`,
          animationDuration: `${animationDuration}ms`,
        } as CSSProperties;

        return <span key={index} className={clsx("radar-box", mode)} style={style} />;
      })}
    </div>
  );
}

const imagePreviewDisplayClass = css`
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;

  .image-frame {
    width: 100%;
    max-width: 100%;
    max-height: 100%;
    position: relative;
    overflow: hidden;
  }

  .loading-frame {
    min-height: 0;
  }

  .square-radar-frame {
    width: min(62%, 340px);
    aspect-ratio: 1 / 1;
    max-height: min(76%, 340px);
  }

  .radar-loader {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 2;
  }

  .radar-loader.reveal {
    animation: radar-loader-fade ${RADAR_REVEAL_MS}ms ease-out forwards;
  }

  .radar-box {
    position: absolute;
    border: 1.5px solid var(--green-sel);
    opacity: 0;
    transform: scale(0.04);
    box-shadow: 0 0 6px rgba(0, 204, 0, 0.4), inset 0 0 6px rgba(0, 204, 0, 0.1);
  }

  .radar-box.loop {
    animation-name: radar-sweep;
    animation-timing-function: ease-out;
    animation-iteration-count: infinite;
  }

  .radar-box.reveal {
    animation-name: radar-expand;
    animation-timing-function: ease-out;
    animation-fill-mode: forwards;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    position: relative;
    z-index: 1;
    image-rendering: pixelated;
  }

  img.revealed {
    opacity: 1;
  }

  img.night-vision {
    filter: grayscale(1) sepia(1) hue-rotate(58deg) saturate(4.5) brightness(0.96);
  }

  .image-load-error {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--green-hi);
    font-size: 12px;
    letter-spacing: 1px;
    text-shadow: var(--hover-text-glow);
  }

  @keyframes radar-sweep {
    0% {
      opacity: 0;
      transform: scale(0.04);
    }

    8% {
      opacity: 0;
      transform: scale(0.04);
    }

    18% {
      opacity: 0.9;
      transform: scale(var(--s));
    }

    48% {
      opacity: 0.68;
      transform: scale(var(--s));
    }

    62% {
      opacity: 0;
      transform: scale(var(--s));
    }

    100% {
      opacity: 0;
      transform: scale(var(--s));
    }
  }

  @keyframes radar-expand {
    0% {
      opacity: 0;
      transform: scale(0.05);
    }

    15% {
      opacity: 0.9;
      transform: scale(var(--s));
    }

    60% {
      opacity: 0.7;
      transform: scale(var(--s));
    }

    100% {
      opacity: 0;
      transform: scale(var(--s));
    }
  }

  @keyframes radar-loader-fade {
    0%,
    82% {
      opacity: 1;
    }

    100% {
      opacity: 0;
    }
  }
`;
