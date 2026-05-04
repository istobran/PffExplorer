import { css } from "@emotion/css";
import { convertFileSrc } from "@tauri-apps/api/core";
import { AudioLines, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AudioPreview } from "@/types";
import { useI18n } from "@/lib/i18n";
import { playUiHover, playUiPress } from "@/lib/sounds";

const AUDIO_BAR_COUNT = 18;
const IDLE_AUDIO_BAR_HEIGHTS = Array.from({ length: AUDIO_BAR_COUNT }, () => 18);

type AudioMeterGraph = {
  context: AudioContext;
  analyser: AnalyserNode;
  source: AudioBufferSourceNode;
  gain: GainNode;
  frequencyData: Uint8Array;
  frameId: number | null;
  startedAt: number;
  duration: number;
};

export type AudioPreviewDisplayProps = {
  audio: AudioPreview;
  name: string;
  animationKey: string;
};

export function AudioPreviewLoadingBox() {
  const { t } = useI18n();

  return (
    <div className={audioPreviewDisplayClass}>
      <div className="audio-shell loading">
        <AudioLines size={28} />
        <div className="audio-status">{t("preview.audioPreparing")}</div>
      </div>
    </div>
  );
}

export function AudioPreviewDisplay(props: AudioPreviewDisplayProps) {
  const { t } = useI18n();
  const audioMeterRef = useRef<AudioMeterGraph | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const previewAudioContextRef = useRef<AudioContext | null>(null);
  const playbackRequestRef = useRef(0);
  const playbackOffsetRef = useRef(0);
  const volumeRef = useRef(1);
  const pausedRef = useRef(true);
  const currentTimeRef = useRef(0);
  const durationRef = useRef(props.audio.durationSeconds ?? 0);
  const audioSrc = useMemo(() => {
    if (props.audio.previewUrl) return props.audio.previewUrl;
    if (props.audio.dataUrl) return props.audio.dataUrl;
    if (props.audio.filePath) return convertFileSrc(props.audio.filePath);
    return null;
  }, [props.audio.dataUrl, props.audio.filePath, props.audio.previewUrl]);
  const [paused, setPaused] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(props.audio.durationSeconds ?? 0);
  const [volume, setVolume] = useState(1);
  const [loadFailed, setLoadFailed] = useState(false);
  const [barHeights, setBarHeights] = useState(IDLE_AUDIO_BAR_HEIGHTS);

  useEffect(() => {
    if (!audioSrc) return;

    const requestId = nextPlaybackRequest();
    stopPlayback({ resetOffset: true });
    audioBufferRef.current = null;
    setPausedState(true);
    setCurrentTimeState(0);
    setDurationState(props.audio.durationSeconds ?? 0);
    setLoadFailed(false);
    setBarHeights(IDLE_AUDIO_BAR_HEIGHTS);

    void loadAndPlayAudio(audioSrc, requestId);

    return () => {
      playbackRequestRef.current += 1;
      stopPlayback({ resetOffset: true });
      audioBufferRef.current = null;
    };
  }, [audioSrc, props.animationKey, props.audio.durationSeconds]);

  useEffect(() => {
    volumeRef.current = volume;
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

  function setPausedState(nextPaused: boolean) {
    pausedRef.current = nextPaused;
    setPaused(nextPaused);
  }

  function setCurrentTimeState(nextCurrentTime: number) {
    currentTimeRef.current = nextCurrentTime;
    setCurrentTime(nextCurrentTime);
  }

  function setDurationState(nextDuration: number) {
    durationRef.current = nextDuration;
    setDuration(nextDuration);
  }

  function getPreviewAudioContext() {
    if (previewAudioContextRef.current) return previewAudioContextRef.current;
    if (typeof window === "undefined") return null;

    const AudioContextCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return null;

    const context = new AudioContextCtor({ latencyHint: "interactive" });
    previewAudioContextRef.current = context;
    return context;
  }

  function nextPlaybackRequest() {
    playbackRequestRef.current += 1;
    return playbackRequestRef.current;
  }

  function isActivePlaybackRequest(requestId: number) {
    return playbackRequestRef.current === requestId;
  }

  function cleanupGraph(graph: AudioMeterGraph, options: { stopSource: boolean }) {
    if (graph.frameId !== null) {
      cancelAnimationFrame(graph.frameId);
    }

    graph.source.onended = null;
    if (options.stopSource) {
      try {
        graph.source.stop();
      } catch {
        // The source may have already ended.
      }
    }

    try {
      graph.source.disconnect();
    } catch {
      // ignore
    }
    graph.gain.disconnect();
    graph.analyser.disconnect();
  }

  function stopPlayback(options: { resetOffset?: boolean } = {}) {
    const graph = audioMeterRef.current;
    if (graph) {
      cleanupGraph(graph, { stopSource: true });
      audioMeterRef.current = null;
    }

    if (options.resetOffset) {
      playbackOffsetRef.current = 0;
    }

    setBarHeights(IDLE_AUDIO_BAR_HEIGHTS);
  }

  async function loadAndPlayAudio(source: string, requestId: number) {
    const context = getPreviewAudioContext();
    if (!context) {
      setLoadFailed(true);
      return;
    }

    try {
      const response = await fetch(source);
      const encodedAudio = await response.arrayBuffer();
      const audioBuffer = await context.decodeAudioData(encodedAudio.slice(0));
      if (!isActivePlaybackRequest(requestId)) return;

      audioBufferRef.current = audioBuffer;
      setDurationState(audioBuffer.duration);
      await startBufferPlayback({ requestId, restart: true });
    } catch {
      if (!isActivePlaybackRequest(requestId)) return;

      setLoadFailed(true);
      stopPlayback({ resetOffset: true });
      setPausedState(true);
    }
  }

  async function startBufferPlayback(
    options: { requestId?: number; restart?: boolean } = {},
  ) {
    const audioBuffer = audioBufferRef.current;
    const context = previewAudioContextRef.current;
    if (!audioBuffer || !context) return;

    const requestId = options.requestId ?? nextPlaybackRequest();
    const restart = options.restart ?? false;
    stopPlayback({ resetOffset: restart });

    let offset = restart ? 0 : playbackOffsetRef.current;
    if (offset >= audioBuffer.duration - 0.005) {
      offset = 0;
    }
    offset = Math.max(0, Math.min(offset, audioBuffer.duration));
    playbackOffsetRef.current = offset;
    setCurrentTimeState(offset);

    if (context.state === "suspended") {
      await context.resume();
    }
    if (!isActivePlaybackRequest(requestId)) return;
    if (context.state !== "running") {
      throw new Error("Audio context is not running");
    }

    const source = context.createBufferSource();
    const analyser = context.createAnalyser();
    const gain = context.createGain();
    source.buffer = audioBuffer;
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.58;
    gain.gain.value = volumeRef.current;

    source.connect(gain);
    gain.connect(analyser);
    analyser.connect(context.destination);

    const graph: AudioMeterGraph = {
      context,
      analyser,
      source,
      gain,
      frequencyData: new Uint8Array(analyser.frequencyBinCount),
      frameId: null,
      startedAt: context.currentTime - offset,
      duration: audioBuffer.duration,
    };

    source.onended = () => {
      const currentGraph = audioMeterRef.current;
      if (currentGraph?.source !== source) return;

      cleanupGraph(currentGraph, { stopSource: false });
      audioMeterRef.current = null;
      playbackOffsetRef.current = 0;
      setCurrentTimeState(audioBuffer.duration);
      setPausedState(true);
      setBarHeights(IDLE_AUDIO_BAR_HEIGHTS);
    };

    audioMeterRef.current = graph;
    setPausedState(false);
    setLoadFailed(false);
    source.start(0, offset);
    updateAudioMeter();
  }

  function startLoadedAudio(options: { restart?: boolean } = {}) {
    const requestId = nextPlaybackRequest();
    void startBufferPlayback({ ...options, requestId }).catch(() => {
      if (!isActivePlaybackRequest(requestId)) return;
      setLoadFailed(true);
      stopPlayback();
      setPausedState(true);
    });
  }

  function updateAudioMeter() {
    const graph = audioMeterRef.current;
    if (!graph) return;

    const nextTime = Math.min(
      graph.duration,
      Math.max(0, graph.context.currentTime - graph.startedAt),
    );
    playbackOffsetRef.current = nextTime;
    setCurrentTimeState(nextTime);

    graph.analyser.getByteFrequencyData(graph.frequencyData);
    const nextHeights = audioBarsFromFrequencyData(graph.frequencyData, AUDIO_BAR_COUNT);
    setBarHeights((currentHeights) =>
      nextHeights.map((nextHeight, index) =>
        Math.round((currentHeights[index] ?? 18) * 0.42 + nextHeight * 0.58),
      ),
    );

    graph.frameId = requestAnimationFrame(updateAudioMeter);
  }

  function pausePlayback() {
    const graph = audioMeterRef.current;
    playbackRequestRef.current += 1;

    if (graph) {
      const nextTime = Math.min(
        graph.duration,
        Math.max(0, graph.context.currentTime - graph.startedAt),
      );
      playbackOffsetRef.current = nextTime;
      setCurrentTimeState(nextTime);
      cleanupGraph(graph, { stopSource: true });
      audioMeterRef.current = null;
    }

    setPausedState(true);
    setBarHeights(IDLE_AUDIO_BAR_HEIGHTS);
  }

  function togglePlayback() {
    if (pausedRef.current) {
      startLoadedAudio({
        restart: currentTimeRef.current >= durationRef.current - 0.005,
      });
    } else {
      pausePlayback();
    }
  }

  function restartPlayback() {
    startLoadedAudio({ restart: true });
  }

  function seek(value: string) {
    const nextTime = Number(value);
    const clampedTime = Math.max(0, Math.min(durationRef.current, nextTime));
    playbackOffsetRef.current = clampedTime;
    setCurrentTimeState(clampedTime);

    if (!pausedRef.current) {
      startLoadedAudio();
    }
  }

  function changeVolume(value: string) {
    const nextVolume = Number(value);
    volumeRef.current = nextVolume;
    setVolume(nextVolume);
    applyPlaybackVolume(nextVolume);
  }

  function applyPlaybackVolume(nextVolume: number) {
    const clampedVolume = Math.max(0, Math.min(2, nextVolume));
    const graph = audioMeterRef.current;

    if (graph) {
      graph.gain.gain.value = clampedVolume;
    }
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
            title={paused ? t("preview.audioPlay") : t("preview.audioPause")}
            onPointerEnter={playUiHover}
            onPointerDown={playUiPress}
            onClick={togglePlayback}
          >
            {paused ? <Play size={14} /> : <Pause size={14} />}
          </button>
          <button
            type="button"
            title={t("preview.audioRestart")}
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
            aria-label={t("preview.audioVolume")}
          />
          <span className="volume-value">{volumePercent}%</span>
        </div>

        {loadFailed && <div className="audio-message error">{t("preview.audioFailed")}</div>}
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
