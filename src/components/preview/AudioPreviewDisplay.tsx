import { css } from "@emotion/css";
import { convertFileSrc } from "@tauri-apps/api/core";
import { AudioLines, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AudioPreview } from "@/types";
import { playUiHover, playUiPress } from "@/lib/sounds";

export type AudioPreviewDisplayProps = {
  audio: AudioPreview;
  name: string;
  animationKey: string;
};

export function AudioPreviewLoadingBox() {
  return (
    <div className={audioPreviewDisplayClass}>
      <div className="audio-shell loading">
        <AudioLines size={28} />
        <div className="audio-status">PREPARING AUDIO</div>
      </div>
    </div>
  );
}

export function AudioPreviewDisplay(props: AudioPreviewDisplayProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioSrc = useMemo(() => {
    if (props.audio.filePath) return convertFileSrc(props.audio.filePath);
    return props.audio.dataUrl;
  }, [props.audio.dataUrl, props.audio.filePath]);
  const [paused, setPaused] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(props.audio.durationSeconds ?? 0);
  const [volume, setVolume] = useState(0.86);
  const [loadFailed, setLoadFailed] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;

    setPaused(true);
    setCurrentTime(0);
    setDuration(props.audio.durationSeconds ?? 0);
    setLoadFailed(false);
    setAutoplayBlocked(false);

    audio.load();
    audio.volume = volume;

    const playPromise = audio.play();
    if (playPromise) {
      void playPromise.catch(() => {
        setAutoplayBlocked(true);
      });
    }
  }, [audioSrc, props.animationKey, props.audio.durationSeconds]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = volume;
  }, [volume]);

  function handleLoadedMetadata() {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    setDuration(audio.duration);
  }

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      setAutoplayBlocked(false);
      void audio.play().catch(() => {
        setAutoplayBlocked(true);
      });
    } else {
      audio.pause();
    }
  }

  function restartPlayback() {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = 0;
    setCurrentTime(0);
    setAutoplayBlocked(false);
    void audio.play().catch(() => {
      setAutoplayBlocked(true);
    });
  }

  function seek(value: string) {
    const audio = audioRef.current;
    if (!audio) return;

    const nextTime = Number(value);
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  function changeVolume(value: string) {
    const nextVolume = Number(value);
    const audio = audioRef.current;
    setVolume(nextVolume);
    if (audio) audio.volume = nextVolume;
  }

  const progressMax = Math.max(duration, 0.001);
  const channelLabel = props.audio.channels === 2 ? "STEREO" : "MONO";
  const formatDetails = [
    props.audio.codec,
    props.audio.sampleRate ? `${props.audio.sampleRate} HZ` : null,
    props.audio.bitsPerSample ? `${props.audio.bitsPerSample} BIT` : null,
    props.audio.channels ? channelLabel : null,
  ].filter(Boolean);

  return (
    <div className={audioPreviewDisplayClass}>
      <audio
        key={props.animationKey}
        ref={audioRef}
        preload="auto"
        src={audioSrc ?? undefined}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onEnded={() => setPaused(true)}
        onError={() => setLoadFailed(true)}
      />

      <div className="audio-shell">
        <div className="audio-visual" aria-hidden="true">
          <AudioLines className="audio-icon" size={28} />
          <div className="audio-bars">
            {Array.from({ length: 18 }).map((_, index) => (
              <span
                key={index}
                className={paused ? undefined : "playing"}
                style={{ animationDelay: `${index * 42}ms` }}
              />
            ))}
          </div>
        </div>

        <div className="audio-title">{props.name}</div>
        <div className="audio-details">{formatDetails.join(" / ")}</div>

        <div className="transport">
          <button
            type="button"
            title={paused ? "Play audio" : "Pause audio"}
            onPointerEnter={playUiHover}
            onPointerDown={playUiPress}
            onClick={togglePlayback}
          >
            {paused ? <Play size={14} /> : <Pause size={14} />}
          </button>
          <button
            type="button"
            title="Restart audio"
            onPointerEnter={playUiHover}
            onPointerDown={playUiPress}
            onClick={restartPlayback}
          >
            <RotateCcw size={13} />
          </button>
          <span className="time">{formatAudioTime(currentTime)}</span>
          <input
            className="seek"
            type="range"
            min={0}
            max={progressMax}
            step={0.01}
            value={Math.min(currentTime, progressMax)}
            onChange={(event) => seek(event.currentTarget.value)}
          />
          <span className="time">{formatAudioTime(duration)}</span>
        </div>

        <div className="volume-row">
          {volume === 0 ? <VolumeX size={13} /> : <Volume2 size={13} />}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(event) => changeVolume(event.currentTarget.value)}
            aria-label="Audio preview volume"
          />
        </div>

        {autoplayBlocked && !loadFailed && (
          <div className="audio-message">PRESS PLAY TO START AUDIO</div>
        )}
        {loadFailed && <div className="audio-message error">AUDIO DECODE FAILED</div>}
      </div>
    </div>
  );
}

function formatAudioTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "00:00";

  const totalSeconds = Math.floor(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const audioPreviewDisplayClass = css`
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;

  audio {
    display: none;
  }

  .audio-shell {
    width: min(100%, 420px);
    border: 1px solid var(--border-hi);
    background: #040d04;
    padding: 16px;
    box-shadow: inset 0 0 0 1px rgba(0, 252, 0, 0.08);
  }

  .audio-shell.loading {
    min-height: 170px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: var(--text-dim);
  }

  .audio-status,
  .audio-message,
  .audio-title,
  .audio-details,
  .time {
    text-transform: uppercase;
  }

  .audio-visual {
    height: 76px;
    display: flex;
    align-items: center;
    gap: 14px;
    color: var(--green-sel);
    border-bottom: 1px solid var(--border);
    margin-bottom: 12px;
    padding-bottom: 12px;
  }

  .audio-icon {
    flex-shrink: 0;
    filter: drop-shadow(0 0 6px rgba(0, 252, 0, 0.28));
  }

  .audio-bars {
    flex: 1;
    height: 42px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .audio-bars span {
    width: 100%;
    height: 18%;
    min-width: 3px;
    background: var(--green-sel);
    opacity: 0.4;
    box-shadow: 0 0 6px rgba(0, 252, 0, 0.28);
  }

  .audio-bars span.playing {
    animation: audio-meter 720ms ease-in-out infinite alternate;
  }

  .audio-title {
    color: var(--green-sel);
    font-size: 12px;
    letter-spacing: 1.2px;
    margin-bottom: 6px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .audio-details {
    color: var(--text-dim);
    font-size: 10px;
    letter-spacing: 1px;
    min-height: 12px;
    margin-bottom: 14px;
  }

  .transport,
  .volume-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .transport {
    margin-bottom: 10px;
  }

  button {
    width: 28px;
    height: 22px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border-hi);
    background: transparent;
    color: var(--text-dim);
    outline: none;
  }

  button:hover {
    border-color: var(--green-sel);
    color: var(--hover-text);
    background: var(--hover-row);
    text-shadow: var(--hover-text-glow);
  }

  .time {
    min-width: 38px;
    color: var(--text-dim);
    font-size: 10px;
    letter-spacing: 0;
    text-align: center;
  }

  input[type="range"] {
    flex: 1;
    min-width: 0;
    height: 12px;
    accent-color: var(--green-sel);
    cursor: var(--cursor-crosshair), crosshair;
  }

  .volume-row {
    color: var(--text-dim);
    padding-left: 72px;
  }

  .audio-message {
    margin-top: 12px;
    color: var(--text-dim);
    font-size: 10px;
    letter-spacing: 1px;
    text-align: center;
  }

  .audio-message.error {
    color: var(--danger);
  }

  @keyframes audio-meter {
    from {
      height: 18%;
      opacity: 0.4;
    }

    to {
      height: 96%;
      opacity: 0.92;
    }
  }
`;
