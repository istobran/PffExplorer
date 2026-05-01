import { css } from "@emotion/css";

export type HighlightedTextProps = {
  text: string;
  query: string;
};

export function HighlightedText(props: HighlightedTextProps) {
  const needle = props.query.trim().toLowerCase();
  if (!needle) return <>{props.text}</>;

  const index = props.text.toLowerCase().indexOf(needle);
  if (index < 0) return <>{props.text}</>;

  return (
    <>
      {props.text.slice(0, index)}
      <span className={highlightClass}>{props.text.slice(index, index + needle.length)}</span>
      {props.text.slice(index + needle.length)}
    </>
  );
}

const highlightClass = css`
  background: rgba(57, 232, 57, 0.15);
  color: var(--green-hi);
`;
