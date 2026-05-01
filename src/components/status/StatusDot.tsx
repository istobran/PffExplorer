import { css, keyframes } from "@emotion/css";
import clsx from "clsx";

export type StatusDotProps = {
  error?: boolean;
};

export function StatusDot(props: StatusDotProps) {
  return <div className={clsx(statusDotClass, props.error && "error")} />;
}

const statusPulse = keyframes`
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.35;
  }
`;

const statusDotClass = css`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--green-sel);
  box-shadow: 0 0 5px var(--green-sel);
  animation: ${statusPulse} 2s ease-in-out infinite;

  &.error {
    background: #ff5555;
    box-shadow: 0 0 5px #ff5555;
  }
`;
