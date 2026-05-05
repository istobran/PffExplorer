const TEXT_EDITING_SHORTCUT_KEYS = new Set([
  "c",
  "v",
  "x",
  "z",
  "y",
  "arrowleft",
  "arrowright",
  "arrowup",
  "arrowdown",
  "backspace",
  "delete",
  "home",
  "end",
]);

const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

export function shouldBlockWebViewShortcut(event: KeyboardEvent) {
  if (event.isComposing) return false;
  if (isNativeWindowShortcut(event)) return false;
  if (isAppKeyboardShortcut(event)) return false;

  const key = normalizedKey(event);
  const editable = isEditableShortcutTarget(event.target);

  if (isFunctionKey(key)) return true;
  if (key === "backspace" && !editable) return true;
  if (event.altKey) return !editable;

  if (event.ctrlKey || event.metaKey) {
    return !editable || !isTextEditingShortcut(event);
  }

  return false;
}

export function shouldBlockWebViewZoomShortcut(event: WheelEvent) {
  return (event.ctrlKey || event.metaKey) && !isPanZoomShortcutTarget(event.target);
}

export function isSelectAllResourcesShortcut(event: KeyboardEvent) {
  return (
    !event.isComposing &&
    !event.altKey &&
    (event.ctrlKey || event.metaKey) &&
    normalizedKey(event) === "a"
  );
}

export function isPlainAppShortcut(event: KeyboardEvent, keys: readonly string[]) {
  return (
    !event.repeat &&
    !event.isComposing &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !isEditableShortcutTarget(event.target) &&
    keys.includes(normalizedKey(event))
  );
}

export function isAudioPlaybackShortcut(event: KeyboardEvent) {
  return (
    event.code === "Space" &&
    !event.repeat &&
    !event.isComposing &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !isEditableShortcutTarget(event.target)
  );
}

export function isEditableShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;

  if (target instanceof HTMLInputElement) {
    return !NON_TEXT_INPUT_TYPES.has(target.type);
  }

  return false;
}

function isAppKeyboardShortcut(event: KeyboardEvent) {
  return (
    isSelectAllResourcesShortcut(event) ||
    isPlainAppShortcut(event, ["b", "m", "l", "n"]) ||
    isAudioPlaybackShortcut(event)
  );
}

function isNativeWindowShortcut(event: KeyboardEvent) {
  const key = normalizedKey(event);

  if (event.altKey && !event.ctrlKey && !event.metaKey) {
    return key === "f4" || isSpaceKey(event);
  }

  if (isApplePlatform() && event.metaKey && !event.altKey) {
    if (!event.ctrlKey && !event.shiftKey) {
      return key === "w" || key === "m" || key === "q";
    }

    return event.ctrlKey && !event.shiftKey && key === "f";
  }

  if (!isApplePlatform() && event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) {
    return (
      key === "arrowup" ||
      key === "arrowdown" ||
      key === "arrowleft" ||
      key === "arrowright"
    );
  }

  return false;
}

function isTextEditingShortcut(event: KeyboardEvent) {
  if (event.altKey) return false;

  const key = normalizedKey(event);
  return TEXT_EDITING_SHORTCUT_KEYS.has(key);
}

function isPanZoomShortcutTarget(target: EventTarget | null) {
  return target instanceof Element && target.closest("[data-panzoom-surface='true']") != null;
}

function isSpaceKey(event: KeyboardEvent) {
  return event.code === "Space" || event.key === " " || normalizedKey(event) === "spacebar";
}

function isFunctionKey(key: string) {
  return /^f(?:[1-9]|1[0-2])$/.test(key);
}

function isApplePlatform() {
  if (typeof navigator === "undefined") return false;
  return /mac|iphone|ipad|ipod/i.test(navigator.platform);
}

function normalizedKey(event: KeyboardEvent) {
  return event.key.toLowerCase();
}
