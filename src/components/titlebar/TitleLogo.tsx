import { css } from "@emotion/css";

import deltaForceLogoUrl from "../../assets/images/df.svg";

export type TitleLogoProps = Record<string, never>;

export function TitleLogo(_props: TitleLogoProps) {
  return (
    <div className={titleLogoClass} data-tauri-drag-region>
      <div className="logo-mark">
        <img src={deltaForceLogoUrl} alt="" draggable={false} />
      </div>
      <div className="logo-text">
        DELTA FORCE<span>TACTICAL TOOLS v1.0</span>
      </div>
    </div>
  );
}

const titleLogoClass = css`
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 14px;
  border-left: 1px solid var(--border);
  flex-shrink: 0;

  .logo-mark {
    width: 30px;
    height: 30px;
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--green-hi);
    background: #050c05;

    img {
      width: 22px;
      height: 22px;
      display: block;
      object-fit: contain;
      pointer-events: none;
      -webkit-user-select: none;
      user-select: none;
    }
  }

  .logo-text {
    font-family: var(--font-vt);
    font-size: 15px;
    letter-spacing: 2px;
    color: var(--green-sel);
    text-transform: uppercase;
    line-height: 1.1;
    -webkit-user-select: none;
    user-select: none;

    span {
      display: block;
      font-size: 9px;
      letter-spacing: 1px;
      color: var(--text-dim);
    }
  }

  @media (max-width: 1100px) {
    display: none;
  }
`;
