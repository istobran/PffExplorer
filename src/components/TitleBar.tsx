import { css } from "@emotion/css";
import type { MouseEvent } from "react";
import { FileArchive, FolderOpen, Minus, X } from "lucide-react";
import { BackgroundMusicToggleButton } from "@/components/titlebar/BackgroundMusicToggleButton";
import { LanguageToggleButton } from "@/components/titlebar/LanguageToggleButton";
import { NavButton } from "@/components/titlebar/NavButton";
import { SoundToggleButton } from "@/components/titlebar/SoundToggleButton";
import { TitleLogo } from "@/components/titlebar/TitleLogo";
import { WindowControlButton } from "@/components/titlebar/WindowControlButton";
import { useI18n, type Locale } from "@/lib/i18n";

export type TitleBarProps = {
  soundMuted: boolean;
  backgroundMusicEnabled: boolean;
  locale: Locale;
  onOpenProject: () => void;
  onOpenFile: () => void;
  onToggleSoundMuted: () => void;
  onToggleBackgroundMusic: () => void;
  onToggleLocale: () => void;
  onMinimize: () => void;
  onClose: () => void;
  onStartDrag: (event: MouseEvent<HTMLElement>) => void;
  onTitleDoubleClick: (event: MouseEvent<HTMLElement>) => void;
};

export function TitleBar(props: TitleBarProps) {
  const { t } = useI18n();

  return (
    <nav className={titleBarClass}>
      <NavButton
        icon={FolderOpen}
        title={t("title.openProject.title")}
        onClick={props.onOpenProject}
      >
        {t("title.openProject")}
      </NavButton>
      <NavButton
        icon={FileArchive}
        title={t("title.openFile.title")}
        onClick={props.onOpenFile}
      >
        {t("title.openFile")}
      </NavButton>
      <div
        className="nav-center"
        onMouseDown={props.onStartDrag}
        onDoubleClick={props.onTitleDoubleClick}
      >
        <div className="nav-title">
          {t("app.title")}
        </div>
      </div>
      <TitleLogo
        onStartDrag={props.onStartDrag}
        onDoubleClick={props.onTitleDoubleClick}
      />
      <BackgroundMusicToggleButton
        enabled={props.backgroundMusicEnabled}
        onToggle={props.onToggleBackgroundMusic}
      />
      <SoundToggleButton muted={props.soundMuted} onToggle={props.onToggleSoundMuted} />
      <LanguageToggleButton locale={props.locale} onToggle={props.onToggleLocale} />
      <div className="win-controls">
        <WindowControlButton
          icon={Minus}
          title={t("title.minimize")}
          onClick={props.onMinimize}
        />
        <WindowControlButton
          icon={X}
          title={t("title.close")}
          variant="close"
          onClick={props.onClose}
        />
      </div>
    </nav>
  );
}

const titleBarClass = css`
  display: flex;
  align-items: center;
  height: 42px;
  flex-shrink: 0;
  background: #030803;
  border-bottom: 2px solid var(--border-hi);
  padding: 0 12px;
  gap: 8px;

  .nav-center {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    height: 100%;
    cursor: var(--cursor-crosshair), crosshair;
  }

  .nav-title {
    font-family: var(--font-vt);
    font-size: 22px;
    letter-spacing: 5px;
    color: var(--title);
    text-transform: uppercase;
    text-shadow: 0 0 14px rgba(85, 255, 85, 0.55), 0 0 28px rgba(85, 255, 85, 0.2);
    white-space: nowrap;
    -webkit-user-select: none;
    user-select: none;
  }

  .win-controls {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;

    &::before {
      content: "";
      width: 1px;
      height: 30px;
      margin-right: 6px;
      background: var(--border);
      flex-shrink: 0;
    }
  }

  @media (max-width: 1100px) {
    .nav-title {
      font-size: 18px;
      letter-spacing: 3px;
    }
  }
`;
