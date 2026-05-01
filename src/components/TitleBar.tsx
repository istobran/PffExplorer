import { css } from "@emotion/css";
import { FileArchive, FolderOpen, Minus, Square, X } from "lucide-react";
import { NavButton } from "@/components/titlebar/NavButton";
import { TitleLogo } from "@/components/titlebar/TitleLogo";
import { WindowControlButton } from "@/components/titlebar/WindowControlButton";

export type TitleBarProps = {
  onOpenProject: () => void;
  onOpenFile: () => void;
  onMinimize: () => void;
  onToggleMaximize: () => void;
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
      <div className="win-controls">
        <WindowControlButton icon={Minus} title="Minimize" onClick={props.onMinimize} />
        <WindowControlButton
          icon={Square}
          title="Maximize"
          onClick={props.onToggleMaximize}
        />
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
  }

  .win-controls {
    display: flex;
    align-items: center;
    gap: 2px;
    padding-left: 14px;
    border-left: 1px solid var(--border);
    height: 100%;
    flex-shrink: 0;
  }

  @media (max-width: 1100px) {
    .nav-title {
      font-size: 18px;
      letter-spacing: 3px;
    }
  }
`;
