import { css } from "@emotion/css";
import { Search } from "lucide-react";

export type SearchBoxProps = {
  value: string;
  onChange: (value: string) => void;
};

export function SearchBox(props: SearchBoxProps) {
  return (
    <label className={searchBoxClass}>
      <Search className="search-icon" size={12} />
      <input
        type="text"
        placeholder="SEARCH FILES..."
        value={props.value}
        onChange={(event) => props.onChange(event.currentTarget.value)}
      />
    </label>
  );
}

const searchBoxClass = css`
  position: relative;
  display: flex;
  align-items: center;
  flex-shrink: 0;

  input {
    background: #030803;
    border: 1px solid var(--border-hi);
    color: var(--green);
    font-size: 11px;
    padding: 1px 8px 1px 24px;
    height: 20px;
    outline: none;
    letter-spacing: 1px;
    width: 210px;
    transition: border-color 0.1s;

    &::placeholder {
      color: var(--text-dim);
    }

    &:focus {
      border-color: var(--green-sel);
      box-shadow: 0 0 6px rgba(0, 204, 0, 0.15);
    }
  }

  .search-icon {
    position: absolute;
    left: 7px;
    color: var(--text-dim);
    pointer-events: none;
  }
`;
