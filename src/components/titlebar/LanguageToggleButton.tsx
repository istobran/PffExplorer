import { Languages } from "lucide-react";
import { TitleIconToggleButton } from "@/components/titlebar/TitleIconToggleButton";
import { useI18n, type Locale } from "@/lib/i18n";

export type LanguageToggleButtonProps = {
  locale: Locale;
  onToggle: () => void;
};

export function LanguageToggleButton(props: LanguageToggleButtonProps) {
  const { t } = useI18n();

  return (
    <TitleIconToggleButton
      active={props.locale === "zh-CN"}
      activeTitle={t("title.language.toEnglish")}
      inactiveTitle={t("title.language.toChinese")}
      icon={Languages}
      offTone="dim"
      onToggle={props.onToggle}
    />
  );
}
