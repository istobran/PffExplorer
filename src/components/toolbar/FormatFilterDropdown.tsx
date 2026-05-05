import { css } from "@emotion/css";
import clsx from "clsx";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { playMissionSwitch, playUiHover, playUiPress } from "@/lib/sounds";

export type FormatFilterDropdownProps = {
  options: string[];
  selected: string[];
  onToggle: (format: string) => void;
  onClear: () => void;
};

export function FormatFilterDropdown(props: FormatFilterDropdownProps) {
  const { t } = useI18n();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const active = open || props.selected.length > 0;

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const root = rootRef.current;
      if (!root || root.contains(event.target as Node)) return;
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function formatLabel() {
    if (props.selected.length === 0) return t("format.all");
    if (props.selected.length === 1) return props.selected[0];
    return t("format.count", { count: props.selected.length });
  }

  return (
    <div ref={rootRef} className={formatFilterDropdownClass}>
      <button
        type="button"
        className={clsx("format-filter-button", active && "active")}
        onPointerEnter={props.options.length === 0 ? undefined : playUiHover}
        onPointerDown={props.options.length === 0 ? undefined : playUiPress}
        onClick={() => setOpen((value) => !value)}
        disabled={props.options.length === 0}
      >
        <span>{t("format.type")}</span>
        <span className="format-filter-label">{formatLabel()}</span>
        <ChevronDown size={12} />
      </button>

      {open && (
        <div className="format-dropdown">
          {props.options.map((format) => {
            const selected = props.selected.includes(format);

            return (
              <button
                key={format}
                type="button"
                className={clsx("format-option", selected && "selected")}
                onPointerEnter={playUiHover}
                onPointerDown={playMissionSwitch}
                onClick={(event) => {
                  if (event.detail === 0) playMissionSwitch();
                  props.onToggle(format);
                }}
              >
                <span className="format-check">{selected ? <Check size={12} /> : null}</span>
                <span>{format}</span>
              </button>
            );
          })}
          <div className="format-separator" />
          <button
            type="button"
            className="format-option all-option"
            onPointerEnter={playUiHover}
            onPointerDown={playMissionSwitch}
            onClick={(event) => {
              if (event.detail === 0) playMissionSwitch();
              props.onClear();
            }}
          >
            <span className="format-check">◈</span>
            <span>{t("format.allTypes")}</span>
          </button>
        </div>
      )}
    </div>
  );
}

const formatFilterDropdownClass = css`
  position: relative;
  flex-shrink: 0;

  .format-filter-button {
    min-width: 128px;
    height: 20px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 0 8px;
    background: none;
    border: 1px solid var(--border-hi);
    color: var(--text-dim);
    font-size: 10px;
    letter-spacing: 1px;
    text-transform: uppercase;
    outline: none;
    transition: color 0.08s, background 0.08s, border-color 0.08s;
  }

  .format-filter-button:hover {
    color: var(--hover-text);
    border-color: var(--green-sel);
    background: var(--sel-row);
    font-weight: var(--hover-text-weight);
    box-shadow: none;
    text-shadow: var(--hover-text-glow);
  }

  .format-filter-button.active {
    color: var(--green-hi);
    border-color: var(--green-sel);
    background: var(--sel-row);
    text-shadow: none;
  }

  .format-filter-button.active:hover {
    color: var(--hover-text);
    background: var(--sel-row);
    font-weight: var(--hover-text-weight);
    text-shadow: var(--hover-text-glow);
  }

  .format-filter-button:disabled {
    opacity: 0.4;
    color: var(--text-dim);
    border-color: var(--border-hi);
    text-shadow: none;
    cursor: default;
  }

  .format-filter-label {
    flex: 1;
    text-align: left;
    color: inherit;
  }

  .format-dropdown {
    position: absolute;
    top: calc(100% + 2px);
    left: 0;
    z-index: 200;
    min-width: 150px;
    max-height: 280px;
    overflow-y: auto;
    background: var(--field-bg);
    border: 1px solid var(--border-hi);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.7);
  }

  .format-option {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 10px;
    background: transparent;
    border: none;
    color: var(--text-dim);
    font-size: 12px;
    letter-spacing: 1px;
    text-align: left;
    text-transform: uppercase;
    outline: none;
    transition: background 0.06s, color 0.06s;
  }

  .format-option.selected {
    background: var(--sel-row);
    color: var(--green-hi);
    text-shadow: none;
  }

  .format-option:hover {
    background: var(--hover-row);
    color: var(--hover-text);
    font-weight: var(--hover-text-weight);
    text-shadow: var(--hover-text-glow);
  }

  .format-option.selected:hover {
    background: var(--sel-row);
    color: var(--hover-text);
    font-weight: var(--hover-text-weight);
    text-shadow: var(--hover-text-glow);
  }

  .format-check {
    width: 14px;
    min-width: 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--green-sel);
    font-size: 12px;
  }

  .format-separator {
    height: 1px;
    margin: 2px 0;
    background: var(--border);
  }

  .all-option {
    color: var(--green);
  }
`;
