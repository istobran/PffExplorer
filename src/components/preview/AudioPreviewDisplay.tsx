import { css } from "@emotion/css";
import { convertFileSrc } from "@tauri-apps/api/core";
import { AudioLines, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AudioPreview } from "@/types";
import { playUiHover, playUiPress } from "@/lib/sounds";

const AUDIO_BAR_COUNT = 18;
const IDLE_AUDIO_BAR_HEIGHTS = Array.from({ length: AUDIO_BAR_COUNT }, () => 18);

type AudioContextConstructor = typeof AudioContext;

type AudioMeterGraph = {
  element: HTMLAudioElement;
  context: AudioContext;
  analyser: AnalyserNode;
  source: MediaElementAudioSourceNode;
  gain: GainNode;
  frequencyData: Uint8Array;
  frameId: number | null;
};

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
  const audioMeterRef = useRef<AudioMeterGraph | null>(null);
  const audioSrc = useMemo(() => {
    if (props.audio.filePath) return convertFileSrc(props.audio.filePath);
    return props.audio.dataUrl;
  }, [props.audio.dataUrl, props.audio.filePath]);
  const [paused, setPaused] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(props.audio.durationSeconds ?? 0);
  const [volume, setVolume] = useState(1);
  const [loadFailed, setLoadFailed] = useState(false);
  const [barHeights, setBarHeights] = useState(IDLE_AUDIO_BAR_HEIGHTS);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;

    stopAudioMeter();
    setPaused(true);
    setCurrentTime(0);
    setDuration(props.audio.durationSeconds ?? 0);
    setLoadFailed(false);
    setBarHeights(IDLE_AUDIO_BAR_HEIGHTS);

    audio.load();
    applyPlaybackVolume(volume);

    const playPromise = audio.play();
    if (playPromise) {
      void playPromise.then(startAudioMeter).catch(() => {
        stopAudioMeter();
      });
    }

    return stopAudioMeter;
  }, [audioSrc, props.animationKey, props.audio.durationSeconds]);

  useEffect(() => {
    applyPlaybackVolume(volume);
  }, [volume]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.code !== "Space" ||
        event.repeat ||
        isEditableKeyboardTarget(event.target)
      ) {
        return;
      }

      event.preventDefault();
      togglePlayback();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function stopAudioMeter() {
    const graph = audioMeterRef.current;
    if (!graph) return;

    if (graph.frameId !== null) {
      cancelAnimationFrame(graph.frameId);
    }
    graph.source.disconnect();
    graph.gain.disconnect();
    graph.analyser.disconnect();
    void graph.context.close().catch(() => undefined);
    audioMeterRef.current = null;
    setBarHeights(IDLE_AUDIO_BAR_HEIGHTS);
  }

  async function startAudioMeter() {
    const audio = audioRef.current;
    if (!audio) return;

    let graph = audioMeterRef.current;
    if (!graph || graph.element !== audio) {
      stopAudioMeter();

      const AudioContextClass =
        window.AudioContext ??
        (window as typeof window & { webkitAudioContext?: AudioContextConstructor })
          .webkitAudioContext;
      if (!AudioContextClass) return;

      const context = new AudioContextClass({ latencyHint: "interactive" });
      const analyser = context.createAnalyser();
      const gain = context.createGain();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.58;
      gain.gain.value = volume;

      let source: MediaElementAudioSourceNode;
      try {
        source = context.createMediaElementSource(audio);
      } catch {
        void context.close().catch(() => undefined);
        return;
      }

      source.connect(gain);
      gain.connect(analyser);
      analyser.connect(context.destination);

      graph = {
        element: audio,
        context,
        analyser,
        source,
        gain,
        frequencyData: new Uint8Array(analyser.frequencyBinCount),
        frameId: null,
      };
      audioMeterRef.current = graph;
      audio.volume = 1;
    }

    if (graph.context.state === "suspended") {
      await graph.context.resume().catch(() => undefined);
    }

    if (graph.frameId === null) {
      updateAudioMeter();
    }
  }

  function updateAudioMeter() {
    const graph = audioMeterRef.current;
    if (!graph) return;

    graph.analyser.getByteFrequencyData(graph.frequencyData);
    const nextHeights = audioBarsFromFrequencyData(graph.frequencyData, AUDIO_BAR_COUNT);
    setBarHeights((currentHeights) =>
      nextHeights.map((nextHeight, index) =>
        Math.round((currentHeights[index] ?? 18) * 0.42 + nextHeight * 0.58),
      ),
    );

    graph.frameId = requestAnimationFrame(updateAudioMeter);
  }

  function pauseAudioMeter() {
    const graph = audioMeterRef.current;
    if (graph?.frameId !== null && graph?.frameId !== undefined) {
      cancelAnimationFrame(graph.frameId);
      graph.frameId = null;
    }
    setBarHeights(IDLE_AUDIO_BAR_HEIGHTS);
  }

  function handleLoadedMetadata() {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    setDuration(audio.duration);
  }

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      void startAudioMeter();
      void audio.play().catch(() => {
        pauseAudioMeter();
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
    void startAudioMeter();
    void audio.play().catch(() => {
      pauseAudioMeter();
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
    setVolume(nextVolume);
    applyPlaybackVolume(nextVolume);
  }

  function applyPlaybackVolume(nextVolume: number) {
    const audio = audioRef.current;
    const clampedVolume = Math.max(0, Math.min(2, nextVolume));
    const graph = audioMeterRef.current;

    if (graph) {
      graph.gain.gain.value = clampedVolume;
      if (audio) audio.volume = 1;
      return;
    }

    if (audio) audio.volume = Math.min(1, clampedVolume);
  }

  const progressMax = Math.max(duration, 0.001);
  const volumePercent = Math.round(volume * 100);
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
        onPlay={() => {
          setPaused(false);
          void startAudioMeter();
        }}
        onPause={() => {
          setPaused(true);
          pauseAudioMeter();
        }}
        onEnded={() => {
          setPaused(true);
          pauseAudioMeter();
        }}
        onError={() => {
          setLoadFailed(true);
          stopAudioMeter();
        }}
      />

      <div className="audio-shell">
        <div className="audio-visual" aria-hidden="true">
          <AudioLines className="audio-icon" size={28} />
          <div className="audio-bars">
            {barHeights.map((height, index) => (
              <span
                key={index}
                className={paused ? undefined : "playing"}
                style={{ height: `${height}%` }}
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
            max={2}
            step={0.01}
            value={volume}
            onChange={(event) => changeVolume(event.currentTarget.value)}
            aria-label="Audio preview volume"
          />
          <span className="volume-value">{volumePercent}%</span>
        </div>

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

function audioBarsFromFrequencyData(data: Uint8Array, barCount: number) {
  if (data.length <= 2) return IDLE_AUDIO_BAR_HEIGHTS;

  const minBin = 1;
  const maxBin = data.length - 1;
  const logMin = Math.log(minBin);
  const logRange = Math.log(maxBin) - logMin;

  return Array.from({ length: barCount }, (_, bucketIndex) => {
    const startRatio = bucketIndex / barCount;
    const endRatio = (bucketIndex + 1) / barCount;
    const start = Math.max(minBin, Math.floor(Math.exp(logMin + logRange * startRatio)));
    const end = Math.min(
      data.length,
      Math.max(start + 1, Math.ceil(Math.exp(logMin + logRange * endRatio))),
    );
    let peak = 0;
    let sum = 0;
    let count = 0;

    for (let index = start; index < end; index += 1) {
      const value = data[index] ?? 0;
      peak = Math.max(peak, value);
      sum += value;
      count += 1;
    }

    const average = count > 0 ? sum / count : 0;
    const energy = (peak * 0.72 + average * 0.28) / 255;
    const shapedEnergy = Math.pow(Math.max(0, Math.min(1, energy)), 0.68);

    return Math.max(18, Math.min(96, 18 + shapedEnergy * 78));
  });
}

function isEditableKeyboardTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;

  if (target instanceof HTMLInputElement) {
    return !["button", "checkbox", "radio", "range", "reset", "submit"].includes(target.type);
  }

  return false;
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
    transition:
      height 44ms linear,
      opacity 120ms linear;
  }

  .audio-bars span.playing {
    opacity: 0.92;
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

  .time,
  .volume-value {
    min-width: 38px;
    color: var(--text-dim);
    font-size: 10px;
    letter-spacing: 0;
    text-align: center;
  }

  input[type="range"] {
    flex: 1;
    min-width: 0;
    height: 18px;
    appearance: none;
    -webkit-appearance: none;
    background: transparent;
    accent-color: var(--green-sel);
    cursor: var(--cursor-crosshair), crosshair;
  }

  input[type="range"]::-webkit-slider-runnable-track {
    height: 8px;
    border: 1px solid var(--green-dim);
    background: #020602;
  }

  input[type="range"]::-webkit-slider-thumb {
    width: 7px;
    height: 18px;
    margin-top: -5px;
    border: 1px solid var(--green-sel);
    appearance: none;
    -webkit-appearance: none;
    background: var(--green);
    box-shadow: 0 0 6px rgba(0, 252, 0, 0.24);
  }

  input[type="range"]::-moz-range-track {
    height: 8px;
    border: 1px solid var(--green-dim);
    background: #020602;
  }

  input[type="range"]::-moz-range-thumb {
    width: 7px;
    height: 18px;
    border: 1px solid var(--green-sel);
    border-radius: 0;
    background: var(--green);
    box-shadow: 0 0 6px rgba(0, 252, 0, 0.24);
  }

  .volume-row {
    color: var(--text-dim);
    padding-left: 72px;
  }

  .volume-value {
    min-width: 42px;
    text-align: right;
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

`;
