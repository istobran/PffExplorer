import clsx from "clsx";
import type { ReactNode } from "react";
import { toolbarButtonClass } from "@/components/toolbar/ToolbarButton";

export type SegmentedButtonProps = {
  active: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
};

export function SegmentedButton(props: SegmentedButtonProps) {
  return (
    <button
      className={clsx(toolbarButtonClass, props.active && "on")}
      onClick={props.onClick}
      title={props.title}
    >
      {props.children}
    </button>
  );
}
