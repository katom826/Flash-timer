const appEl = document.getElementById("app");

const panelSettings = document.getElementById("panel-settings");
const panelRunning = document.getElementById("panel-running");
const panelTimeup = document.getElementById("panel-timeup");

const minutesInput1 = document.getElementById("minutesInput1");
const minutesInput2 = document.getElementById("minutesInput2");
const startBtn1 = document.getElementById("startBtn1");
const startBtn2 = document.getElementById("startBtn2");
const stopBtnRunning = document.getElementById("stopBtnRunning");
const stopBtnTimeup = document.getElementById("stopBtnTimeup");

const timeDisplay = document.getElementById("timeDisplay");
const progressCircle = document.querySelector(".gauge__progress");

const LS_KEY_MINUTES_1 = "flash_timer_minutes_1";
const LS_KEY_MINUTES_2 = "flash_timer_minutes_2";
const PREV_VALUE_KEY = "prevValue";

let totalSeconds = 0;
let remainingSeconds = 0;
let tickTimerId = null;
let rafId = null;

function setMode(mode) {
  appEl.dataset.mode = mode;

  panelSettings.hidden = mode !== "settings";
  panelRunning.hidden = mode !== "running";
  panelTimeup.hidden = mode !== "timeup";

  if (mode !== "timeup") appEl.classList.remove("is-blinking");
  if (mode === "timeup") appEl.classList.add("is-blinking");
}

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

function setGaugeProgress(fraction) {
  if (!progressCircle) return;
  const radius = progressCircle.r.baseVal.value;
  const circumference = 2 * Math.PI * radius;
  progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
  const clamped = Math.min(1, Math.max(0, fraction));
  progressCircle.style.strokeDashoffset = String(circumference * (1 - clamped));
}

function stopTick() {
  if (tickTimerId != null) {
    clearInterval(tickTimerId);
    tickTimerId = null;
  }
  if (rafId != null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function updateUI() {
  timeDisplay.textContent = formatMMSS(remainingSeconds);
  const fraction = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;
  setGaugeProgress(fraction);
}

function startTimer(minutes, theme) {
  stopTick();

  totalSeconds = minutes * 60;
  remainingSeconds = totalSeconds;
  if (theme) appEl.dataset.theme = theme;
  setMode("running");
  updateUI();

  const totalMs = totalSeconds * 1000;
  const endAt = performance.now() + totalMs;
  let lastShownSeconds = remainingSeconds;

  const frame = () => {
    const msLeft = endAt - performance.now();
    const clampedMsLeft = Math.max(0, msLeft);

    const nextRemainingSeconds = Math.ceil(clampedMsLeft / 1000);
    if (nextRemainingSeconds !== lastShownSeconds) {
      lastShownSeconds = nextRemainingSeconds;
      remainingSeconds = nextRemainingSeconds;
      timeDisplay.textContent = formatMMSS(remainingSeconds);
    }

    setGaugeProgress(clampedMsLeft / totalMs);

    if (clampedMsLeft <= 0) {
      remainingSeconds = 0;
      timeDisplay.textContent = "00:00";
      stopTick();
      setMode("timeup");
      return;
    }
    rafId = requestAnimationFrame(frame);
  };

  rafId = requestAnimationFrame(frame);
}

function resetToSettings() {
  stopTick();
  totalSeconds = 0;
  remainingSeconds = 0;
  timeDisplay.textContent = "00:00";
  setGaugeProgress(0);
  delete appEl.dataset.theme;
  setMode("settings");
}

function attachPreset(inputEl, buttonEl, storageKey, theme) {
  if (!inputEl || !buttonEl) return;

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

  const load = () => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved != null) inputEl.value = saved;
    } catch {
      // ignore
    }
  };

  buttonEl.addEventListener("click", () => {
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
    startTimer(minutes, theme);
  });

  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") buttonEl.click();
  });

  inputEl.addEventListener("input", save);

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

  load();
}

stopBtnRunning.addEventListener("click", resetToSettings);
stopBtnTimeup.addEventListener("click", resetToSettings);

attachPreset(minutesInput1, startBtn1, LS_KEY_MINUTES_1, "blue");
attachPreset(minutesInput2, startBtn2, LS_KEY_MINUTES_2, "orange");

setGaugeProgress(0);
resetToSettings();
