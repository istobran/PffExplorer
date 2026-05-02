import { css } from "@emotion/css";
import clsx from "clsx";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { ImagePreview } from "@/types";

const RADAR_STEPS = 8;
const RADAR_STEP_DELAY_MS = 20;
const RADAR_BOX_ANIMATION_MS = 160;
const RADAR_ANIMATION_MS = (RADAR_STEPS - 1) * RADAR_STEP_DELAY_MS + RADAR_BOX_ANIMATION_MS + 380;

export type ImagePreviewDisplayProps = {
  image: ImagePreview;
  name: string;
  animationKey: string;
};

export function ImagePreviewDisplay(props: ImagePreviewDisplayProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [animationDone, setAnimationDone] = useState(false);
  const revealed = imageLoaded && animationDone;

  useEffect(() => {
    setImageLoaded(false);
    setAnimationDone(false);

    if (imageRef.current?.complete && imageRef.current.naturalWidth > 0) {
      setImageLoaded(true);
    }

    const timer = window.setTimeout(() => {
      setAnimationDone(true);
    }, RADAR_ANIMATION_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [props.animationKey]);

  return (
    <div className={imagePreviewDisplayClass}>
      <div
        key={props.animationKey}
        className="image-frame"
        style={{
          aspectRatio: `${props.image.width} / ${props.image.height}`,
        }}
      >
        <div className="radar-loader" aria-hidden="true">
          {Array.from({ length: RADAR_STEPS }).map((_, index) => {
            const scale = 0.12 + (index / (RADAR_STEPS - 1)) * 0.88;
            const size = Math.round(scale * 100);
            const style = {
              "--s": scale,
              width: `${size}%`,
              height: `${size}%`,
              animationDelay: `${index * RADAR_STEP_DELAY_MS}ms`,
              animationDuration: `${RADAR_BOX_ANIMATION_MS}ms`,
            } as CSSProperties;

            return <span key={index} className="radar-box" style={style} />;
          })}
        </div>
        <img
          ref={imageRef}
          className={clsx(revealed && "revealed")}
          src={props.image.dataUrl}
          alt={props.name}
          onLoad={() => setImageLoaded(true)}
        />
      </div>
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

  .radar-loader {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 2;
    animation: radar-loader-fade 1.7s ease-out forwards;
  }

  .radar-box {
    position: absolute;
    border: 1.5px solid var(--green-sel);
    opacity: 0;
    transform: scale(0.08);
    box-shadow: 0 0 6px rgba(0, 204, 0, 0.4), inset 0 0 6px rgba(0, 204, 0, 0.1);
    animation: radar-expand ease-out forwards;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    position: relative;
    z-index: 1;
    image-rendering: pixelated;
    filter: sepia(0.2) hue-rotate(80deg) saturate(1.4) brightness(0.9);
    transition: opacity 0.35s ease;
  }

  img.revealed {
    opacity: 1;
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
