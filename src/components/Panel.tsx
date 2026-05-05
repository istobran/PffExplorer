import type { ReactNode } from "react";
import { css } from "@emotion/css";
import { PanelCorners } from "@/components/panel/PanelCorners";

export type PanelProps = {
  id: string;
  title: string;
  sub: string;
  children: ReactNode;
};

export function Panel(props: PanelProps) {
  return (
    <section className={panelClass} id={props.id}>
      <PanelCorners />
      <header className="panel-header">
        <div className="panel-title">{props.title}</div>
        <div className="panel-sub">{props.sub}</div>
      </header>
      {props.children}
    </section>
  );
}

const panelClass = css`
  background: var(--panel-bg);
  border: 1px solid var(--border-hi);
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;

  .panel-header {
    display: flex;
    align-items: center;
    height: 26px;
    background: var(--panel-header-bg);
    border-bottom: 1px solid var(--border-hi);
    padding: 0 10px;
    flex-shrink: 0;
    gap: 8px;
    -webkit-user-select: none;
    user-select: none;
  }

  .panel-title {
    font-family: var(--font-vt);
    font-size: 16px;
    letter-spacing: 2px;
    color: var(--title);
    text-transform: uppercase;
    text-shadow: 0 0 8px rgba(85, 255, 85, 0.35);
  }

  .panel-sub {
    font-size: 10px;
    color: var(--text-dim);
    letter-spacing: 1px;
    margin-left: auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;
