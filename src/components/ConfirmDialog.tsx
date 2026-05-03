import { css } from "@emotion/css";
import clsx from "clsx";
import { AlertTriangle } from "lucide-react";
import type { CSSProperties } from "react";
import { ToolbarButton } from "@/components/toolbar/ToolbarButton";
import { PanelCorners } from "@/components/panel/PanelCorners";

export type ConfirmDialogProps = {
  title: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  closing?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog(props: ConfirmDialogProps) {
  const messageCharacters = Array.from(props.message);
  const detailCharacters = Array.from(props.detail ?? "");
  const messagePrintMs = Math.min(
    900,
    (messageCharacters.length + detailCharacters.length) * 8,
  );

  return (
    <div
      className={clsx(confirmDialogOverlayClass, props.closing && "closing")}
      role="presentation"
    >
      <section
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        style={
          {
            "--message-print-ms": `${messagePrintMs}ms`,
          } as CSSProperties
        }
      >
        <div className="signal-noise" aria-hidden />
        <div className="terminal-scan" aria-hidden />
        <PanelCorners />
        <header className="dialog-header">
          <div className="dialog-title" id="confirm-dialog-title">
            {props.title}
          </div>
          <div className="dialog-sub">CONFIRM</div>
        </header>
        <div className="dialog-body">
          <AlertTriangle size={22} className="dialog-icon" />
          <div className="message-shell">
            <p aria-label={props.message}>
              <span className="message-prefix" aria-hidden>
                &gt;&nbsp;
              </span>
              {messageCharacters.map((character, index) =>
                character === "\n" ? (
                  <br key={`line-${index}`} />
                ) : (
                  <span
                    key={`${character}-${index}`}
                    className="message-char"
                    aria-hidden
                    style={{ animationDelay: `${720 + Math.min(index, 120) * 8}ms` }}
                  >
                    {character === " " ? "\u00a0" : character}
                  </span>
                ),
              )}
              {!props.detail && <span className="terminal-cursor" aria-hidden />}
            </p>
            {props.detail && (
              <p className="message-detail" aria-label={props.detail}>
                {detailCharacters.map((character, index) => (
                  <span
                    key={`${character}-${index}`}
                    className="message-char detail-char"
                    aria-hidden
                    style={{
                      animationDelay: `${
                        800 + Math.min(messageCharacters.length + index, 140) * 8
                      }ms`,
                    }}
                  >
                    {character === " " ? "\u00a0" : character}
                  </span>
                ))}
                <span className="terminal-cursor" aria-hidden />
              </p>
            )}
          </div>
        </div>
        <footer className="dialog-actions">
          <ToolbarButton disabled={props.closing} onClick={props.onCancel}>
            {props.cancelLabel ?? "CANCEL"}
          </ToolbarButton>
          <ToolbarButton
            className="primary"
            disabled={props.closing}
            onClick={props.onConfirm}
          >
            {props.confirmLabel ?? "OK"}
          </ToolbarButton>
        </footer>
      </section>
    </div>
  );
}

const confirmDialogOverlayClass = css`
  position: fixed;
  inset: 0;
  z-index: 5000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.64);
  animation: confirm-overlay-in 180ms ease-out both;

  .confirm-dialog {
    width: min(520px, 100%);
    background:
      linear-gradient(rgba(7, 18, 7, 0.9), rgba(3, 10, 3, 0.96)),
      var(--panel-bg);
    border: 1px solid var(--border-hi);
    position: relative;
    overflow: hidden;
    box-shadow:
      0 0 0 1px rgba(0, 252, 0, 0.12),
      0 0 28px rgba(0, 252, 0, 0.12),
      inset 0 0 28px rgba(0, 252, 0, 0.05);
    transform-origin: center;
    animation: confirm-dialog-in 520ms steps(14, end) both;

    &::before {
      content: "";
      position: absolute;
      left: 50%;
      top: 50%;
      width: 6px;
      height: 6px;
      z-index: 4;
      pointer-events: none;
      background: var(--green-sel);
      box-shadow:
        0 0 8px rgba(0, 252, 0, 0.8),
        0 0 18px rgba(0, 252, 0, 0.35);
      transform: translate(-50%, -50%);
      animation: confirm-signal-in 520ms steps(14, end) both;
    }

    &::after {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      top: 50%;
      height: 1px;
      pointer-events: none;
      background: var(--green-sel);
      box-shadow: 0 0 10px rgba(0, 252, 0, 0.45);
      animation: confirm-scanline-in 520ms steps(14, end) both;
    }
  }

  &.closing {
    animation: confirm-overlay-out 360ms ease-in both;
  }

  &.closing .confirm-dialog {
    animation: confirm-dialog-out 360ms steps(10, end) both;

    &::before {
      animation: confirm-signal-out 360ms steps(10, end) both;
    }

    &::after {
      animation: confirm-scanline-out 360ms steps(10, end) both;
    }
  }

  .signal-noise,
  .terminal-scan {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .signal-noise {
    z-index: 1;
    opacity: 0;
    background:
      repeating-linear-gradient(
        to bottom,
        rgba(0, 252, 0, 0.08) 0,
        rgba(0, 252, 0, 0.08) 1px,
        transparent 1px,
        transparent 4px
      ),
      radial-gradient(circle at 20% 30%, rgba(0, 252, 0, 0.13), transparent 18%),
      radial-gradient(circle at 80% 70%, rgba(0, 252, 0, 0.08), transparent 24%);
    mix-blend-mode: screen;
    animation: signal-noise-in 1320ms steps(9, end) both;
  }

  .terminal-scan {
    z-index: 4;
    height: 18px;
    top: -18px;
    bottom: auto;
    opacity: 0;
    background: linear-gradient(
      to bottom,
      transparent,
      rgba(0, 252, 0, 0.32),
      transparent
    );
    box-shadow: 0 0 18px rgba(0, 252, 0, 0.18);
    animation: terminal-confirm-scan 360ms linear both;
    animation-delay: calc(860ms + var(--message-print-ms));
  }

  .dialog-header {
    display: flex;
    align-items: center;
    height: 28px;
    background: #030a03;
    border-bottom: 1px solid var(--border-hi);
    padding: 0 10px;
    gap: 8px;
    position: relative;
    z-index: 2;
    opacity: 0;
    animation: dialog-section-in 180ms steps(4, end) 520ms both;
  }

  .dialog-title {
    font-family: var(--font-vt);
    font-size: 16px;
    letter-spacing: 2px;
    color: var(--title);
    text-transform: uppercase;
    text-shadow: 0 0 8px rgba(85, 255, 85, 0.35);
  }

  .dialog-sub {
    font-size: 10px;
    color: var(--text-dim);
    letter-spacing: 1px;
    margin-left: auto;
    animation: status-flicker 900ms steps(2, end) 760ms both;
  }

  .dialog-body {
    display: grid;
    grid-template-columns: 28px 1fr;
    gap: 10px;
    padding: 18px 16px;
    color: var(--green);
    position: relative;
    z-index: 2;
    opacity: 0;
    animation: dialog-section-in 160ms steps(4, end) 620ms both;
  }

  .dialog-icon {
    color: var(--green-sel);
    margin-top: 1px;
    opacity: 0;
    animation: dialog-section-in 80ms steps(2, end) 640ms both;
  }

  .message-shell {
    min-width: 0;
  }

  p {
    margin: 0;
    line-height: 1.55;
    font-size: 12px;
    color: var(--green-hi);
    min-height: 38px;
  }

  .message-detail {
    min-height: 0;
    margin-top: 6px;
    color: var(--text-dim);
    overflow-wrap: anywhere;
  }

  .message-prefix,
  .message-char {
    opacity: 0;
    animation: message-char-in 30ms steps(1, end) both;
  }

  .message-prefix {
    color: var(--green-sel);
    animation-delay: 700ms;
  }

  .terminal-cursor {
    display: inline-block;
    width: 7px;
    height: 1em;
    margin-left: 2px;
    vertical-align: -0.15em;
    background: var(--green-sel);
    opacity: 0;
    animation: cursor-stabilize 900ms steps(2, end) calc(820ms + var(--message-print-ms))
      infinite;
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 0 16px 16px;
    position: relative;
    z-index: 2;
    opacity: 0;
    animation: dialog-section-in 160ms steps(4, end) calc(980ms + var(--message-print-ms))
      both;
  }

  .primary {
    color: var(--green-hi);
    border-color: var(--green-sel);
    background: var(--sel-row);
  }

  &.closing .dialog-header,
  &.closing .dialog-body,
  &.closing .dialog-actions {
    animation: dialog-section-out 90ms steps(2, end) both;
  }

  &.closing .signal-noise,
  &.closing .terminal-scan,
  &.closing .message-prefix,
  &.closing .message-char,
  &.closing .terminal-cursor {
    animation: none;
  }

  @keyframes confirm-overlay-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes confirm-overlay-out {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }

  @keyframes confirm-dialog-in {
    0% {
      opacity: 0;
      clip-path: inset(50% 50% 50% 50%);
    }
    18% {
      opacity: 1;
      clip-path: inset(49.5% 49.5% 49.5% 49.5%);
    }
    44% {
      opacity: 1;
      clip-path: inset(49.5% 0 49.5% 0);
    }
    100% {
      opacity: 1;
      clip-path: inset(0 0 0 0);
    }
  }

  @keyframes confirm-signal-in {
    0% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.3);
    }
    12%,
    34% {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
    44%,
    100% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(1.8);
    }
  }

  @keyframes confirm-scanline-in {
    0%,
    14% {
      opacity: 0;
      transform: scaleX(0);
    }
    18% {
      opacity: 1;
      transform: scaleX(0.02);
    }
    44%,
    72% {
      opacity: 1;
      transform: scaleX(1);
    }
    100% {
      opacity: 0;
      transform: scaleX(1);
    }
  }

  @keyframes confirm-dialog-out {
    0% {
      opacity: 1;
      clip-path: inset(0 0 0 0);
    }
    56% {
      opacity: 1;
      clip-path: inset(49.5% 0 49.5% 0);
    }
    82% {
      opacity: 1;
      clip-path: inset(49.5% 49.5% 49.5% 49.5%);
    }
    100% {
      opacity: 0;
      clip-path: inset(50% 50% 50% 50%);
    }
  }

  @keyframes confirm-signal-out {
    0%,
    54% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(1.8);
    }
    72%,
    92% {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.3);
    }
  }

  @keyframes confirm-scanline-out {
    0% {
      opacity: 0;
      transform: scaleX(1);
    }
    22%,
    56% {
      opacity: 1;
      transform: scaleX(1);
    }
    82% {
      opacity: 1;
      transform: scaleX(0.02);
    }
    100% {
      opacity: 0;
      transform: scaleX(0);
    }
  }

  @keyframes signal-noise-in {
    0%,
    12% {
      opacity: 0;
      transform: translateX(0);
    }
    16% {
      opacity: 0.65;
      transform: translateX(-2px);
    }
    22% {
      opacity: 0.12;
      transform: translateX(2px);
    }
    34% {
      opacity: 0.38;
      transform: translateX(0);
    }
    56%,
    100% {
      opacity: 0.16;
      transform: translateX(0);
    }
  }

  @keyframes terminal-confirm-scan {
    0% {
      opacity: 0;
      transform: translateY(0);
    }
    15%,
    76% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translateY(180px);
    }
  }

  @keyframes dialog-section-in {
    from {
      opacity: 0;
      transform: translateY(2px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes dialog-section-out {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }

  @keyframes status-flicker {
    0%,
    12%,
    18% {
      opacity: 0.35;
    }
    14%,
    24%,
    100% {
      opacity: 1;
    }
  }

  @keyframes message-char-in {
    from {
      opacity: 0;
      filter: brightness(1.8);
    }
    to {
      opacity: 1;
      filter: brightness(1);
    }
  }

  @keyframes cursor-stabilize {
    0%,
    45% {
      opacity: 1;
    }
    46%,
    100% {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 1ms !important;
      animation-delay: 0ms !important;
      animation-iteration-count: 1 !important;
    }
  }
`;
