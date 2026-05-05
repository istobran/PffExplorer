import {
  useEffect,
  useCallback,
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

type GestureState = {
  startState: PanZoomState;
};

type WebKitGestureEvent = Event & {
  scale?: number;
  clientX?: number;
  clientY?: number;
};

export type UsePanZoomOptions = {
  enabled: boolean;
  contentSize: Size;
  viewportSize: Size;
  resetKey: string;
  minScale?: number;
  maxScale?: number;
};

export function usePanZoom(options: UsePanZoomOptions) {
  const minScale = options.minScale ?? DEFAULT_MIN_SCALE;
  const maxScale = options.maxScale ?? DEFAULT_MAX_SCALE;
  const dragRef = useRef<DragState | null>(null);
  const gestureRef = useRef<GestureState | null>(null);
  const stateRef = useRef<PanZoomState>({
    x: 0,
    y: 0,
    scale: minScale,
  });
  const [surfaceElement, setSurfaceElement] = useState<HTMLElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<PanZoomState>({
    x: 0,
    y: 0,
    scale: minScale,
  });

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    dragRef.current = null;
    gestureRef.current = null;
    setDragging(false);
    updateState({ x: 0, y: 0, scale: minScale });
  }, [minScale, options.resetKey]);

  useEffect(() => {
    updateState((current) => clampState(current, options.contentSize, options.viewportSize, minScale));
  }, [
    minScale,
    options.contentSize.height,
    options.contentSize.width,
    options.viewportSize.height,
    options.viewportSize.width,
  ]);

  useEffect(() => {
    if (!surfaceElement) return;
    const surface = surfaceElement;

    function handleGestureStart(event: Event) {
      if (!canTransform(options)) return;

      event.preventDefault();
      event.stopPropagation();

      gestureRef.current = {
        startState: stateRef.current,
      };
    }

    function handleGestureChange(event: Event) {
      if (!canTransform(options)) return;

      event.preventDefault();
      event.stopPropagation();

      const gesture = event as WebKitGestureEvent;
      const gestureScale = Number.isFinite(gesture.scale) ? Number(gesture.scale) : 1;
      const startState = gestureRef.current?.startState ?? stateRef.current;
      const nextScale = clamp(startState.scale * gestureScale, minScale, maxScale);

      updateState(
        zoomStateAtPoint(
          startState,
          nextScale,
          gesturePoint(gesture, surface, options.viewportSize),
          options.contentSize,
          options.viewportSize,
          minScale,
        ),
      );
    }

    function handleGestureEnd() {
      gestureRef.current = null;
    }

    surface.addEventListener("gesturestart", handleGestureStart, { passive: false });
    surface.addEventListener("gesturechange", handleGestureChange, { passive: false });
    surface.addEventListener("gestureend", handleGestureEnd);

    return () => {
      surface.removeEventListener("gesturestart", handleGestureStart);
      surface.removeEventListener("gesturechange", handleGestureChange);
      surface.removeEventListener("gestureend", handleGestureEnd);
    };
  }, [
    maxScale,
    minScale,
    options.contentSize,
    options.enabled,
    options.viewportSize,
    surfaceElement,
  ]);

  const surfaceRef = useCallback((element: HTMLElement | null) => {
    setSurfaceElement(element);
  }, []);

  function updateState(next: PanZoomState | ((current: PanZoomState) => PanZoomState)) {
    setState((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      stateRef.current = resolved;
      return resolved;
    });
  }

  function handleWheel(event: WheelEvent<HTMLElement>) {
    if (!canTransform(options)) return;

    event.preventDefault();
    event.stopPropagation();

    if (isWheelPanGesture(event)) {
      updateState((current) =>
        clampState(
          {
            scale: current.scale,
            x: current.x - event.deltaX,
            y: current.y - event.deltaY,
          },
          options.contentSize,
          options.viewportSize,
          minScale,
        ),
      );
      return;
    }

    const viewport = event.currentTarget.getBoundingClientRect();
    const pointer = {
      x: event.clientX - viewport.left,
      y: event.clientY - viewport.top,
    };

    updateState((current) => {
      const nextScale = clamp(
        current.scale * Math.exp(-event.deltaY * DEFAULT_WHEEL_SENSITIVITY),
        minScale,
        maxScale,
      );

      return zoomStateAtPoint(
        current,
        nextScale,
        pointer,
        options.contentSize,
        options.viewportSize,
        minScale,
      );
    });
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    if (
      !options.enabled ||
      !hasPanRange(options.contentSize, options.viewportSize, state.scale) ||
      event.button !== 0
    ) {
      return;
    }

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

    updateState((current) =>
      clampState(
        {
          scale: current.scale,
          x: drag.startPan.x + event.clientX - drag.startPointer.x,
          y: drag.startPan.y + event.clientY - drag.startPointer.y,
        },
        options.contentSize,
        options.viewportSize,
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
    surfaceRef,
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

function canTransform(options: UsePanZoomOptions) {
  return (
    options.enabled &&
    options.contentSize.width > 0 &&
    options.contentSize.height > 0 &&
    options.viewportSize.width > 0 &&
    options.viewportSize.height > 0
  );
}

function zoomStateAtPoint(
  baseState: PanZoomState,
  nextScale: number,
  pointer: Point,
  contentSize: Size,
  viewportSize: Size,
  minScale: number,
) {
  const center = {
    x: viewportSize.width / 2,
    y: viewportSize.height / 2,
  };
  const ratio = nextScale / baseState.scale;
  const next = {
    scale: nextScale,
    x: baseState.x + (1 - ratio) * (pointer.x - center.x - baseState.x),
    y: baseState.y + (1 - ratio) * (pointer.y - center.y - baseState.y),
  };

  return clampState(next, contentSize, viewportSize, minScale);
}

function gesturePoint(event: WebKitGestureEvent, surface: HTMLElement, viewportSize: Size) {
  const viewport = surface.getBoundingClientRect();
  if (
    viewport &&
    Number.isFinite(event.clientX) &&
    Number.isFinite(event.clientY)
  ) {
    return {
      x: Number(event.clientX) - viewport.left,
      y: Number(event.clientY) - viewport.top,
    };
  }

  return {
    x: viewportSize.width / 2,
    y: viewportSize.height / 2,
  };
}

function clampState(
  state: PanZoomState,
  contentSize: Size,
  viewportSize: Size,
  minScale: number,
): PanZoomState {
  if (
    contentSize.width <= 0 ||
    contentSize.height <= 0 ||
    viewportSize.width <= 0 ||
    viewportSize.height <= 0
  ) {
    return { x: 0, y: 0, scale: minScale };
  }

  const scale = Math.max(minScale, state.scale);
  const maxX = panRange(contentSize.width, viewportSize.width, scale);
  const maxY = panRange(contentSize.height, viewportSize.height, scale);

  return {
    scale,
    x: clamp(state.x, -maxX, maxX),
    y: clamp(state.y, -maxY, maxY),
  };
}

function hasPanRange(contentSize: Size, viewportSize: Size, scale: number) {
  return (
    panRange(contentSize.width, viewportSize.width, scale) > RESET_EPSILON ||
    panRange(contentSize.height, viewportSize.height, scale) > RESET_EPSILON
  );
}

function isWheelPanGesture(event: WheelEvent<HTMLElement>) {
  return isApplePlatform() && !event.ctrlKey && !event.metaKey;
}

function isApplePlatform() {
  if (typeof navigator === "undefined") return false;
  return /mac|iphone|ipad|ipod/i.test(navigator.platform);
}

function panRange(contentLength: number, viewportLength: number, scale: number) {
  if (contentLength <= 0 || viewportLength <= 0) return 0;
  return Math.abs(contentLength * scale - viewportLength) / 2;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
