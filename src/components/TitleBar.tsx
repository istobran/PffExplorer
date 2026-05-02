import { css } from "@emotion/css";
import { FileArchive, FolderOpen, Minus, X } from "lucide-react";
import { BackgroundMusicToggleButton } from "@/components/titlebar/BackgroundMusicToggleButton";
import { NavButton } from "@/components/titlebar/NavButton";
import { SoundToggleButton } from "@/components/titlebar/SoundToggleButton";
import { TitleLogo } from "@/components/titlebar/TitleLogo";
import { WindowControlButton } from "@/components/titlebar/WindowControlButton";

export type TitleBarProps = {
  soundMuted: boolean;
  backgroundMusicEnabled: boolean;
  onOpenProject: () => void;
  onOpenFile: () => void;
  onToggleSoundMuted: () => void;
  onToggleBackgroundMusic: () => void;
  onMinimize: () => void;
  onClose: () => void;
};

export function TitleBar(props: TitleBarProps) {
  return (
    <nav className={titleBarClass}>
      <NavButton icon={FolderOpen} title="Open game directory" onClick={props.onOpenProject}>
        OPEN PROJECT
      </NavButton>
      <NavButton icon={FileArchive} title="Open single PFF file" onClick={props.onOpenFile}>
        OPEN FILE
      </NavButton>
      <div className="nav-center" data-tauri-drag-region>
        <div className="nav-title">PFF RESOURCE EXPLORER</div>
      </div>
      <TitleLogo />
      <BackgroundMusicToggleButton
        enabled={props.backgroundMusicEnabled}
        onToggle={props.onToggleBackgroundMusic}
      />
      <SoundToggleButton muted={props.soundMuted} onToggle={props.onToggleSoundMuted} />
      <div className="win-controls">
        <WindowControlButton icon={Minus} title="Minimize" onClick={props.onMinimize} />
        <WindowControlButton icon={X} title="Close" variant="close" onClick={props.onClose} />
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
