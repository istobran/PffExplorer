import { Volume2, VolumeX } from "lucide-react";
import { TitleIconToggleButton } from "@/components/titlebar/TitleIconToggleButton";
import { useI18n } from "@/lib/i18n";

export type SoundToggleButtonProps = {
  muted: boolean;
  onToggle: () => void;
};

export function SoundToggleButton(props: SoundToggleButtonProps) {
  const { t } = useI18n();
  const Icon = props.muted ? VolumeX : Volume2;

  return (
    <TitleIconToggleButton
      active={!props.muted}
      activeTitle={t("title.sound.mute")}
      inactiveTitle={t("title.sound.unmute")}
      icon={Icon}
      offTone="danger"
      onToggle={props.onToggle}
    />
  );
}
