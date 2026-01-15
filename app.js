/* ================================
   Schmetterling
   - Piano keys trigger videos + SFX
   - Butterfly spawns and avoids overlap
   - Specials (pause BGM during special video):
     * 7-7-7  => PTY.mp4
     * 6-1-2  => me.mp4
     * 0-2    => 02.mp4
     * 7-2-3  => d.mp4
     * 8-1-5  => c.mp4
   - Mobile stability:
     * Do NOT await inside gesture handlers
================================ */

const bgm = document.getElementById("bgm");
const bgmToggle = document.getElementById("bgmToggle");
const stageVideo = document.getElementById("stageVideo");
const idleIcon = document.getElementById("idleIcon");
const butterflyLayer = document.getElementById("butterflyLayer");
const pianoEl = document.querySelector(".piano");
const headlineEl = document.querySelector(".headline");

const keyButtons = Array.from(document.querySelectorAll(".pkey"));
const buttonByIndex = new Map(keyButtons.map((btn) => [Number(btn.dataset.index), btn]));

const KEY_TO_INDEX = {
  "1": 1, "2": 2, "3": 3, "4": 4, "5": 5,
  "6": 6, "7": 7, "8": 8, "9": 9, "0": 10
};

const DEFAULT_BGM_VOL = 0.55;
const VIDEO_VOL = 0.85;

// ===== Special videos =====
const SPECIALS = {
  PTY: { src: "assets/PTY.mp4", pauseBgm: true }, // 7-7-7
  ME:  { src: "assets/me.mp4",  pauseBgm: true }, // 6-1-2
  V02: { src: "assets/02.mp4",  pauseBgm: true }, // 0-2
  D:   { src: "assets/d.mp4",   pauseBgm: true }, // 7-2-3
  C:   { src: "assets/c.mp4",   pauseBgm: true }, // 8-1-5
};

// windows
const TRIPLE_7_WINDOW_MS = 1200;
const SEQ_612_WINDOW_MS = 1500;
const SEQ_02_WINDOW_MS  = 1200;
const SEQ_723_WINDOW_MS = 1500;
const SEQ_815_WINDOW_MS = 1600;

let desiredBgmOn = true;
let currentSpecial = null; // "PTY" | "ME" | "V02" | "D" | "C" | null

// ===== Sequence detectors =====
let seq7Count = 0;
let seq7LastAt = 0;

let seq612Step = 0;  // 0 none, 1 after 6, 2 after 6->1
let seq612LastAt = 0;

let seq02Step = 0;   // 0 none, 1 after 0
let seq02LastAt = 0;

let seq723Step = 0;  // 0 none, 1 after 7, 2 after 7->2
let seq723LastAt = 0;

let seq815Step = 0;  // 0 none, 1 after 8, 2 after 8->1
let seq815LastAt = 0;

function nowMs() {
  return performance.now();
}

function detectTriple7(index) {
  const t = nowMs();

  if (index !== 7) {
    seq7Count = 0;
    seq7LastAt = 0;
    return false;
  }

  if (seq7Count > 0 && (t - seq7LastAt) <= TRIPLE_7_WINDOW_MS) {
    seq7Count += 1;
  } else {
    seq7Count = 1;
  }

  seq7LastAt = t;

  if (seq7Count >= 3) {
    seq7Count = 0;
    seq7LastAt = 0;
    return true;
  }
  return false;
}

function detectSeq612(index) {
  const t = nowMs();

  if (seq612Step !== 0 && (t - seq612LastAt) > SEQ_612_WINDOW_MS) {
    seq612Step = 0;
    seq612LastAt = 0;
  }

  if (index === 6) {
    seq612Step = 1;
    seq612LastAt = t;
    return false;
  }

  if (seq612Step === 1) {
    if (index === 1) {
      seq612Step = 2;
      seq612LastAt = t;
      return false;
    }
    seq612Step = 0;
    seq612LastAt = 0;
    return false;
  }

  if (seq612Step === 2) {
    seq612Step = 0;
    seq612LastAt = 0;
    return index === 2;
  }

  return false;
}

