const appEl = document.getElementById("app");

const panelPrep = document.getElementById("panel-prep");
const panelRunning = document.getElementById("panel-running");

const breakMinutesInput = document.getElementById("breakMinutesInput");
const workMinutesInput = document.getElementById("workMinutesInput");
const breakMinutesSlider = document.getElementById("breakMinutesSlider");
const workMinutesSlider = document.getElementById("workMinutesSlider");
const breakStartBtn = document.getElementById("breakStartBtn");
const workStartBtn = document.getElementById("workStartBtn");

const timeDisplay = document.getElementById("timeDisplay");
const runningLabel = document.getElementById("runningLabel");
const stopBtn = document.getElementById("stopBtn");
const progressCircle = document.querySelector(".gauge__progress");
const confettiCanvas = document.getElementById("confetti");
const confettiCtx = confettiCanvas?.getContext?.("2d") ?? null;

const LS_KEY_BREAK = "flash_timer_break_minutes";
const LS_KEY_WORK = "flash_timer_work_minutes";
const PREV_VALUE_KEY = "prevValue";

let rafId = null;
let confettiRafId = null;
let tickTimeoutId = null;
let mode = "prep"; // "prep" | "running"
let runningKind = null; // "break" | "work" | null

let startAtMs = 0;
let endAtMs = 0;
let targetMs = 0;
let didQuotaCelebrate = false;

const TIMER_FPS = 20;
const TIMER_INTERVAL_MS = Math.round(1000 / TIMER_FPS);

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function resizeConfettiCanvas() {
  if (!confettiCanvas) return;
  const dpr = window.devicePixelRatio || 1;
  const w = Math.floor(window.innerWidth * dpr);
  const h = Math.floor(window.innerHeight * dpr);
  if (confettiCanvas.width === w && confettiCanvas.height === h) return;
  confettiCanvas.width = w;
  confettiCanvas.height = h;
}

function stopConfetti() {
  if (confettiRafId != null) {
    cancelAnimationFrame(confettiRafId);
    confettiRafId = null;
  }
  if (confettiCtx && confettiCanvas) {
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  }
}

