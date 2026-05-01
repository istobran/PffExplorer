import { css } from "@emotion/css";
import clsx from "clsx";
import type { ResourceKind } from "@/types";

export type ResourceTypePillProps = {
  kind: ResourceKind;
};

export function ResourceTypePill(props: ResourceTypePillProps) {
  return <span className={clsx(resourceTypePillClass, `tp-${props.kind}`)}>{props.kind}</span>;
}

const resourceTypePillClass = css`
  font-size: 9px;
  padding: 0 5px;
  height: 14px;
  display: flex;
  align-items: center;
  border: 1px solid;
  letter-spacing: 1px;

  &.tp-TEX {
    border-color: #1a5a2a;
    color: #4aaa6a;
  }

  &.tp-SND {
    border-color: #1a3a5a;
    color: #4a8aba;
  }

  &.tp-MDL {
    border-color: #4a3a1a;
    color: #ba8a4a;
  }

  &.tp-SHD {
    border-color: #3a1a4a;
    color: #9a5aaa;
  }

  &.tp-CFG {
    border-color: #3a2a1a;
    color: #aa7a4a;
  }

  &.tp-DAT {
    border-color: #333333;
    color: #888888;
  }
`;
