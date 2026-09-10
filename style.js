const root = document.documentElement;
const mango = document.getElementById("mango");
const arena = document.getElementById("interactive-arena");
const overlay = document.getElementById("game-overlay");
const basket = document.getElementById("basket");
const phaseReadout = document.getElementById("phase-readout");
const catchCounter = document.getElementById("catch-counter");

let targetX = 0.5;
let currentX = 0.5;
let catches = 0;

let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;

let tiltX = 0,
  tiltY = 0;
let targetTiltX = 0,
  targetTiltY = 0;

let activeDrops = [];

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/* ---------------------------------------------------------------
 * Cached layout metrics.
 * getBoundingClientRect() forces a synchronous layout recalculation.
 * The original implementation called it on every single mousemove
 * event AND on every animation frame (for both the arena and the
 * basket), which is one of the biggest performance costs in the
 * whole page since mousemove can fire well over 100x/sec.
 * We measure once up front and only re-measure when the layout can
 * actually change (resize / font load), then do pure arithmetic
 * the rest of the time.
 * ------------------------------------------------------------- */

let arenaLeft = 0;
let arenaWidth = 440;
let basketWidth = 85;
let basketHeight = 35;
let halfBasket = basketWidth / 2;
let basketTopRel = 505; // fallback, replaced by measurement below
let basketX = arenaWidth / 2 - halfBasket;

function updateMetrics() {
  const arenaRect = arena.getBoundingClientRect();
  const basketRect = basket.getBoundingClientRect();

  arenaLeft = arenaRect.left;
  arenaWidth = arenaRect.width;
  basketWidth = basketRect.width;
  basketHeight = basketRect.height;
  halfBasket = basketWidth / 2;
  // Basket's vertical position relative to the arena's own top edge.
  // (basket-left is tracked separately via basketX, since that is
  // what we actively drive via transform.)
  basketTopRel = basketRect.top - arenaRect.top;

  // Keep the basket within bounds if the arena resized.
  basketX = clamp(basketX, 0, arenaWidth - basketWidth);
  basket.style.transform = `translate3d(${basketX}px, 0, 0)`;
}

let resizeScheduled = false;
function scheduleMetricsUpdate() {
  if (resizeScheduled) return;
  resizeScheduled = true;
  requestAnimationFrame(() => {
    updateMetrics();
    resizeScheduled = false;
  });
}

window.addEventListener("resize", scheduleMetricsUpdate);
window.addEventListener("load", updateMetrics);
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(updateMetrics);
}
updateMetrics();

/* ---------------------------------------------------------------
 * Color interpolation. Precompute the RGB channels for our two
 * fixed background palettes once instead of re-parsing the hex
 * strings on every animation frame.
 * ------------------------------------------------------------- */
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function interpolateRgb(c1, c2, factor) {
  const r = Math.round(c1[0] + factor * (c2[0] - c1[0]));
  const g = Math.round(c1[1] + factor * (c2[1] - c1[1]));
  const b = Math.round(c1[2] + factor * (c2[2] - c1[2]));
  return `rgb(${r}, ${g}, ${b})`;
}

const unripeBgRgb = ["#060907", "#0f1712"].map(hexToRgb);
const ripeBgRgb = ["#180805", "#2a0f08"].map(hexToRgb);
const unripeGlow = "rgba(163, 230, 53, 0.18)";
const ripeGlow = "rgba(234, 88, 12, 0.25)";

// Instant GPU-Accelerated Mouse Tracking
window.addEventListener(
  "mousemove",
  (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    targetX = clamp(mouseX / window.innerWidth, 0, 1);

    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    targetTiltX = ((mouseY - cy) / cy) * -15;
    targetTiltY = ((mouseX - cx) / cx) * 15;

    // Uses cached arena metrics -- no layout read on the hot path.
    let relativeX = mouseX - arenaLeft;
    relativeX = clamp(relativeX, halfBasket, arenaWidth - halfBasket);
    basketX = relativeX - halfBasket;

    // Direct Instantaneous Hardware-Accelerated Positioning
    basket.style.transform = `translate3d(${basketX}px, 0, 0)`;
  },
  { passive: true }
);

