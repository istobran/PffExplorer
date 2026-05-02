import { css, keyframes } from "@emotion/css";

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
    width: 160px;
    height: 8px;
    background: #030803;
    border: 1px solid var(--border-hi);
    overflow: hidden;
  }

  .prog-inner {
    height: 100%;
    width: 0%;
    background: repeating-linear-gradient(
      90deg,
      var(--green-sel) 0px,
      var(--green-sel) 5px,
      #004000 5px,
      #004000 7px
    );
    background-size: 7px 100%;
    transition: width 0.4s ease;
    animation: ${statusProgressScroll} 0.6s linear infinite;
  }

  .prog-pct {
    font-size: 10px;
    color: var(--text-dim);
    min-width: 32px;
    text-align: right;
    letter-spacing: 1px;
  }
`;
