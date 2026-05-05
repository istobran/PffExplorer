import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type WheelEvent,
} from "react";

const DEFAULT_MIN_SCALE = 1;
const DEFAULT_MAX_SCALE = 8;
const DEFAULT_WHEEL_SENSITIVITY = 0.0014;
const RESET_EPSILON = 0.001;

type Point = {
  x: number;
  y: number;
};

type Size = {
  width: number;
  height: number;
};

type PanZoomState = Point & {
  scale: number;
};

type DragState = {
  pointerId: number;
  startPointer: Point;
  startPan: Point;
};

export type UsePanZoomOptions = {
  enabled: boolean;
  size: Size;
  resetKey: string;
  minScale?: number;
  maxScale?: number;
};

export function usePanZoom(options: UsePanZoomOptions) {
  const minScale = options.minScale ?? DEFAULT_MIN_SCALE;
  const maxScale = options.maxScale ?? DEFAULT_MAX_SCALE;
  const dragRef = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<PanZoomState>({
    x: 0,
    y: 0,
    scale: minScale,
  });

  useEffect(() => {
    dragRef.current = null;
    setDragging(false);
    setState({ x: 0, y: 0, scale: minScale });
  }, [minScale, options.resetKey]);

  useEffect(() => {
    setState((current) => clampState(current, options.size, minScale));
  }, [minScale, options.size.height, options.size.width]);

  function handleWheel(event: WheelEvent<HTMLElement>) {
    if (!options.enabled || options.size.width <= 0 || options.size.height <= 0) return;

    event.preventDefault();
    event.stopPropagation();

    const frame = event.currentTarget.getBoundingClientRect();
    const pointer = {
      x: event.clientX - frame.left,
      y: event.clientY - frame.top,
    };

    setState((current) => {
      const nextScale = clamp(
        current.scale * Math.exp(-event.deltaY * DEFAULT_WHEEL_SENSITIVITY),
        minScale,
        maxScale,
      );

      if (Math.abs(nextScale - minScale) <= RESET_EPSILON) {
        return { x: 0, y: 0, scale: minScale };
      }

      const center = {
        x: options.size.width / 2,
        y: options.size.height / 2,
      };
      const ratio = nextScale / current.scale;
      const next = {
        scale: nextScale,
        x: current.x + (1 - ratio) * (pointer.x - center.x - current.x),
        y: current.y + (1 - ratio) * (pointer.y - center.y - current.y),
      };

      return clampState(next, options.size, minScale);
    });
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    if (!options.enabled || state.scale <= minScale + RESET_EPSILON || event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    dragRef.current = {
      pointerId: event.pointerId,
      startPointer: { x: event.clientX, y: event.clientY },
      startPan: { x: state.x, y: state.y },
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    event.preventDefault();
    event.stopPropagation();

    setState((current) =>
      clampState(
        {
          scale: current.scale,
          x: drag.startPan.x + event.clientX - drag.startPointer.x,
          y: drag.startPan.y + event.clientY - drag.startPointer.y,
        },
        options.size,
        minScale,
      ),
    );
  }

  function handlePointerEnd(event: PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  }

  return {
    scale: state.scale,
    dragging,
    zoomed: state.scale > minScale + RESET_EPSILON,
    transformStyle: {
      transform: `translate3d(${state.x}px, ${state.y}px, 0) scale(${state.scale})`,
    } satisfies CSSProperties,
    handlers: {
      onWheel: handleWheel,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerEnd,
      onPointerCancel: handlePointerEnd,
      onLostPointerCapture: handlePointerEnd,
    },
  };
}

function clampState(state: PanZoomState, size: Size, minScale: number): PanZoomState {
  if (state.scale <= minScale + RESET_EPSILON || size.width <= 0 || size.height <= 0) {
    return { x: 0, y: 0, scale: minScale };
  }

  const maxX = (size.width * (state.scale - 1)) / 2;
  const maxY = (size.height * (state.scale - 1)) / 2;

  return {
    scale: state.scale,
    x: clamp(state.x, -maxX, maxX),
    y: clamp(state.y, -maxY, maxY),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