function launchConfetti() {
  if (!confettiCanvas || !confettiCtx) return;
  if (prefersReducedMotion()) return;

  stopConfetti();
  resizeConfettiCanvas();

  const dpr = window.devicePixelRatio || 1;
  const width = confettiCanvas.width;
  const height = confettiCanvas.height;

  const colors = ["#59d0ff", "#ff9a3a", "#ffd166", "#9bff6b", "#ff5aa5", "#ffffff"];
  const count = 140;
  const gravity = 620 * dpr;
  const drag = 0.993;

  const particles = Array.from({ length: count }, () => {
    const x = width * (0.35 + Math.random() * 0.3);
    const y = height + (20 + Math.random() * 60) * dpr;
    const vx = (Math.random() - 0.5) * 980 * dpr;
    const vy = -(900 + Math.random() * 950) * dpr;
    const size = (6 + Math.random() * 10) * dpr;
    const rot = Math.random() * Math.PI * 2;
    const vr = (Math.random() - 0.5) * 10;
    return {
      x,
      y,
      vx,
      vy,
      size,
      rot,
      vr,
      color: colors[(Math.random() * colors.length) | 0],
      shape: Math.random() < 0.5 ? "rect" : "tri",
    };
  });

  const maxDurationMs = 9000;
  const start = performance.now();
  let lastT = start;

  const frame = (t) => {
    const dt = Math.min(0.034, (t - lastT) / 1000);
    lastT = t;

    confettiCtx.clearRect(0, 0, width, height);
    confettiCtx.save();

    let anyVisible = false;
    for (const p of particles) {
      p.vy += gravity * dt;
      p.vx *= Math.pow(drag, dt * 60);
      p.vy *= Math.pow(drag, dt * 60);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;

      if (p.y + p.size * 0.8 < -20 * dpr) continue;
      if (p.y - p.size * 0.8 > height + 60 * dpr) continue;
      if (p.x + p.size < -60 * dpr) continue;
      if (p.x - p.size > width + 60 * dpr) continue;
      anyVisible = true;

      confettiCtx.save();
      confettiCtx.translate(p.x, p.y);
      confettiCtx.rotate(p.rot);
      confettiCtx.fillStyle = p.color;

      if (p.shape === "tri") {
        confettiCtx.beginPath();
        confettiCtx.moveTo(0, -p.size * 0.6);
        confettiCtx.lineTo(-p.size * 0.55, p.size * 0.6);
        confettiCtx.lineTo(p.size * 0.55, p.size * 0.6);
        confettiCtx.closePath();
        confettiCtx.fill();
      } else {
        confettiCtx.fillRect(-p.size * 0.5, -p.size * 0.35, p.size, p.size * 0.7);
      }
      confettiCtx.restore();
    }

    confettiCtx.restore();

    if (!anyVisible || t - start >= maxDurationMs) {
      stopConfetti();
      return;
    }
    confettiRafId = requestAnimationFrame(frame);
  };

  confettiRafId = requestAnimationFrame(frame);
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

function stopLoop() {
  if (rafId != null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (tickTimeoutId != null) {
    clearTimeout(tickTimeoutId);
    tickTimeoutId = null;
  }
  stopConfetti();
}

function setMode(nextMode) {
  mode = nextMode;
  appEl.dataset.mode = nextMode;

  panelPrep.hidden = nextMode !== "prep";
  panelRunning.hidden = nextMode !== "running";

  if (nextMode === "prep") {
    appEl.classList.add("is-blinking");
    delete appEl.dataset.theme;
    runningKind = null;
  } else {
    appEl.classList.remove("is-blinking");
  }
}

function scheduleTick(frameFn) {
  tickTimeoutId = window.setTimeout(() => {
    tickTimeoutId = null;
    rafId = requestAnimationFrame(frameFn);
  }, TIMER_INTERVAL_MS);
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
  didQuotaCelebrate = false;
  targetMs = minutes * 60_000;
  const now = performance.now();
  startAtMs = now;
  endAtMs = now + targetMs;

  appEl.dataset.theme = "blue";
  runningLabel.textContent = "";
  setMode("running");

  const frame = () => {
    const msLeft = Math.max(0, endAtMs - performance.now());
    const nextText = formatMMSS(Math.ceil(msLeft / 1000));
    if (timeDisplay.textContent !== nextText) timeDisplay.textContent = nextText;
    setGaugeProgress(targetMs > 0 ? msLeft / targetMs : 0);

    if (msLeft <= 0) {
      resetToPrep();
      return;
    }
    scheduleTick(frame);
  };
  rafId = requestAnimationFrame(frame);
}

function startWork(minutes) {
  stopLoop();
  runningKind = "work";
  didQuotaCelebrate = false;
  targetMs = minutes * 60_000;
  startAtMs = performance.now();

  appEl.dataset.theme = "orange";
  runningLabel.textContent = "";
  setMode("running");

  const frame = () => {
    const elapsedMs = Math.max(0, performance.now() - startAtMs);
    const remainingMs = Math.max(0, targetMs - elapsedMs);
    setGaugeProgress(targetMs > 0 ? remainingMs / targetMs : 0);

    if (remainingMs > 0) {
      const nextText = formatMMSS(Math.ceil(remainingMs / 1000));
      if (timeDisplay.textContent !== nextText) timeDisplay.textContent = nextText;
    } else {
      const nextText = formatMMSS(Math.floor(elapsedMs / 1000));
      if (timeDisplay.textContent !== nextText) timeDisplay.textContent = nextText;
    }

    if (!didQuotaCelebrate && targetMs > 0 && elapsedMs >= targetMs) {
      didQuotaCelebrate = true;
      launchConfetti();
    }

    scheduleTick(frame);
  };
  rafId = requestAnimationFrame(frame);
}

function attachMinutesPersistence(inputEl, sliderEl, storageKey) {
  if (!inputEl) return;

  const save = () => {
    const raw = Number(inputEl.value);
    const minutes = clampInt(raw, 1, 20);
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
    if (sliderEl) {
      if (saved != null) sliderEl.value = saved;
      else if (!sliderEl.value) sliderEl.value = "1";
    }
  } catch {
    // ignore
  }

  inputEl.addEventListener("input", save);
  inputEl.addEventListener("input", () => {
    if (!sliderEl) return;
    const raw = Number(inputEl.value);
    const minutes = clampInt(raw, 1, 20);
    if (minutes == null) return;
    sliderEl.value = String(minutes);
  });

  if (sliderEl) {
    if (!sliderEl.value) sliderEl.value = "1";
    sliderEl.addEventListener("input", () => {
      const minutes = clampInt(Number(sliderEl.value), 1, 999);
      if (minutes == null) return;
      inputEl.value = String(minutes);
      delete inputEl.dataset[PREV_VALUE_KEY];
      save();
    });
  }

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
  const minutes = clampInt(raw, 1, 20);
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

attachMinutesPersistence(breakMinutesInput, breakMinutesSlider, LS_KEY_BREAK);
attachMinutesPersistence(workMinutesInput, workMinutesSlider, LS_KEY_WORK);

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

window.addEventListener("resize", resizeConfettiCanvas);
resizeConfettiCanvas();