function detectSeq02(index) {
  const t = nowMs();

  if (seq02Step !== 0 && (t - seq02LastAt) > SEQ_02_WINDOW_MS) {
    seq02Step = 0;
    seq02LastAt = 0;
  }

  if (index === 10) { // "0" => index 10
    seq02Step = 1;
    seq02LastAt = t;
    return false;
  }

  if (seq02Step === 1) {
    seq02Step = 0;
    seq02LastAt = 0;
    return index === 2;
  }

  return false;
}

function detectSeq723(index) {
  const t = nowMs();

  if (seq723Step !== 0 && (t - seq723LastAt) > SEQ_723_WINDOW_MS) {
    seq723Step = 0;
    seq723LastAt = 0;
  }

  if (index === 7) {
    seq723Step = 1;
    seq723LastAt = t;
    return false;
  }

  if (seq723Step === 1) {
    if (index === 2) {
      seq723Step = 2;
      seq723LastAt = t;
      return false;
    }
    seq723Step = 0;
    seq723LastAt = 0;
    return false;
  }

  if (seq723Step === 2) {
    seq723Step = 0;
    seq723LastAt = 0;
    return index === 3;
  }

  return false;
}

function detectSeq815(index) {
  const t = nowMs();

  if (seq815Step !== 0 && (t - seq815LastAt) > SEQ_815_WINDOW_MS) {
    seq815Step = 0;
    seq815LastAt = 0;
  }

  if (index === 8) {
    seq815Step = 1;
    seq815LastAt = t;
    return false;
  }

  if (seq815Step === 1) {
    if (index === 1) {
      seq815Step = 2;
      seq815LastAt = t;
      return false;
    }
    seq815Step = 0;
    seq815LastAt = 0;
    return false;
  }

  if (seq815Step === 2) {
    seq815Step = 0;
    seq815LastAt = 0;
    return index === 5;
  }

  return false;
}

// Priority: 6-1-2 > 8-1-5 > 7-2-3 > 0-2 > 7-7-7
function detectSpecial(index) {
  if (detectSeq612(index)) return "ME";
  if (detectSeq815(index)) return "C";
  if (detectSeq723(index)) return "D";
  if (detectSeq02(index))  return "V02";
  if (detectTriple7(index)) return "PTY";
  return null;
}

// ===== Utils =====
function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}
function rand(min, max) {
  return Math.random() * (max - min) + min;
}

// ===== Butterfly timing =====
const BUTTERFLY_LIFETIME_MS = 20000; // 20s
const BUTTERFLY_FADE_MS = 650;

const placedButterflies = []; // {id, x, y, r}
let butterflyCounter = 0;

function isSpotFree(x, y, r) {
  for (const b of placedButterflies) {
    const dx = x - b.x;
    const dy = y - b.y;
    const rr = r + b.r;
    if (dx * dx + dy * dy < rr * rr) return false;
  }
  return true;
}

function removePlacementById(id) {
  const i = placedButterflies.findIndex(b => b.id === id);
  if (i !== -1) placedButterflies.splice(i, 1);
}

function scheduleButterflyRemoval(wrap, id, ms = BUTTERFLY_LIFETIME_MS) {
  window.setTimeout(() => {
    if (!wrap || !wrap.isConnected) {
      removePlacementById(id);
      return;
    }

    const fadeMs = BUTTERFLY_FADE_MS;

    if (wrap.animate) {
      const anim = wrap.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        { duration: fadeMs, easing: "ease", fill: "forwards" }
      );
      anim.onfinish = () => {
        wrap.remove();
        removePlacementById(id);
      };
    } else {
      wrap.style.transition = `opacity ${fadeMs}ms ease`;
      wrap.style.opacity = "0";
      window.setTimeout(() => {
        wrap.remove();
        removePlacementById(id);
      }, fadeMs);
    }
  }, ms);
}

