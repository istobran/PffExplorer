import { Volume2, VolumeX } from "lucide-react";
import { TitleIconToggleButton } from "@/components/titlebar/TitleIconToggleButton";

export type SoundToggleButtonProps = {
  muted: boolean;
  onToggle: () => void;
};

export function SoundToggleButton(props: SoundToggleButtonProps) {
  const Icon = props.muted ? VolumeX : Volume2;

  return (
    <TitleIconToggleButton
      active={!props.muted}
      activeTitle="Mute sounds"
      inactiveTitle="Unmute sounds"
      icon={Icon}
      offTone="danger"
      onToggle={props.onToggle}
    />
  );
}
