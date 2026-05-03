import { css } from "@emotion/css";

export type StatusProgressProps = {
  label: string;
  progress: number | null;
};

export function StatusProgress(props: StatusProgressProps) {
  const progress = Math.max(0, Math.min(100, props.progress ?? 0));

  return (
    <div className={statusProgressClass}>
      <div className="prog-label">{props.label}</div>
      <div className="prog-outer">
        <div
          className="prog-fill"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="prog-pct">{props.progress == null ? "-" : `${props.progress}%`}</div>
    </div>
  );
}

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
    width: min(216px, 28vw);
    height: 10px;
    background: #020602;
    border: 1px solid var(--green-dim);
    overflow: hidden;
  }

  .prog-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--green-dim), var(--green-sel));
    box-shadow: 0 0 8px rgba(0, 252, 0, 0.22);
    transition: width 0.18s linear;
  }

  .prog-pct {
    font-size: 10px;
    color: var(--text-dim);
    min-width: 32px;
    text-align: right;
    letter-spacing: 1px;
  }
`;
