import { css } from "@emotion/css";
import clsx from "clsx";

export type PanelCornersProps = Record<string, never>;

export function PanelCorners(_props: PanelCornersProps) {
  return (
    <>
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
  z-index: 2;
  pointer-events: none;

  &.corner-br {
    right: -1px;
    bottom: -1px;
    border-left: none;
    border-top: none;
  }

  &.corner-tr {
    top: -1px;
    right: -1px;
    border-left: none;
    border-bottom: none;
  }

  &.corner-bl {
    bottom: -1px;
    left: -1px;
    border-right: none;
    border-top: none;
  }
`;
