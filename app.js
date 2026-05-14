const appEl = document.getElementById("app");

const panelSettings = document.getElementById("panel-settings");
const panelRunning = document.getElementById("panel-running");
const panelTimeup = document.getElementById("panel-timeup");

const minutesInput = document.getElementById("minutesInput");
const startBtn = document.getElementById("startBtn");
const stopBtnRunning = document.getElementById("stopBtnRunning");
const stopBtnTimeup = document.getElementById("stopBtnTimeup");

const timeDisplay = document.getElementById("timeDisplay");
const progressCircle = document.querySelector(".gauge__progress");

const LS_KEY_MINUTES = "flash_timer_minutes";
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

function startTimer(minutes) {
  stopTick();

  totalSeconds = minutes * 60;
  remainingSeconds = totalSeconds;
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
  setMode("settings");
}

startBtn.addEventListener("click", () => {
  const raw = Number(minutesInput.value);
  const minutes = clampInt(raw, 1, 999);
  if (minutes == null) {
    minutesInput.focus();
    minutesInput.select?.();
    return;
  }
  try {
    localStorage.setItem(LS_KEY_MINUTES, String(minutes));
  } catch {
    // ignore
  }
  startTimer(minutes);
});

stopBtnRunning.addEventListener("click", resetToSettings);
stopBtnTimeup.addEventListener("click", resetToSettings);

minutesInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") startBtn.click();
});

minutesInput.addEventListener("input", () => {
  const raw = Number(minutesInput.value);
  const minutes = clampInt(raw, 1, 999);
  try {
    if (minutes == null) localStorage.removeItem(LS_KEY_MINUTES);
    else localStorage.setItem(LS_KEY_MINUTES, String(minutes));
  } catch {
    // ignore
  }
});

minutesInput.addEventListener("focus", () => {
  if (minutesInput.value === "") return;
  minutesInput.dataset[PREV_VALUE_KEY] = minutesInput.value;
  minutesInput.value = "";
});

minutesInput.addEventListener("blur", () => {
  if (minutesInput.value !== "") return;
  const prev = minutesInput.dataset[PREV_VALUE_KEY];
  if (!prev) return;
  minutesInput.value = prev;
  delete minutesInput.dataset[PREV_VALUE_KEY];
});

setGaugeProgress(0);
resetToSettings();

// Restore last minutes from localStorage
try {
  const saved = localStorage.getItem(LS_KEY_MINUTES);
  if (saved != null) minutesInput.value = saved;
} catch {
  // ignore
}
