import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { css } from "@emotion/css";
import type { ResourceTableRow, SortKey } from "@/types";
import { entryKey } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { ResourceTableHeader } from "@/components/resource-table/ResourceTableHeader";
import { RESOURCE_TABLE_ROW_HEIGHT } from "@/components/resource-table/resourceTableLayout";
import { ResourceTableRowItem } from "@/components/resource-table/ResourceTableRowItem";
import { useI18n } from "@/lib/i18n";

export type ResourceSelectionMode = "single" | "toggle" | "range";

export type ResourceTableProps = {
  rows: ResourceTableRow[];
  focusedKey: string | null;
  selectedKeys: ReadonlySet<string>;
  searchText: string;
  sortKey: SortKey;
  sortAsc: boolean;
  showArchiveColumn: boolean;
  onSort: (key: SortKey) => void;
  onSelect: (entry: ResourceTableRow, mode: ResourceSelectionMode) => void;
  onDragSelect: (startIndex: number, endIndex: number, committed: boolean) => void;
};

type DragState = {
  anchorIndex: number;
  currentIndex: number;
};

type PointerDragState = {
  pointerId: number;
  anchorIndex: number;
  startClientX: number;
  startClientY: number;
  lastClientY: number;
  active: boolean;
};

const DRAG_THRESHOLD_PX = 4;
const AUTO_SCROLL_EDGE_PX = 36;

