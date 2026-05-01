import { css } from "@emotion/css";
import type { ReactNode } from "react";

export type SegmentedControlProps = {
  label: string;
  children: ReactNode;
};

export function SegmentedControl(props: SegmentedControlProps) {
  return (
    <div className={segmentedControlClass} aria-label={props.label}>
      {props.children}
    </div>
  );
}

const segmentedControlClass = css`
  display: flex;
  align-items: center;
  height: 20px;

  button + button {
    margin-left: -1px;
  }
`;
