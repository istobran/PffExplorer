import { Music } from "lucide-react";
import { TitleIconToggleButton } from "@/components/titlebar/TitleIconToggleButton";

export type BackgroundMusicToggleButtonProps = {
  enabled: boolean;
  onToggle: () => void;
};

export function BackgroundMusicToggleButton(props: BackgroundMusicToggleButtonProps) {
  return (
    <TitleIconToggleButton
      active={props.enabled}
      activeTitle="Turn background music off"
      inactiveTitle="Turn background music on"
      icon={Music}
      offTone="dim"
      onToggle={props.onToggle}
    />
  );
}
