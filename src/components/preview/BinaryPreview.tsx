import { css } from "@emotion/css";

export type BinaryPreviewProps = {
  title: string;
  hexHead: string;
};

export function BinaryPreview(props: BinaryPreviewProps) {
  return (
    <div className={binaryPreviewClass}>
      <div className="binary-title">{props.title}</div>
      <pre>{props.hexHead || "-"}</pre>
    </div>
  );
}

const binaryPreviewClass = css`
  color: var(--text-dim);

  .binary-title {
    margin-bottom: 8px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
    color: var(--green);
  }
`;