function getUiTopLimit() {
  const toggleBottom = bgmToggle?.getBoundingClientRect().bottom ?? 0;
  const headlineBottom = headlineEl?.getBoundingClientRect().bottom ?? 0;
  return Math.max(24, toggleBottom, headlineBottom) + 12;
}

function findNonOverlappingSpot(target, r, size) {
  const w = window.innerWidth;
  const h = window.innerHeight;

  const pianoTop = pianoEl ? pianoEl.getBoundingClientRect().top : h;
  const topLimit = getUiTopLimit();

  const bottomLimit = Math.max(topLimit + 60, pianoTop - 16);
  const margin = size / 2 + 10;

  const clampX = (x) => clamp(x, margin, w - margin);
  const clampY = (y) => clamp(y, topLimit + margin, bottomLimit - margin);

  const cell = Math.max(56, size + 16);

  const tx = clampX(target.x);
  const ty = clampY(target.y);

  const col0 = Math.round(tx / cell);
  const row0 = Math.round(ty / cell);

  const maxRing = 10;
  for (let ring = 0; ring <= maxRing; ring++) {
    for (let dy = -ring; dy <= 0; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (ring > 0 && Math.abs(dx) !== ring && dy !== -ring && dy !== 0) continue;

        const cx = clampX((col0 + dx) * cell);
        const cy = clampY((row0 + dy) * cell);

        if (isSpotFree(cx, cy, r)) return { x: cx, y: cy };
      }
    }
  }

  return { x: tx, y: clampY(ty - maxRing * cell * 0.55) };
}

function randomPalette() {
  const base = 272 + rand(-10, 10);
  const warm = base + 34 + rand(-10, 10);
  const cool = base - 26 + rand(-8, 8);

  const c1 = `hsl(${base} 96% 68%)`;
  const c2 = `hsl(${warm} 95% 62%)`;
  const c3 = `hsl(${cool} 92% 70%)`;

  const r1 = `hsla(${base + 10} 95% 86% / 0.72)`;
  const r2 = `hsla(${warm} 90% 72% / 0.45)`;
  const r3 = `hsla(${cool} 90% 72% / 0.28)`;

  const glow = `hsla(${base} 95% 62% / 0.22)`;
  const edge = `hsla(${base} 60% 92% / 0.30)`;

  return { c1, c2, c3, r1, r2, r3, glow, edge };
}