export function ResourceTable(props: ResourceTableProps) {
  const { t } = useI18n();
  const parentRef = useRef<HTMLDivElement>(null);
  const pointerDragRef = useRef<PointerDragState | null>(null);
  const suppressNextClickRef = useRef(false);
  const autoScrollFrameRef = useRef<number | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const virtualizer = useVirtualizer({
    count: props.rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => RESOURCE_TABLE_ROW_HEIGHT,
    overscan: 16,
  });

  useEffect(() => {
    return () => {
      if (autoScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(autoScrollFrameRef.current);
      }
    };
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    if (props.rows.length === 0) return;

    event.preventDefault();

    const currentIndex = props.focusedKey
      ? props.rows.findIndex((row) => entryKey(row) === props.focusedKey)
      : -1;
    const nextIndex =
      event.key === "ArrowDown"
        ? currentIndex < 0
          ? 0
          : Math.min(currentIndex + 1, props.rows.length - 1)
        : currentIndex < 0
          ? props.rows.length - 1
          : Math.max(currentIndex - 1, 0);
    const nextRow = props.rows[nextIndex];

    if (nextRow) {
      props.onSelect(nextRow, event.shiftKey ? "range" : "single");
      virtualizer.scrollToIndex(nextIndex, { align: "auto" });
    }
  }

  function handleBodyPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || props.rows.length === 0) return;

    const anchorIndex = rowIndexFromClientY(event.clientY);
    if (anchorIndex < 0) return;

    pointerDragRef.current = {
      pointerId: event.pointerId,
      anchorIndex,
      startClientX: event.clientX,
      startClientY: event.clientY,
      lastClientY: event.clientY,
      active: false,
    };
    parentRef.current?.setPointerCapture(event.pointerId);
  }

  function handleBodyPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = pointerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    drag.lastClientY = event.clientY;
    const currentIndex = rowIndexFromClientY(event.clientY);
    if (currentIndex < 0) return;

    const movedEnough =
      Math.abs(event.clientX - drag.startClientX) >= DRAG_THRESHOLD_PX ||
      Math.abs(event.clientY - drag.startClientY) >= DRAG_THRESHOLD_PX;
    if (!drag.active && !movedEnough) return;

    drag.active = true;
    suppressNextClickRef.current = true;
    updateDragSelection(drag.anchorIndex, currentIndex, false);
    startAutoScroll();
    event.preventDefault();
  }

  function handleBodyPointerUp(event: PointerEvent<HTMLDivElement>) {
    finishDrag(event, true);
  }

  function handleBodyPointerCancel(event: PointerEvent<HTMLDivElement>) {
    finishDrag(event, false);
  }

  function finishDrag(event: PointerEvent<HTMLDivElement>, committed: boolean) {
    const drag = pointerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (parentRef.current?.hasPointerCapture(event.pointerId)) {
      parentRef.current.releasePointerCapture(event.pointerId);
    }
    stopAutoScroll();

    if (drag.active) {
      const currentIndex = rowIndexFromClientY(event.clientY);
      if (currentIndex >= 0) {
        updateDragSelection(drag.anchorIndex, currentIndex, committed);
      }
      setDragState(null);
      event.preventDefault();
      window.setTimeout(() => {
        suppressNextClickRef.current = false;
      }, 0);
    }

    pointerDragRef.current = null;
  }

  function handleRowSelect(
    row: ResourceTableRow,
    event: MouseEvent<HTMLButtonElement>,
  ) {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      event.preventDefault();
      return;
    }

    const mode = event.shiftKey
      ? "range"
      : event.metaKey || event.ctrlKey
        ? "toggle"
        : "single";
    props.onSelect(row, mode);
  }

  function updateDragSelection(startIndex: number, endIndex: number, committed: boolean) {
    setDragState({ anchorIndex: startIndex, currentIndex: endIndex });
    props.onDragSelect(startIndex, endIndex, committed);
  }

  function rowIndexFromClientY(clientY: number) {
    const element = parentRef.current;
    if (!element || props.rows.length === 0) return -1;

    const rect = element.getBoundingClientRect();
    const y = clientY - rect.top + element.scrollTop;
    return clamp(Math.floor(y / RESOURCE_TABLE_ROW_HEIGHT), 0, props.rows.length - 1);
  }

  function startAutoScroll() {
    if (autoScrollFrameRef.current !== null) return;

    const tick = () => {
      const drag = pointerDragRef.current;
      const element = parentRef.current;
      if (!drag?.active || !element) {
        autoScrollFrameRef.current = null;
        return;
      }

      const rect = element.getBoundingClientRect();
      const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
      let delta = 0;

      if (drag.lastClientY < rect.top + AUTO_SCROLL_EDGE_PX) {
        delta = -RESOURCE_TABLE_ROW_HEIGHT;
      } else if (drag.lastClientY > rect.bottom - AUTO_SCROLL_EDGE_PX) {
        delta = RESOURCE_TABLE_ROW_HEIGHT;
      }

      if (delta !== 0) {
        element.scrollTop = clamp(element.scrollTop + delta, 0, maxScrollTop);
        const currentIndex = rowIndexFromClientY(drag.lastClientY);
        if (currentIndex >= 0) {
          updateDragSelection(drag.anchorIndex, currentIndex, false);
        }
      }

      autoScrollFrameRef.current = window.requestAnimationFrame(tick);
    };

    autoScrollFrameRef.current = window.requestAnimationFrame(tick);
  }

  function stopAutoScroll() {
    if (autoScrollFrameRef.current === null) return;

    window.cancelAnimationFrame(autoScrollFrameRef.current);
    autoScrollFrameRef.current = null;
  }

  const selectionBox =
    dragState === null
      ? null
      : {
          top:
            Math.min(dragState.anchorIndex, dragState.currentIndex) *
            RESOURCE_TABLE_ROW_HEIGHT,
          height:
            (Math.abs(dragState.currentIndex - dragState.anchorIndex) + 1) *
            RESOURCE_TABLE_ROW_HEIGHT,
        };

  return (
    <div
      className={resourceTableClass}
      tabIndex={0}
      role="grid"
      aria-label={t("resource.aria")}
      onKeyDown={handleKeyDown}
    >
      <ResourceTableHeader
        sortKey={props.sortKey}
        sortAsc={props.sortAsc}
        showArchiveColumn={props.showArchiveColumn}
        onSort={props.onSort}
      />

      {props.rows.length === 0 ? (
        <EmptyState marker="0">{t("resource.empty")}</EmptyState>
      ) : (
        <div
          id="tbl-body"
          ref={parentRef}
          onPointerDown={handleBodyPointerDown}
          onPointerMove={handleBodyPointerMove}
          onPointerUp={handleBodyPointerUp}
          onPointerCancel={handleBodyPointerCancel}
        >
          <div className="virtual-pad" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((item) => {
              const row = props.rows[item.index];
              const key = entryKey(row);
              return (
                <ResourceTableRowItem
                  key={key}
                  row={row}
                  selected={props.selectedKeys.has(key)}
                  focused={props.focusedKey === key}
                  searchText={props.searchText}
                  showArchiveColumn={props.showArchiveColumn}
                  top={item.start}
                  onSelect={(event) => handleRowSelect(row, event)}
                />
              );
            })}
            {selectionBox && (
              <div
                className="selection-box"
                style={{ top: selectionBox.top, height: selectionBox.height }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

const resourceTableClass = css`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
  outline: none;

  &:focus-visible {
    box-shadow: inset 0 0 0 1px var(--green-dim);
  }

  #tbl-body {
    flex: 1;
    overflow: auto;
    position: relative;
    min-height: 0;
    touch-action: none;
  }

  .virtual-pad {
    position: relative;
    width: 100%;
  }

  .selection-box {
    position: absolute;
    left: 0;
    right: 0;
    z-index: 3;
    pointer-events: none;
    border: 1px solid var(--green-sel);
    background: rgba(0, 252, 0, 0.08);
    box-shadow: inset 0 0 10px rgba(0, 252, 0, 0.15);
  }
`;
