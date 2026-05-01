import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PreviewTextLine } from "@/components/preview/PreviewTextLine";

const TYPEWRITER_CHARS_PER_SECOND = 200;
const TYPEWRITER_LINE_STAGGER_MS = 20;
const FALLBACK_FIRST_SCREEN_CHARS = 900;
const LINE_NUMBER_GUTTER_WIDTH = 40;

export type PreviewTextBlockProps = {
  text: string;
  extension: string;
  animationKey: string;
};

export function PreviewTextBlock(props: PreviewTextBlockProps) {
  const blockRef = useRef<HTMLDivElement>(null);
  const [animatedLimit, setAnimatedLimit] = useState(FALLBACK_FIRST_SCREEN_CHARS);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [animationComplete, setAnimationComplete] = useState(false);
  const totalChars = props.text.length;
  const targetChars = Math.min(totalChars, animatedLimit);
  const animatedLines = useMemo(() => {
    return props.text.slice(0, targetChars).split("\n");
  }, [props.text, targetChars]);
  const fullLines = useMemo(() => props.text.split("\n"), [props.text]);
  const animationDurationMs = useMemo(() => {
    return animatedLines.reduce((duration, line, index) => {
      const lineDuration = (line.length / TYPEWRITER_CHARS_PER_SECOND) * 1000;
      return Math.max(duration, index * TYPEWRITER_LINE_STAGGER_MS + lineDuration);
    }, 0);
  }, [animatedLines]);

  useLayoutEffect(() => {
    const block = blockRef.current;
    const previewBody = block?.closest("#preview-body");
    if (!block || !(previewBody instanceof HTMLElement)) return;

    const textBlock = block;
    const previewElement = previewBody;

    function updateAnimatedLimit() {
      setAnimatedLimit(measureFirstScreenCharLimit(props.text, textBlock, previewElement));
    }

    updateAnimatedLimit();

    const observer = new ResizeObserver(updateAnimatedLimit);
    observer.observe(previewElement);
    observer.observe(textBlock);

    return () => {
      observer.disconnect();
    };
  }, [props.animationKey, props.text]);

  useEffect(() => {
    if (totalChars === 0 || targetChars === 0 || prefersReducedMotion()) {
      setElapsedMs(animationDurationMs);
      setAnimationComplete(true);
      return;
    }

    setElapsedMs(0);
    setAnimationComplete(false);

    const startedAt = performance.now();
    let frameId = 0;

    function tick(now: number) {
      const nextElapsed = Math.min(now - startedAt, animationDurationMs);
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
  }, [animationDurationMs, props.animationKey, targetChars, totalChars]);

  const visibleLines = animationComplete
    ? fullLines
    : animatedLines.map((line, index) => {
        return line.slice(0, visibleCharsForLine(line, index, elapsedMs));
      });

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

function measureFirstScreenCharLimit(
  text: string,
  block: HTMLElement,
  previewBody: HTMLElement,
) {
  const previewStyles = window.getComputedStyle(previewBody);
  const lineHeight = parsePixelValue(previewStyles.lineHeight)
    || parsePixelValue(previewStyles.fontSize) * 1.6
    || 18;
  const firstTextScreenHeight = Math.max(
    lineHeight,
    previewBody.clientHeight - block.offsetTop,
  );
  const visibleLineCount = Math.max(1, Math.floor(firstTextScreenHeight / lineHeight));
  const charWidth = measureCharWidth(previewBody, previewStyles);
  const charsPerVisualLine = Math.max(
    12,
    Math.floor((previewBody.clientWidth - LINE_NUMBER_GUTTER_WIDTH) / charWidth),
  );

  return firstScreenCharLimit(text, visibleLineCount, charsPerVisualLine);
}

function measureCharWidth(container: HTMLElement, styles: CSSStyleDeclaration) {
  const sample = document.createElement("span");
  sample.textContent = "0000000000";
  sample.style.position = "absolute";
  sample.style.visibility = "hidden";
  sample.style.whiteSpace = "pre";
  sample.style.font = styles.font;
  sample.style.letterSpacing = styles.letterSpacing;
  container.appendChild(sample);

  const width = sample.getBoundingClientRect().width / 10;
  sample.remove();

  return width || 7;
}

function firstScreenCharLimit(text: string, visibleLineCount: number, charsPerLine: number) {
  let visualLine = 1;
  let column = 0;

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\n") {
      visualLine += 1;
      column = 0;
    } else {
      column += 1;
      if (column >= charsPerLine) {
        visualLine += 1;
        column = 0;
      }
    }

    if (visualLine > visibleLineCount) {
      return index + 1;
    }
  }

  return text.length;
}

function parsePixelValue(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