function makeButterflySVG(p, uid) {
  const wingL = `wingL-${uid}`;
  const wingR = `wingR-${uid}`;
  const shine = `shine-${uid}`;
  const bodyG = `body-${uid}`;
  const blur = `blur-${uid}`;

  return `
  <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
    <defs>
      <linearGradient id="${wingL}" x1="7" y1="12" x2="34" y2="54" gradientUnits="userSpaceOnUse">
        <stop stop-color="${p.c3}"/>
        <stop offset="0.55" stop-color="${p.c1}"/>
        <stop offset="1" stop-color="${p.c2}"/>
      </linearGradient>

      <linearGradient id="${wingR}" x1="57" y1="12" x2="30" y2="54" gradientUnits="userSpaceOnUse">
        <stop stop-color="${p.c2}"/>
        <stop offset="0.55" stop-color="${p.c1}"/>
        <stop offset="1" stop-color="${p.c3}"/>
      </linearGradient>

      <radialGradient id="${shine}" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse"
        gradientTransform="translate(32 32) rotate(90) scale(24)">
        <stop stop-color="${p.r1}"/>
        <stop offset="0.55" stop-color="${p.r2}"/>
        <stop offset="1" stop-color="${p.r3}"/>
      </radialGradient>

      <linearGradient id="${bodyG}" x1="32" y1="18" x2="32" y2="50" gradientUnits="userSpaceOnUse">
        <stop stop-color="rgba(28,20,52,0.92)"/>
        <stop offset="1" stop-color="rgba(10,8,22,0.92)"/>
      </linearGradient>

      <filter id="${blur}" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="1.15"/>
      </filter>
    </defs>

    <g class="wing wing-left">
      <path d="M31 32C22 16 8 15 8 27c0 14 12 18 19 16c4-1 7-5 4-11Z" fill="url(#${wingL})"/>
      <path d="M31 34c-7-2-16 3-16 12c0 10 12 11 16 0c2-5 2-10 0-12Z" fill="url(#${wingL})" opacity="0.92"/>
      <path d="M31 33C22 18 11 18 11 28c0 10 9 13 15 12c3-1 6-3 5-7Z" fill="url(#${shine})" opacity="0.35" filter="url(#${blur})"/>
      <path d="M27 29c-6 1-10 6-11 11" stroke="rgba(248,242,255,0.45)" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M26 38c-4 0-7 3-8 6" stroke="rgba(248,242,255,0.34)" stroke-width="1.4" stroke-linecap="round"/>
      <circle class="glint" cx="18" cy="30" r="2.3" fill="rgba(255,255,255,0.55)"/>
      <circle cx="16" cy="36" r="1.6" fill="rgba(255,255,255,0.28)"/>
      <circle cx="22" cy="44" r="1.9" fill="rgba(255,255,255,0.22)"/>
      <path d="M31 32C22 16 8 15 8 27c0 14 12 18 19 16c4-1 7-5 4-11Z" fill="none" stroke="${p.edge}" stroke-width="1.1"/>
    </g>

    <g class="wing wing-right">
      <path d="M33 32c9-16 23-17 23-5c0 14-12 18-19 16c-4-1-7-5-4-11Z" fill="url(#${wingR})"/>
      <path d="M33 34c7-2 16 3 16 12c0 10-12 11-16 0c-2-5-2-10 0-12Z" fill="url(#${wingR})" opacity="0.92"/>
      <path d="M33 33c9-15 20-15 20-5c0 10-9 13-15 12c-3-1-6-3-5-7Z" fill="url(#${shine})" opacity="0.35" filter="url(#${blur})"/>
      <path d="M37 29c6 1 10 6 11 11" stroke="rgba(248,242,255,0.45)" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M38 38c4 0 7 3 8 6" stroke="rgba(248,242,255,0.34)" stroke-width="1.4" stroke-linecap="round"/>
      <circle class="glint" cx="46" cy="30" r="2.3" fill="rgba(255,255,255,0.55)"/>
      <circle cx="48" cy="36" r="1.6" fill="rgba(255,255,255,0.28)"/>
      <circle cx="42" cy="44" r="1.9" fill="rgba(255,255,255,0.22)"/>
      <path d="M33 32c9-16 23-17 23-5c0 14-12 18-19 16c-4-1-7-5-4-11Z" fill="none" stroke="${p.edge}" stroke-width="1.1"/>
    </g>

    <path d="M32 18c2.2 0 4.2 6 4.2 14S34.2 46 32 46s-4.2-6-4.2-14S29.8 18 32 18Z" fill="url(#${bodyG})"/>
    <path d="M32 22c1.6 0 3 4.6 3 10.2S33.6 43 32 43s-3-4.6-3-10.2S30.4 22 32 22Z" fill="rgba(255,255,255,0.06)"/>

    <path d="M30 16c-3.4-4.5-6.4-6.7-9-6.7" stroke="rgba(24,18,45,0.92)" stroke-width="2" stroke-linecap="round"/>
    <path d="M34 16c3.4-4.5 6.4-6.7 9-6.7" stroke="rgba(24,18,45,0.92)" stroke-width="2" stroke-linecap="round"/>
    <circle cx="32" cy="20" r="2.2" fill="rgba(24,18,45,0.92)"/>
  </svg>
  `;
}

function getKeyButton(index) {
  return buttonByIndex.get(index) || null;
}

