import { useEffect, useMemo, useState } from "react";
import { PreviewTextLine } from "@/components/preview/PreviewTextLine";

const TYPEWRITER_MIN_MS = 550;
const TYPEWRITER_MAX_MS = 3200;
const TYPEWRITER_MS_PER_CHAR = 14;

export type PreviewTextBlockProps = {
  text: string;
  extension: string;
  animationKey: string;
};

export function PreviewTextBlock(props: PreviewTextBlockProps) {
  const [visibleChars, setVisibleChars] = useState(0);
  const totalChars = props.text.length;

  useEffect(() => {
    if (totalChars === 0 || prefersReducedMotion()) {
      setVisibleChars(totalChars);
      return;
    }

    setVisibleChars(0);

    const duration = Math.min(
      TYPEWRITER_MAX_MS,
      Math.max(TYPEWRITER_MIN_MS, totalChars * TYPEWRITER_MS_PER_CHAR),
    );
    const startedAt = performance.now();
    let frameId = 0;

    function tick(now: number) {
      const progress = Math.min((now - startedAt) / duration, 1);
      setVisibleChars(Math.floor(totalChars * progress));

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
      }
    }

    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [props.animationKey, totalChars]);

  const visibleLines = useMemo(() => {
    return props.text.slice(0, visibleChars).split("\n");
  }, [props.text, visibleChars]);
  const cursorLine = visibleChars < totalChars ? visibleLines.length - 1 : -1;

  return (
    <>
      {visibleLines.map((line, index) => (
        <PreviewTextLine
          key={`${props.animationKey}-${index}`}
          line={line}
          lineNumber={index + 1}
          extension={props.extension}
          cursor={index === cursorLine}
        />
      ))}
    </>
  );
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
