const appEl = document.getElementById("app");

const panelPrep = document.getElementById("panel-prep");
const panelRunning = document.getElementById("panel-running");

const breakMinutesInput = document.getElementById("breakMinutesInput");
const workMinutesInput = document.getElementById("workMinutesInput");
const breakStartBtn = document.getElementById("breakStartBtn");
const workStartBtn = document.getElementById("workStartBtn");

const timeDisplay = document.getElementById("timeDisplay");
const runningLabel = document.getElementById("runningLabel");
const stopBtn = document.getElementById("stopBtn");
const progressCircle = document.querySelector(".gauge__progress");

const LS_KEY_BREAK = "flash_timer_break_minutes";
const LS_KEY_WORK = "flash_timer_work_minutes";
const PREV_VALUE_KEY = "prevValue";
const BLINK_CYCLE_MS = 900;

let rafId = null;
let mode = "prep"; // "prep" | "running"
let runningKind = null; // "break" | "work" | null

let startAtMs = 0;
let endAtMs = 0;
let targetMs = 0;
let didQuotaBlink = false;

function clampInt(value, min, max) {
  if (!Number.isFinite(value)) return null;
  const truncated = Math.trunc(value);
  if (truncated < min || truncated > max) return null;
  return truncated;
}

function formatMMSS(seconds) {
  const safe = Math.max(0, Math.trunc(seconds));
  const mm = String(Math.floor(safe / 60)).padStart(2, "0");
  const ss = String(safe % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function formatMSS(seconds) {
  const safe = Math.max(0, Math.trunc(seconds));
  const m = String(Math.floor(safe / 60));
  const ss = String(safe % 60).padStart(2, "0");
  return `${m}:${ss}`;
}

function setGaugeProgress(fraction) {
  if (!progressCircle) return;
  const radius = progressCircle.r.baseVal.value;
  const circumference = 2 * Math.PI * radius;
  progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
  const clamped = Math.min(1, Math.max(0, fraction));
  progressCircle.style.strokeDashoffset = String(circumference * (1 - clamped));
}

function stopLoop() {
  if (rafId != null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function setMode(nextMode) {
  mode = nextMode;
  appEl.dataset.mode = nextMode;

  panelPrep.hidden = nextMode !== "prep";
  panelRunning.hidden = nextMode !== "running";

  if (nextMode === "prep") {
    appEl.classList.add("is-blinking");
    appEl.classList.remove("is-blinking-temp");
    delete appEl.dataset.theme;
    runningKind = null;
  } else {
    appEl.classList.remove("is-blinking");
    appEl.classList.remove("is-blinking-temp");
  }
}

function blinkTemp(times) {
  appEl.classList.add("is-blinking-temp");
  const durationMs = BLINK_CYCLE_MS * times;
  window.setTimeout(() => {
    appEl.classList.remove("is-blinking-temp");
  }, durationMs);
}

function resetToPrep() {
  stopLoop();
  runningKind = null;
  timeDisplay.textContent = "00:00";
  runningLabel.textContent = "";
  setGaugeProgress(0);
  setMode("prep");
}

function startBreak(minutes) {
  stopLoop();
  runningKind = "break";
  didQuotaBlink = false;
  targetMs = minutes * 60_000;
  const now = performance.now();
  startAtMs = now;
  endAtMs = now + targetMs;

  appEl.dataset.theme = "blue";
  runningLabel.textContent = "";
  setMode("running");

  const frame = () => {
    const msLeft = Math.max(0, endAtMs - performance.now());
    timeDisplay.textContent = formatMMSS(Math.ceil(msLeft / 1000));
    setGaugeProgress(targetMs > 0 ? msLeft / targetMs : 0);

    if (msLeft <= 0) {
      resetToPrep();
      return;
    }
    rafId = requestAnimationFrame(frame);
  };
  rafId = requestAnimationFrame(frame);
}

function startWork(minutes) {
  stopLoop();
  runningKind = "work";
  didQuotaBlink = false;
  targetMs = minutes * 60_000;
  startAtMs = performance.now();

  appEl.dataset.theme = "orange";
  runningLabel.textContent = `ノルマ：${formatMSS(minutes * 60)}`;
  setMode("running");

  const frame = () => {
    const elapsedMs = Math.max(0, performance.now() - startAtMs);
    timeDisplay.textContent = formatMMSS(Math.floor(elapsedMs / 1000));
    const remainingMs = Math.max(0, targetMs - elapsedMs);
    setGaugeProgress(targetMs > 0 ? remainingMs / targetMs : 0);

    if (!didQuotaBlink && targetMs > 0 && elapsedMs >= targetMs) {
      didQuotaBlink = true;
      blinkTemp(3);
    }

    rafId = requestAnimationFrame(frame);
  };
  rafId = requestAnimationFrame(frame);
}

function attachMinutesPersistence(inputEl, storageKey) {
  if (!inputEl) return;

  const save = () => {
    const raw = Number(inputEl.value);
    const minutes = clampInt(raw, 1, 999);
    try {
      if (minutes == null) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, String(minutes));
    } catch {
      // ignore
    }
  };

  try {
    const saved = localStorage.getItem(storageKey);
    if (saved != null) inputEl.value = saved;
  } catch {
    // ignore
  }

  inputEl.addEventListener("input", save);

  // Mobile-friendly: don't autofocus, but when focused clear the previous value.
  inputEl.addEventListener("focus", () => {
    if (inputEl.value === "") return;
    inputEl.dataset[PREV_VALUE_KEY] = inputEl.value;
    inputEl.value = "";
  });

  inputEl.addEventListener("blur", () => {
    if (inputEl.value !== "") {
      save();
      return;
    }
    const prev = inputEl.dataset[PREV_VALUE_KEY];
    if (!prev) return;
    inputEl.value = prev;
    delete inputEl.dataset[PREV_VALUE_KEY];
  });
}

function handleStart(kind) {
  const inputEl = kind === "break" ? breakMinutesInput : workMinutesInput;
  const storageKey = kind === "break" ? LS_KEY_BREAK : LS_KEY_WORK;
  const raw = Number(inputEl.value);
  const minutes = clampInt(raw, 1, 999);
  if (minutes == null) {
    inputEl.focus();
    inputEl.select?.();
    return;
  }
  try {
    localStorage.setItem(storageKey, String(minutes));
  } catch {
    // ignore
  }
  if (kind === "break") startBreak(minutes);
  else startWork(minutes);
}

attachMinutesPersistence(breakMinutesInput, LS_KEY_BREAK);
attachMinutesPersistence(workMinutesInput, LS_KEY_WORK);

breakStartBtn.addEventListener("click", () => handleStart("break"));
workStartBtn.addEventListener("click", () => handleStart("work"));

breakMinutesInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") breakStartBtn.click();
});
workMinutesInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") workStartBtn.click();
});

stopBtn.addEventListener("click", resetToPrep);

setGaugeProgress(0);
setMode("prep");
