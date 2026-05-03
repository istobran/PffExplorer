import { css } from "@emotion/css";
import { AlertTriangle } from "lucide-react";
import { ToolbarButton } from "@/components/toolbar/ToolbarButton";
import { PanelCorners } from "@/components/panel/PanelCorners";

export type ConfirmDialogProps = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog(props: ConfirmDialogProps) {
  return (
    <div className={confirmDialogOverlayClass} role="presentation">
      <section
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <PanelCorners />
        <header className="dialog-header">
          <div className="dialog-title" id="confirm-dialog-title">
            {props.title}
          </div>
          <div className="dialog-sub">CONFIRM</div>
        </header>
        <div className="dialog-body">
          <AlertTriangle size={22} className="dialog-icon" />
          <p>{props.message}</p>
        </div>
        <footer className="dialog-actions">
          <ToolbarButton onClick={props.onCancel}>
            {props.cancelLabel ?? "CANCEL"}
          </ToolbarButton>
          <ToolbarButton className="primary" onClick={props.onConfirm}>
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

  .confirm-dialog {
    width: min(520px, 100%);
    background: var(--panel-bg);
    border: 1px solid var(--border-hi);
    position: relative;
    box-shadow: 0 0 0 1px rgba(0, 252, 0, 0.12), 0 0 28px rgba(0, 252, 0, 0.12);
  }

  .dialog-header {
    display: flex;
    align-items: center;
    height: 28px;
    background: #030a03;
    border-bottom: 1px solid var(--border-hi);
    padding: 0 10px;
    gap: 8px;
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
  }

  .dialog-body {
    display: grid;
    grid-template-columns: 28px 1fr;
    gap: 10px;
    padding: 18px 16px;
    color: var(--green);
  }

  .dialog-icon {
    color: var(--green-sel);
    margin-top: 1px;
  }

  p {
    margin: 0;
    white-space: pre-line;
    line-height: 1.55;
    font-size: 12px;
    color: var(--green-hi);
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 0 16px 16px;
  }

  .primary {
    color: var(--green-hi);
    border-color: var(--green-sel);
    background: var(--sel-row);
  }
`;
