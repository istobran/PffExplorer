import { css } from "@emotion/css";
import { syntaxHighlight } from "@/lib/previewSyntax";

export type PreviewTextLineProps = {
  line: string;
  lineNumber: number;
  extension: string;
};

export function PreviewTextLine(props: PreviewTextLineProps) {
  return (
    <div className={previewTextLineClass}>
      <span className="preview-line-num">{String(props.lineNumber).padStart(3, " ")}</span>
      <span
        dangerouslySetInnerHTML={{
          __html: syntaxHighlight(props.line, props.extension),
        }}
      />
    </div>
  );
}

const previewTextLineClass = css`
  white-space: pre-wrap;
  word-break: break-all;

  .preview-line-num {
    color: var(--text-dim);
    user-select: none;
    margin-right: 12px;
    font-size: 10px;
    display: inline-block;
    min-width: 24px;
    text-align: right;
  }

  .preview-keyword {
    color: var(--green-hi);
  }

  .preview-string {
    color: #6aee6a;
  }

  .preview-comment {
    color: var(--text-dim);
    font-style: italic;
  }

  .preview-tag {
    color: #4aaa7a;
  }

  .preview-attr {
    color: #aa8a4a;
  }
`;
