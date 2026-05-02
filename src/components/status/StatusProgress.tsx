import { css, keyframes } from "@emotion/css";
import df1ProgressFrame from "@/assets/images/df1-ui/hsld-211.png";

export type StatusProgressProps = {
  label: string;
  progress: number | null;
};

export function StatusProgress(props: StatusProgressProps) {
  return (
    <div className={statusProgressClass}>
      <div className="prog-label">{props.label}</div>
      <div className="prog-outer">
        <div
          className="prog-inner"
          style={{ width: `${props.progress == null ? 0 : props.progress}%` }}
        />
      </div>
      <div className="prog-pct">{props.progress == null ? "-" : `${props.progress}%`}</div>
    </div>
  );
}

const statusProgressScroll = keyframes`
  from {
    background-position: 0 0;
  }

  to {
    background-position: 7px 0;
  }
`;

const statusProgressClass = css`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 160px;

  .prog-label {
    font-size: 10px;
    letter-spacing: 1px;
    color: var(--text-dim);
    text-transform: uppercase;
  }

  .prog-outer {
    position: relative;
    width: min(211px, 28vw);
    height: 20px;
    background: #030803;
    overflow: hidden;
  }

  .prog-outer::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: url(${df1ProgressFrame}) center / 100% 100% no-repeat;
    image-rendering: pixelated;
  }

  .prog-inner {
    position: absolute;
    top: 5px;
    left: 2px;
    z-index: 0;
    height: 10px;
    max-width: calc(100% - 4px);
    width: 0%;
    background: repeating-linear-gradient(
      90deg,
      var(--green-sel) 0px,
      var(--green-sel) 4px,
      #004000 4px,
      #004000 6px
    );
    background-size: 6px 100%;
    box-shadow: 0 0 8px rgba(0, 252, 0, 0.32);
    transition: width 0.24s linear;
    animation: ${statusProgressScroll} 0.5s linear infinite;
  }

  .prog-pct {
    font-size: 10px;
    color: var(--text-dim);
    min-width: 32px;
    text-align: right;
    letter-spacing: 1px;
  }
`;
