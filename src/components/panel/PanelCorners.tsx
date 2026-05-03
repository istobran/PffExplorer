import { css } from "@emotion/css";
import clsx from "clsx";

export type PanelCornersProps = Record<string, never>;

export function PanelCorners(_props: PanelCornersProps) {
  return (
    <>
      <div className={clsx(panelCornerClass, "corner-tl")} />
      <div className={clsx(panelCornerClass, "corner-br")} />
      <div className={clsx(panelCornerClass, "corner-tr")} />
      <div className={clsx(panelCornerClass, "corner-bl")} />
    </>
  );
}

const panelCornerClass = css`
  position: absolute;
  width: 12px;
  height: 12px;
  border: 3px solid var(--green-sel);
  z-index: 8;
  pointer-events: none;

  &.corner-tl {
    top: 0;
    left: 0;
    border-right: none;
    border-bottom: none;
  }

  &.corner-br {
    right: 0;
    bottom: 0;
    border-left: none;
    border-top: none;
  }

  &.corner-tr {
    top: 0;
    right: 0;
    border-left: none;
    border-bottom: none;
  }

  &.corner-bl {
    bottom: 0;
    left: 0;
    border-right: none;
    border-top: none;
  }
`;