// Click Event: Spawns dropping mini-mango
arena.addEventListener("click", () => {
  spawnMiniMango();
});

function spawnMiniMango() {
  const drop = document.createElement("div");
  drop.className = "mini-mango";

  // Spawn horizontally along the bottom line of the main frame
  const spawnX = 30 + Math.random() * (arenaWidth - 60 - 28);
  const spawnY = 460;

  drop.style.transform = `translate3d(${spawnX}px, ${spawnY}px, 0)`;

  drop.innerHTML = `
                <svg viewBox="0 0 200 250" width="100%" height="100%">
                    <path d="M100 45 C150 45, 185 85, 175 145 C165 205, 110 235, 75 220 C40 205, 25 145, 45 95 C60 60, 80 45, 100 45 Z" fill="url(#miniGrad)"/>
                </svg>
            `;

  overlay.appendChild(drop);

  activeDrops.push({
    element: drop,
    x: spawnX,
    y: spawnY,
    vy: 2.0 + Math.random() * 1.5,
    rotation: Math.random() * 360,
    vRot: (Math.random() - 0.5) * 8,
  });
}

let bumpTimeout = null;

function animate() {
  // Smooth Interpolation for 3D Mango Tilt & Color Transitions
  currentX += (targetX - currentX) * 0.08;
  tiltX += (targetTiltX - tiltX) * 0.08;
  tiltY += (targetTiltY - tiltY) * 0.08;

  root.style.setProperty("--phase-x", `${currentX * 100}%`);
  const phasePct = Math.round(currentX * 100);
  phaseReadout.textContent = `Phase // ${phasePct
    .toString()
    .padStart(2, "0")}%`;

  const currentWeight = Math.round(100 + currentX * 800);
  root.style.setProperty("--text-weight", currentWeight);

  const lightX = Math.round(25 + (mouseX / window.innerWidth) * 50);
  const lightY = Math.round(25 + (mouseY / window.innerHeight) * 50);
  root.style.setProperty("--light-x", `${lightX}%`);
  root.style.setProperty("--light-y", `${lightY}%`);

  // Apply 3D Float on Main Mango
  const floatOffset = Math.sin(Date.now() * 0.0015) * 8;
  mango.style.transform = `translateY(${floatOffset}px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;

  const bg1 = interpolateRgb(unripeBgRgb[0], ripeBgRgb[0], currentX);
  const bg2 = interpolateRgb(unripeBgRgb[1], ripeBgRgb[1], currentX);

  root.style.setProperty("--bg-color-1", bg1);
  root.style.setProperty("--bg-color-2", bg2);
  root.style.setProperty(
    "--accent-glow",
    currentX > 0.5 ? ripeGlow : unripeGlow
  );

  // --- DROP PHYSICS LOOP ---
  // Collision uses cached, arena-relative geometry only -- no
  // getBoundingClientRect() calls in this hot loop.
  for (let i = activeDrops.length - 1; i >= 0; i--) {
    const drop = activeDrops[i];
    drop.y += drop.vy;
    drop.vy += 0.15;
    drop.rotation += drop.vRot;

    drop.element.style.transform = `translate3d(${drop.x}px, ${drop.y}px, 0) rotate(${drop.rotation}deg)`;

    const dropCenterX = drop.x + 14;

    // Collision Detection with Basket Rim
    if (
      drop.y >= basketTopRel &&
      drop.y <= basketTopRel + basketHeight + 8 &&
      dropCenterX >= basketX - 5 &&
      dropCenterX <= basketX + basketWidth + 5
    ) {
      catches++;
      catchCounter.textContent = `CATCHES // ${catches
        .toString()
        .padStart(4, "0")}`;
      catchCounter.classList.add("counter-bump");
      basket.classList.add("basket-caught");

      clearTimeout(bumpTimeout);
      bumpTimeout = setTimeout(() => {
        catchCounter.classList.remove("counter-bump");
        basket.classList.remove("basket-caught");
      }, 200);

      drop.element.remove();
      activeDrops.splice(i, 1);
      continue;
    }

    // Remove out-of-bounds drops
    if (drop.y > 620) {
      drop.element.remove();
      activeDrops.splice(i, 1);
    }
  }

  requestAnimationFrame(animate);
}

animate();
