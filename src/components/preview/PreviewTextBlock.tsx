import { css, keyframes } from "@emotion/css";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PreviewTextLine } from "@/components/preview/PreviewTextLine";
import { useI18n } from "@/lib/i18n";
import { playTypewriterClick, playTypewriterReturn } from "@/lib/sounds";

const TYPEWRITER_CHARS_PER_SECOND = 200;
const TYPEWRITER_LINE_STAGGER_MS = 20;
const FALLBACK_FIRST_SCREEN_CHARS = 900;
const LARGE_TEXT_ASYNC_THRESHOLD = 64 * 1024;
const TEXT_SPLIT_CHUNK_CHARS = 24 * 1024;
const LARGE_TEXT_INITIAL_RENDER_LINES = 160;
const LARGE_TEXT_RENDER_BATCH_LINES = 180;

type AnimatedLimitState = {
  key: string;
  limit: number;
};

export type PreviewTextBlockProps = {
  text: string;
  extension: string;
  animationKey: string;
};

export function PreviewTextBlock(props: PreviewTextBlockProps) {
  const { t } = useI18n();
  const blockRef = useRef<HTMLDivElement>(null);
  const lastAudibleProgressRef = useRef({ chars: 0, lines: 0 });
  const isLargeText = props.text.length >= LARGE_TEXT_ASYNC_THRESHOLD;
  const [asyncLines, setAsyncLines] = useState<string[] | null>(null);
  const [asyncTextLoading, setAsyncTextLoading] = useState(isLargeText);
  const measurementKey = `${props.animationKey}:${props.text.length}`;
  const [animatedLimitState, setAnimatedLimitState] = useState<AnimatedLimitState | null>(null);
  const animatedLimit =
    animatedLimitState?.key === measurementKey ? animatedLimitState.limit : null;
  const [elapsedMs, setElapsedMs] = useState(0);
  const [animationComplete, setAnimationComplete] = useState(false);
  const [renderedLineCount, setRenderedLineCount] = useState(0);
  const totalChars = props.text.length;
  const targetChars = animatedLimit == null ? 0 : Math.min(totalChars, animatedLimit);
  const smallLines = useMemo(() => {
    return isLargeText ? null : props.text.split("\n");
  }, [isLargeText, props.text]);
  const fullLines = isLargeText ? asyncLines : smallLines;
  const textReady = fullLines != null;
  const animatedLines = useMemo(() => {
    return props.text.slice(0, targetChars).split("\n");
  }, [props.text, targetChars]);
  const animatedLineLengths = useMemo(() => {
    return animatedLines.map((line) => line.length);
  }, [animatedLines]);
  const animationDurationMs = useMemo(() => {
    return animatedLines.reduce((duration, line, index) => {
      const lineDuration = (line.length / TYPEWRITER_CHARS_PER_SECOND) * 1000;
      return Math.max(duration, index * TYPEWRITER_LINE_STAGGER_MS + lineDuration);
    }, 0);
  }, [animatedLines]);

  useEffect(() => {
    let cancelled = false;
    setRenderedLineCount(0);
    setElapsedMs(0);
    setAnimationComplete(false);
    lastAudibleProgressRef.current = { chars: 0, lines: 0 };

    if (!isLargeText) {
      setAsyncLines(null);
      setAsyncTextLoading(false);
      return;
    }

    setAsyncLines(null);
    setAsyncTextLoading(true);

    void splitTextLinesAsync(props.text, () => cancelled).then((lines) => {
      if (cancelled) return;
      setAsyncLines(lines);
      setAsyncTextLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [isLargeText, props.animationKey, props.text]);

  useLayoutEffect(() => {
    if (!textReady) return;

    const block = blockRef.current;
    const previewBody = block?.closest("#preview-body");
    if (!block || !(previewBody instanceof HTMLElement)) return;

    const textBlock = block;
    const previewElement = previewBody;
    const measuredLimit = measureFirstScreenCharLimit(props.text, textBlock, previewElement);

    setAnimatedLimitState((current) => {
      if (current?.key === measurementKey && current.limit === measuredLimit) return current;
      return { key: measurementKey, limit: measuredLimit };
    });
  }, [measurementKey, props.animationKey, props.text, textReady]);

  useEffect(() => {
    if (!textReady || animatedLimit == null) return;

    if (totalChars === 0 || targetChars === 0 || prefersReducedMotion()) {
      setElapsedMs(animationDurationMs);
      setAnimationComplete(true);
      return;
    }

    setElapsedMs(0);
    setAnimationComplete(false);
    lastAudibleProgressRef.current = { chars: 0, lines: 0 };

    const startedAt = performance.now();
    let frameId = 0;

    function tick(now: number) {
      const nextElapsed = Math.min(now - startedAt, animationDurationMs);
      emitTypewriterSounds(animatedLineLengths, nextElapsed, lastAudibleProgressRef.current);
      setElapsedMs(nextElapsed);

      if (nextElapsed < animationDurationMs) {
        frameId = window.requestAnimationFrame(tick);
      } else {
        setAnimationComplete(true);
      }
    }

    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [
    animatedLineLengths,
    animationDurationMs,
    animatedLimit,
    props.animationKey,
    targetChars,
    textReady,
    totalChars,
  ]);

  useEffect(() => {
    if (!textReady || !animationComplete || !fullLines || !isLargeText) return;

    const lines = fullLines;
    let cancelled = false;
    let frameId = 0;
    let nextCount = Math.min(
      lines.length,
      Math.max(animatedLines.length, LARGE_TEXT_INITIAL_RENDER_LINES),
    );
    setRenderedLineCount(nextCount);

    function appendBatch() {
      if (cancelled) return;

      nextCount = Math.min(lines.length, nextCount + LARGE_TEXT_RENDER_BATCH_LINES);
      setRenderedLineCount(nextCount);

      if (nextCount < lines.length) {
        frameId = window.requestAnimationFrame(appendBatch);
      }
    }

    if (nextCount < lines.length) {
      frameId = window.requestAnimationFrame(appendBatch);
    }

    return () => {
      cancelled = true;
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [animatedLines.length, animationComplete, fullLines, isLargeText, textReady]);

  if (asyncTextLoading || !fullLines) {
    return (
      <div ref={blockRef}>
        <PreviewTextLoading message={t("preview.loading.text")} />
      </div>
    );
  }

  const finalLineCount = isLargeText
    ? Math.min(
        fullLines.length,
        Math.max(renderedLineCount, animatedLines.length, LARGE_TEXT_INITIAL_RENDER_LINES),
      )
    : fullLines.length;
  const visibleLines = animationComplete
    ? fullLines.slice(0, finalLineCount)
    : animatedLines.map((line, index) => {
        return line.slice(0, visibleCharsForLine(line, index, elapsedMs));
      });
  const loadingRemainingText = animationComplete && isLargeText && finalLineCount < fullLines.length;

  return (
    <div ref={blockRef}>
      {visibleLines.map((line, index) => (
        <PreviewTextLine
          key={`${props.animationKey}-${index}`}
          line={line}
          lineNumber={index + 1}
          extension={props.extension}
          cursor={!animationComplete && isLineTyping(animatedLines[index] ?? "", index, elapsedMs)}
        />
      ))}
      {loadingRemainingText && (
        <PreviewTextLoading message={t("preview.loading.remainingText")} compact />
      )}
    </div>
  );
}

export function PreviewTextLoading(props: { message: string; compact?: boolean }) {
  return (
    <div className={textPreviewLoadingClass} data-compact={props.compact ? "true" : undefined}>
      <span className="loading-caret" />
      <span>{props.message}</span>
    </div>
  );
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function visibleCharsForLine(line: string, lineIndex: number, elapsedMs: number) {
  const lineElapsed = elapsedMs - lineIndex * TYPEWRITER_LINE_STAGGER_MS;
  if (lineElapsed <= 0) return 0;

  return Math.min(
    line.length,
    Math.floor((lineElapsed / 1000) * TYPEWRITER_CHARS_PER_SECOND),
  );
}

function isLineTyping(line: string, lineIndex: number, elapsedMs: number) {
  if (line.length === 0) return false;

  const visibleChars = visibleCharsForLine(line, lineIndex, elapsedMs);
  return visibleChars > 0 && visibleChars < line.length;
}

function emitTypewriterSounds(
  lineLengths: number[],
  elapsedMs: number,
  previous: { chars: number; lines: number },
) {
  const progress = { chars: 0, lines: 0 };

  for (let index = 0; index < lineLengths.length; index += 1) {
    const lineElapsed = elapsedMs - index * TYPEWRITER_LINE_STAGGER_MS;
    if (lineElapsed <= 0) break;

    const visibleChars = Math.min(
      lineLengths[index],
      Math.floor((lineElapsed / 1000) * TYPEWRITER_CHARS_PER_SECOND),
    );

    if (visibleChars > 0) {
      progress.lines += 1;
      progress.chars += visibleChars;
    }
  }

  if (progress.lines > previous.lines && previous.lines > 0) {
    playTypewriterReturn();
  }

  if (progress.chars > previous.chars) {
    playTypewriterClick();
  }

  previous.chars = progress.chars;
  previous.lines = progress.lines;
}

async function splitTextLinesAsync(text: string, isCancelled: () => boolean) {
  const lines: string[] = [];
  let lineStart = 0;

  for (let cursor = 0; cursor < text.length; cursor += TEXT_SPLIT_CHUNK_CHARS) {
    const end = Math.min(text.length, cursor + TEXT_SPLIT_CHUNK_CHARS);

    for (let index = cursor; index < end; index += 1) {
      if (text.charCodeAt(index) === 10) {
        lines.push(text.slice(lineStart, index));
        lineStart = index + 1;
      }
    }

    if (end < text.length) {
      await waitForPreviewTextChunk();
      if (isCancelled()) return [];
    }
  }

  lines.push(text.slice(lineStart));
  return lines;
}

function waitForPreviewTextChunk() {
  return new Promise<void>((resolve) => {
    const requestIdle = (
      window as unknown as {
        requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      }
    ).requestIdleCallback;

    if (requestIdle) {
      requestIdle(() => resolve(), { timeout: 40 });
      return;
    }

    window.setTimeout(resolve, 0);
  });
}

function measureFirstScreenCharLimit(
  text: string,
  block: HTMLElement,
  previewBody: HTMLElement,
) {
  if (text.length === 0) return 0;

  const previewStyles = window.getComputedStyle(previewBody);
  const lineHeight = parsePixelValue(previewStyles.lineHeight)
    || parsePixelValue(previewStyles.fontSize) * 1.6
    || 18;
  const previewRect = previewBody.getBoundingClientRect();
  const blockRect = block.getBoundingClientRect();
  const targetHeight = Math.max(
    lineHeight,
    previewRect.bottom - blockRect.top,
  ) + lineHeight;
  const probe = createTextMeasureProbe(previewBody, previewStyles);

  try {
    let low = 0;
    let high = Math.min(text.length, FALLBACK_FIRST_SCREEN_CHARS);

    let highHeight = measureTextSliceHeight(probe, text, high);

    while (high < text.length && highHeight <= targetHeight) {
      low = high;
      high = Math.min(text.length, high * 2);
      highHeight = measureTextSliceHeight(probe, text, high);
    }

    if (high === text.length && highHeight <= targetHeight) {
      return text.length;
    }

    while (low + 1 < high) {
      const mid = low + Math.floor((high - low) / 2);
      const midHeight = measureTextSliceHeight(probe, text, mid);
      if (midHeight <= targetHeight) {
        low = mid;
      } else {
        high = mid;
      }
    }

    return Math.min(text.length, Math.max(1, high));
  } finally {
    probe.remove();
  }
}

function createTextMeasureProbe(previewBody: HTMLElement, styles: CSSStyleDeclaration) {
  const width = Math.max(
    1,
    previewBody.clientWidth
      - parsePixelValue(styles.paddingLeft)
      - parsePixelValue(styles.paddingRight),
  );
  const probe = document.createElement("div");
  probe.style.position = "fixed";
  probe.style.left = "-10000px";
  probe.style.top = "0";
  probe.style.width = `${width}px`;
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.font = styles.font;
  probe.style.lineHeight = styles.lineHeight;
  probe.style.letterSpacing = styles.letterSpacing;
  document.body.appendChild(probe);

  return probe;
}

function measureTextSliceHeight(probe: HTMLElement, text: string, charLimit: number) {
  probe.replaceChildren();

  const lines = text.slice(0, charLimit).split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = document.createElement("div");
    line.style.whiteSpace = "pre-wrap";
    line.style.wordBreak = "break-all";

    const lineNumber = document.createElement("span");
    lineNumber.textContent = String(index + 1).padStart(3, " ");
    lineNumber.style.userSelect = "none";
    lineNumber.style.marginRight = "12px";
    lineNumber.style.fontSize = "10px";
    lineNumber.style.display = "inline-block";
    lineNumber.style.minWidth = "24px";
    lineNumber.style.textAlign = "right";

    const content = document.createElement("span");
    content.textContent = lines[index];

    line.append(lineNumber, content);
    probe.appendChild(line);
  }

  return probe.getBoundingClientRect().height;
}

function parsePixelValue(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const textLoadingBlink = keyframes`
  0%,
  44% {
    opacity: 1;
  }

  45%,
  100% {
    opacity: 0.32;
  }
`;

const textLoadingCaret = keyframes`
  0%,
  48% {
    opacity: 1;
  }

  49%,
  100% {
    opacity: 0;
  }
`;

const textPreviewLoadingClass = css`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
  color: var(--green-hi);
  font-size: 12px;
  letter-spacing: 1px;
  text-shadow: var(--hover-text-glow);
  animation: ${textLoadingBlink} 0.9s steps(1) infinite;

  &[data-compact="true"] {
    padding: 8px 0 2px;
    color: var(--text-dim);
  }

  .loading-caret {
    width: 7px;
    height: 12px;
    background: var(--green-hi);
    box-shadow: 0 0 6px rgba(127, 255, 127, 0.45);
    animation: ${textLoadingCaret} 0.62s steps(1) infinite;
  }
`;
