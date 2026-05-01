import type { ResourceKind } from "@/types";
import { ToolbarButton } from "@/components/toolbar/ToolbarButton";

export type KindFilterButtonProps = {
  filter: ResourceKind | "ALL";
  active: boolean;
  onClick: () => void;
};

export function KindFilterButton(props: KindFilterButtonProps) {
  return (
    <ToolbarButton active={props.active} onClick={props.onClick}>
      {props.filter}
    </ToolbarButton>
  );
}
