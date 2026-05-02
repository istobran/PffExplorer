import click9Url from "@/assets/audios/click9.wav";
import missionBriefingSelectUrl from "@/assets/audios/beep1.wav";
import missionSwitchUrl from "@/assets/audios/beep2.wav";
import menuButtonUrl from "@/assets/audios/menubtn1.wav";
import menuMusicUrl from "@/assets/audios/menumono.wav";
import ttClick1Url from "@/assets/audios/ttclick1.wav";
import ttClick2Url from "@/assets/audios/ttclick2.wav";
import ttClick3Url from "@/assets/audios/ttclick3.wav";
import ttClick4Url from "@/assets/audios/ttclick4.wav";
import ttClick5Url from "@/assets/audios/ttclick5.wav";
import ttClick6Url from "@/assets/audios/ttclick6.wav";
import ttClick7Url from "@/assets/audios/ttclick7.wav";
import ttClick8Url from "@/assets/audios/ttclick8.wav";
import ttClick9Url from "@/assets/audios/ttclick9.wav";
import ttReturn1Url from "@/assets/audios/ttretur1.wav";
import ttReturn2Url from "@/assets/audios/ttretur2.wav";
import ttReturn3Url from "@/assets/audios/ttretur3.wav";
import whoosh2Url from "@/assets/audios/whoosh2.wav";

export const DF1_MENU_SLIDE_DURATION_MS = 320;

const TYPEWRITER_CLICK_URLS = [
  ttClick1Url,
  ttClick2Url,
  ttClick3Url,
  ttClick4Url,
  ttClick5Url,
  ttClick6Url,
  ttClick7Url,
  ttClick8Url,
  ttClick9Url,
];

const TYPEWRITER_RETURN_URLS = [ttReturn1Url, ttReturn2Url, ttReturn3Url];
const ESSENTIAL_SOUND_URLS = [
  click9Url,
  missionBriefingSelectUrl,
  missionSwitchUrl,
  menuButtonUrl,
  whoosh2Url,
];
const ALL_SOUND_URLS = [
  ...ESSENTIAL_SOUND_URLS,
  ...TYPEWRITER_CLICK_URLS,
  ...TYPEWRITER_RETURN_URLS,
];

const decodedBuffers = new Map<string, AudioBuffer>();
const decodePromises = new Map<string, Promise<AudioBuffer>>();
const lastPlayedAt = new Map<string, number>();

let audioContext: AudioContext | null = null;
let menuMusicAudio: HTMLAudioElement | null = null;
let menuMusicUnlockListenersInstalled = false;
let preloadStarted = false;
let soundMuted = false;

export function preloadDf1MenuSounds() {
  if (preloadStarted || typeof window === "undefined") return;
  preloadStarted = true;

  ESSENTIAL_SOUND_URLS.forEach((url) => {
    void decodeSound(url);
  });

  ALL_SOUND_URLS.filter((url) => !ESSENTIAL_SOUND_URLS.includes(url)).forEach(
    (url, index) => {
      window.setTimeout(() => {
        void decodeSound(url);
      }, 40 + index * 18);
    },
  );
}

export function playMenuButton() {
  playSound(menuButtonUrl, {
    key: "menu-button",
    volume: 0.58,
    throttleMs: 95,
  });
}

export function startDf1MenuMusic() {
  if (typeof window === "undefined") return;
  if (soundMuted) return;

  const audio = getMenuMusicAudio();
  if (!audio.paused) return;

  void audio.play().catch(() => {
    installMenuMusicUnlockListeners();
  });
}

export function stopDf1MenuMusic() {
  if (!menuMusicAudio) return;
  menuMusicAudio.pause();
}

export function isSoundMuted() {
  return soundMuted;
}

export function setSoundMuted(muted: boolean) {
  soundMuted = muted;

  if (soundMuted) {
    stopDf1MenuMusic();
  } else {
    startDf1MenuMusic();
  }
}

export function playWhoosh() {
  playSound(whoosh2Url, {
    key: "whoosh",
    volume: 0.52,
    throttleMs: 120,
  });
}

export function playMissionBriefingSelect() {
  playSound(missionBriefingSelectUrl, {
    key: "mission-briefing-select",
    volume: 0.45,
    throttleMs: 70,
  });
}

