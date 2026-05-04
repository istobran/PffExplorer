import { Music } from "lucide-react";
import { TitleIconToggleButton } from "@/components/titlebar/TitleIconToggleButton";
import { useI18n } from "@/lib/i18n";

export type BackgroundMusicToggleButtonProps = {
  enabled: boolean;
  onToggle: () => void;
};

export function BackgroundMusicToggleButton(props: BackgroundMusicToggleButtonProps) {
  const { t } = useI18n();

  return (
    <TitleIconToggleButton
      active={props.enabled}
      activeTitle={t("title.music.off")}
      inactiveTitle={t("title.music.on")}
      icon={Music}
      offTone="dim"
      onToggle={props.onToggle}
    />
  );
}
