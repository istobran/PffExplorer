import { css } from "@emotion/css";
import clsx from "clsx";
import { Volume2, VolumeX } from "lucide-react";
import { playUiHover, playUiPress } from "@/lib/sounds";

export type SoundToggleButtonProps = {
  muted: boolean;
  onToggle: () => void;
};

export function SoundToggleButton(props: SoundToggleButtonProps) {
  const Icon = props.muted ? VolumeX : Volume2;

  return (
    <button
      type="button"
      className={clsx(soundToggleButtonClass, props.muted && "muted")}
      title={props.muted ? "Unmute sounds" : "Mute sounds"}
      aria-label={props.muted ? "Unmute sounds" : "Mute sounds"}
      aria-pressed={props.muted}
      onClick={props.onToggle}
      onPointerEnter={playUiHover}
      onPointerDown={playUiPress}
    >
      <Icon size={14} />
    </button>
  );
}

const soundToggleButtonClass = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 26px;
  background: none;
  border: 1px solid var(--border);
  color: var(--green-dim);
  cursor: var(--cursor-crosshair), crosshair;
  outline: none;
  transition: all 0.08s;
  flex-shrink: 0;

  &:hover {
    background: var(--hover-row);
    color: var(--hover-text);
    border-color: var(--green-sel);
    box-shadow: none;
    text-shadow: var(--hover-text-glow);
  }

  &.muted {
    color: var(--danger);
    border-color: rgba(255, 85, 85, 0.45);
    background: rgba(200, 40, 40, 0.08);
  }

  &.muted:hover {
    color: var(--hover-text);
    border-color: var(--green-sel);
    background: var(--hover-row);
  }
`;