function getKeyOrigin(index, event) {
  const btn = getKeyButton(index);
  if (!btn) return null;

  const rect = btn.getBoundingClientRect();
  let x = rect.left + rect.width / 2;
  let y = rect.top + rect.height * 0.35;

  if (event && typeof event.clientX === "number" && typeof event.clientY === "number") {
    x = clamp(event.clientX, rect.left + 10, rect.right - 10);
    y = clamp(event.clientY, rect.top + 10, rect.bottom - 10);
  }
  return { x, y };
}

function spawnButterfly(index, originEvent) {
  if (!butterflyLayer) return;

  const origin = getKeyOrigin(index, originEvent);
  if (!origin) return;

  const uid = `${Date.now()}-${butterflyCounter++}`;
  const size = rand(52, 66);
  const rot = clamp(rand(-10, 10), -12, 12);
  const palette = randomPalette();

  const baseLift = rand(140, 320);
  const extraLift = Math.random() < 0.35 ? rand(120, 320) : 0;
  const lift = baseLift + extraLift;
  const levelJitter = rand(-60, 60);

  const target = {
    x: origin.x + rand(-14, 14),
    y: origin.y - lift + levelJitter
  };

  const radius = size * 0.45 + 12;
  const spot = findNonOverlappingSpot(target, radius, size);

  placedButterflies.push({ id: uid, x: spot.x, y: spot.y, r: radius });

  const wrap = document.createElement("div");
  wrap.className = "butterfly-wrap";
  wrap.style.left = `${origin.x}px`;
  wrap.style.top = `${origin.y}px`;

  const inner = document.createElement("div");
  inner.className = "butterfly";
  inner.style.width = `${size}px`;
  inner.style.height = `${size}px`;
  inner.style.setProperty("--glow", palette.glow);
  inner.style.setProperty("--flap", `${rand(200, 290).toFixed(0)}ms`);
  inner.style.setProperty("--wiggle", `${rand(3400, 5200).toFixed(0)}ms`);
  inner.style.setProperty("--glintDelay", `${rand(0, 1400).toFixed(0)}ms`);
  inner.innerHTML = makeButterflySVG(palette, uid);

  wrap.appendChild(inner);
  butterflyLayer.appendChild(wrap);

  scheduleButterflyRemoval(wrap, uid, BUTTERFLY_LIFETIME_MS);

  const prefersReduced =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const dx = spot.x - origin.x;
  const dy = spot.y - origin.y;

  if (prefersReduced || !wrap.animate) {
    wrap.style.opacity = "1";
    wrap.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
    return;
  }

  wrap.animate(
    [
      { transform: "translate(0px, 0px) rotate(0deg)", opacity: 0 },
      { transform: "translate(0px, 0px) rotate(0deg)", opacity: 1, offset: 0.12 },
      { transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`, opacity: 1 }
    ],
    { duration: 1100, easing: "cubic-bezier(.16,.85,.22,1)", fill: "forwards" }
  );
}

// ===== UI helpers =====
function showIdleIcon() {
  if (idleIcon) idleIcon.classList.add("show");
}
function hideIdleIcon() {
  if (idleIcon) idleIcon.classList.remove("show");
}
function setKeyActive(index, isActive) {
  const btn = getKeyButton(index);
  if (!btn) return;
  btn.classList.toggle("active", isActive);
}

// ===== Audio / Video =====
function updateBgmUI() {
  bgmToggle.setAttribute("aria-pressed", String(desiredBgmOn));
  bgmToggle.textContent = desiredBgmOn ? "BGM: On" : "BGM: Off";
}

async function ensureBgmAudible() {
  if (!desiredBgmOn) return;
  try {
    bgm.muted = false;
    bgm.volume = DEFAULT_BGM_VOL;
    if (bgm.paused) await bgm.play();
  } catch (err) {
    console.warn("BGM start/resume failed:", err);
  }
}

async function startBgm() {
  await ensureBgmAudible();
}

async function playSfx(index) {
  const sfx = document.getElementById(`sfx${index}`) || null;
  if (!sfx) return;
  try {
    sfx.currentTime = 0;
    await sfx.play();
  } catch (err) {
    console.warn(`SFX ${index} play failed:`, err);
  }
}

function getVideoSrc(index) {
  return `assets/v${index}.mp4`;
}

async function playVideo({ src, pauseBgm, specialName }) {
  const isSame = stageVideo.getAttribute("data-src") === src;

  hideIdleIcon();

  if (!isSame) {
    stageVideo.setAttribute("data-src", src);
    stageVideo.src = src;
  }

  stageVideo.muted = false;
  stageVideo.volume = VIDEO_VOL;

  currentSpecial = specialName || null;

  if (pauseBgm) {
    try { bgm.pause(); } catch (e) {}
  }

  stageVideo.classList.add("show");
  stageVideo.currentTime = 0;

  // play() ASAP in user gesture chain
  const p = stageVideo.play();

  // For normal videos, keep BGM audible (best effort, do not block video)
  if (!pauseBgm) {
    void ensureBgmAudible();
  }

  try {
    await p;
  } catch (err) {
    console.warn("Video play failed:", err);
    stageVideo.classList.remove("show");
    showIdleIcon();
    currentSpecial = null;
    void ensureBgmAudible();
  }
}

async function playNormalVideo(index) {
  if (currentSpecial) {
    currentSpecial = null;
    void ensureBgmAudible();
  }
  await playVideo({ src: getVideoSrc(index), pauseBgm: false, specialName: null });
}

async function playSpecialVideo(name) {
  const cfg = SPECIALS[name];
  if (!cfg) return;
  await playVideo({ src: cfg.src, pauseBgm: cfg.pauseBgm, specialName: name });
}

// ended => show icon + resume BGM if special paused it
stageVideo.addEventListener("ended", () => {
  stageVideo.classList.remove("show");
  showIdleIcon();

  if (currentSpecial && SPECIALS[currentSpecial]?.pauseBgm) {
    currentSpecial = null;
    void ensureBgmAudible();
  }
});

// ===== Main trigger =====
async function trigger(index, originEvent) {
  spawnButterfly(index, originEvent);

  const special = detectSpecial(index);
  if (special) {
    await playSpecialVideo(special);
    return;
  }

  await playNormalVideo(index);
  await playSfx(index);
}

// ===== Interactions =====
// Do NOT await in handlers (mobile gesture reliability)
keyButtons.forEach((btn) => {
  const index = Number(btn.dataset.index);

  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    setKeyActive(index, true);
    void trigger(index, e);
  });

  const release = () => setKeyActive(index, false);
  btn.addEventListener("pointerup", release);
  btn.addEventListener("pointerleave", release);
  btn.addEventListener("pointercancel", release);
});

document.addEventListener("keydown", (e) => {
  const index = KEY_TO_INDEX[e.key];
  if (!index) return;
  if (e.repeat) return;

  setKeyActive(index, true);
  void trigger(index, e);
});

document.addEventListener("keyup", (e) => {
  const index = KEY_TO_INDEX[e.key];
  if (!index) return;
  setKeyActive(index, false);
});

// BGM toggle
bgmToggle.addEventListener("click", () => {
  desiredBgmOn = !desiredBgmOn;

  try {
    if (desiredBgmOn) {
      if (!currentSpecial) void ensureBgmAudible();
    } else {
      bgm.pause();
    }
  } catch (err) {
    console.warn("BGM toggle failed:", err);
  }

  updateBgmUI();
});

// Unlock audio on first user gesture
document.addEventListener("pointerdown", () => void ensureBgmAudible(), { once: true });
document.addEventListener("keydown", () => void ensureBgmAudible(), { once: true });

// Initial state
updateBgmUI();
showIdleIcon();
startBgm();