export function playMissionSwitch() {
  playSound(missionSwitchUrl, {
    key: "mission-switch",
    volume: 0.45,
    throttleMs: 70,
  });
}

export function playTypewriterClick() {
  playSound(randomItem(TYPEWRITER_CLICK_URLS), {
    key: "typewriter-click",
    volume: 0.26,
    throttleMs: 46,
  });
}

export function playTypewriterInput() {
  playSound(randomItem(TYPEWRITER_CLICK_URLS), {
    key: "typewriter-input",
    volume: 0.22,
  });
}

export function playTypewriterReturn() {
  playSound(randomItem(TYPEWRITER_RETURN_URLS), {
    key: "typewriter-return",
    volume: 0.34,
    throttleMs: 120,
  });
}

export function playUiHover() {
  playSound(click9Url, {
    key: "ui-hover",
    volume: 0.08,
    playbackRate: 1.22,
  });
}

export function playUiPress() {
  void resumeAudioContext();

  playSound(click9Url, {
    key: "ui-press",
    volume: 0.22,
    playbackRate: 1,
    throttleMs: 45,
  });
}

function getMenuMusicAudio() {
  if (menuMusicAudio) return menuMusicAudio;

  const audio = new Audio(menuMusicUrl);
  audio.loop = true;
  audio.preload = "auto";
  audio.volume = 0.22;
  menuMusicAudio = audio;
  return audio;
}

function installMenuMusicUnlockListeners() {
  if (menuMusicUnlockListenersInstalled || typeof window === "undefined") return;
  menuMusicUnlockListenersInstalled = true;

  const handleGesture = () => {
    window.removeEventListener("pointerdown", handleGesture, true);
    window.removeEventListener("keydown", handleGesture, true);
    menuMusicUnlockListenersInstalled = false;
    startDf1MenuMusic();
  };

  window.addEventListener("pointerdown", handleGesture, { capture: true, once: true });
  window.addEventListener("keydown", handleGesture, { capture: true, once: true });
}

function playSound(
  url: string,
  options: {
    key: string;
    volume: number;
    throttleMs?: number;
    playbackRate?: number;
  },
) {
  if (typeof window === "undefined") return;
  if (soundMuted) return;

  const now = performance.now();
  const last = lastPlayedAt.get(options.key) ?? 0;
  if (options.throttleMs && now - last < options.throttleMs) return;
  lastPlayedAt.set(options.key, now);

  const decoded = decodedBuffers.get(url);
  if (decoded) {
    playDecodedBuffer(decoded, options.volume, options.playbackRate ?? 1);
    return;
  }

  void decodeSound(url).then((buffer) => {
    playDecodedBuffer(buffer, options.volume, options.playbackRate ?? 1);
  }).catch(() => {
    // Missing or undecodable optional UI audio should not interrupt interaction.
  });
}

function playDecodedBuffer(buffer: AudioBuffer, volume: number, playbackRate: number) {
  const context = getAudioContext();
  if (!context) return;

  void resumeAudioContext();

  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = buffer;
  source.playbackRate.value = playbackRate;
  gain.gain.value = volume;
  source.connect(gain);
  gain.connect(context.destination);
  source.start();
}

function decodeSound(url: string) {
  const decoded = decodedBuffers.get(url);
  if (decoded) return Promise.resolve(decoded);

  const existing = decodePromises.get(url);
  if (existing) return existing;

  const context = getAudioContext();
  if (!context) {
    return Promise.reject(new Error("Web Audio is not available"));
  }

  const promise = fetch(url)
    .then((response) => response.arrayBuffer())
    .then((data) => context.decodeAudioData(data))
    .then((buffer) => {
      decodedBuffers.set(url, buffer);
      decodePromises.delete(url);
      return buffer;
    })
    .catch((error) => {
      decodePromises.delete(url);
      throw error;
    });

  decodePromises.set(url, promise);
  return promise;
}

function getAudioContext() {
  if (audioContext) return audioContext;
  if (typeof window === "undefined") return null;

  const AudioContextCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return null;

  audioContext = new AudioContextCtor({ latencyHint: "interactive" });
  return audioContext;
}

async function resumeAudioContext() {
  const context = getAudioContext();
  if (!context || context.state !== "suspended") return;

  try {
    await context.resume();
  } catch {
    // The webview can keep audio suspended until a trusted user gesture.
  }
}

function randomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}
