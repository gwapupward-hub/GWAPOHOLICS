import { STORY_CHARACTERS, CHARACTER_ART, CHARACTER_STATES, CAMERA_PRESETS, SCENE_EFFECTS } from "./story-runtime.mjs";
import { storyProps } from "./story-props.mjs";

/**
 * Full-screen Story Mode renderer. Returns markup for one cinematic shot:
 * edge-to-edge scene art, lighting/particle layer, a minimal HUD, one speaking
 * character with a typing bubble, and a bottom decision panel.
 *
 * Presentation only. It receives already-resolved, player-visible data (the
 * same labels and outcome text the classic view shows) and never sees coin
 * deltas for individual options.
 */

const MOTION_PREF = "gwapoholics.motion.v1";
export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (x) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[x]);
const coins = (value) => new Intl.NumberFormat("en-US").format(value);

let motionPref = null; // "on" | "off" | null (follow the OS setting)
try { motionPref = globalThis.localStorage?.getItem(MOTION_PREF) ?? null; } catch { /* storage optional */ }

export function prefersReducedMotion() {
  try { return Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches); } catch { return false; }
}

/** Motion is on unless the player turned it off, or the OS asks for less and the player has not overridden it. */
export function storyMotionEnabled() {
  if (motionPref === "on") return true;
  if (motionPref === "off") return false;
  return !prefersReducedMotion();
}

export function cinematicMotionClass() { return storyMotionEnabled() ? "" : "story-static"; }

export function toggleCinematicMotion() {
  motionPref = storyMotionEnabled() ? "off" : "on";
  try { globalThis.localStorage?.setItem(MOTION_PREF, motionPref); } catch { /* optional */ }
  return storyMotionEnabled();
}

export function homeNarrator() {
  return "<div class='cinematic-home-narrator'>" +
    "<picture><source type='image/webp' srcset='/assets/characters/gwap-o.webp'><img src='/assets/characters/gwap-o.jpg' alt='' width='60' height='60' decoding='async'></picture>" +
    "<span><b>GWAP-O SAYS</b><small>Pick a mission. Make four moves. Let's find out what kind of boss you are.</small></span></div>";
}

function picture(base, { width, height, eager = false, cls = "" } = {}) {
  return `<picture><source type="image/webp" srcset="${esc(base)}.webp"><img class="${cls}" src="${esc(base)}.jpg" alt="" width="${width}" height="${height}" decoding="async"${eager ? " fetchpriority=\"high\"" : " loading=\"eager\""}></picture>`;
}

const PARTICLE_COUNTS = { rain: 16, dust: 12, sparks: 10, coins: 22, none: 0 };

function particles(kind) {
  const count = PARTICLE_COUNTS[kind] ?? 0;
  if (!count) return "";
  // Deterministic spread so every render of a shot looks the same.
  const items = Array.from({ length: count }, (_, i) => {
    const x = (i * 37 + 11) % 100;
    const d = ((i * 53) % 17) / 10;
    const s = 0.6 + ((i * 29) % 9) / 10;
    return `<span style="--x:${x}%;--d:${d}s;--s:${s}"></span>`;
  }).join("");
  return `<div class="fx-particles fx-${esc(kind)}">${items}</div>`;
}

function hud({ progress, balance, motion }) {
  const total = progress.total || 0;
  const dots = total ? `<span class="hud-dots" aria-hidden="true">${Array.from({ length: total }, (_, i) => `<i class="${i < progress.done ? "done" : i === progress.current ? "now" : ""}"></i>`).join("")}</span>` : "";
  return `<header class="stage-hud">
    <button type="button" class="hud-btn hud-exit" data-action="story-exit" aria-label="Pause and return to the game home. Progress is kept."><span aria-hidden="true">❚❚</span></button>
    <div class="hud-progress"><span class="hud-label">${esc(progress.label)}</span>${dots}</div>
    <div class="hud-balance" aria-label="Balance ${coins(balance)} virtual G coins"><b aria-hidden="true">◉</b> ${coins(balance)}<small>G</small></div>
    <button type="button" class="hud-btn hud-motion" data-action="toggle-story-motion" aria-pressed="${!motion}" aria-label="${motion ? "Turn story animation off" : "Turn story animation on"}"><span aria-hidden="true">${motion ? "✦" : "✧"}</span></button>
  </header>`;
}

function character(speaker, emotion) {
  const art = CHARACTER_ART[speaker];
  const state = CHARACTER_STATES.includes(emotion) ? emotion : "talking";
  if (!art) return `<div class="stage-character is-missing" aria-hidden="true"></div>`;
  const img = art.cutout
    ? `<img src="${esc(art.cutout)}" alt="" width="600" height="600" decoding="async">`
    : picture(art.image, { width: 600, height: 600 });
  return `<figure class="stage-character${art.cutout ? " has-cutout" : ""}" data-emotion="${state}" style="--accent:${esc(art.accent)};--char-focus:${esc(art.focus)};--char-zoom:${Number(art.zoom) || 1}" aria-hidden="true"><div class="char-body">${img}</div><span class="char-glow"></span></figure>`;
}

function bubble(speaker, lines) {
  const name = STORY_CHARACTERS[speaker]?.name || "Narrator";
  const text = lines.filter(Boolean);
  return `<div class="stage-bubble" role="group" aria-label="${esc(name)} says">
    <strong class="bubble-name">${esc(name.toUpperCase())}</strong>
    <div class="bubble-text" aria-hidden="true">${text.map((line) => `<p class="tw-line"><span class="tw-shown">${esc(line)}</span><span class="tw-rest"></span></p>`).join("")}</div>
    <div class="sr-only">${text.map((line) => `<p>${esc(line)}</p>`).join("")}</div>
    <button type="button" class="bubble-skip" data-action="story-skip">Skip <span aria-hidden="true">▸▸</span></button>
  </div>`;
}

/* ---------------------------- Panels by phase ---------------------------- */

export function introPanel(entry, evidence) {
  return `<p class="panel-kicker">NEW MISSION UNLOCKED <b aria-hidden="true">✦</b></p>
    <h1 class="panel-title" tabindex="-1">${esc(entry.title.toUpperCase())}<em>.</em></h1>
    <p class="panel-hook">${esc(entry.hook)}</p>
    <div class="panel-evidence">${evidence.slice(0, 3).map((e) => `<div><small>${esc(e.label)}</small><b>${esc(e.value)}</b></div>`).join("")}</div>
    <button type="button" class="story-cta" data-action="decide">LET'S DO BUSINESS <b aria-hidden="true">→</b></button>
    <p class="panel-fine">4 moves · coins settle after the last one · fictional outcomes</p>`;
}

export function decisionPanel(step) {
  return `<p class="panel-kicker">⚡ WHAT'S YOUR MOVE? <small>TAP ONE</small></p>
    <h2 class="panel-prompt" tabindex="-1">${esc(step.prompt)}</h2>
    <div class="story-choices">${step.choices.map((c, i) => `<button type="button" class="story-choice" data-action="choose" data-choice="${esc(c.id)}"><span class="choice-letter" aria-hidden="true">${String.fromCharCode(65 + i)}</span><span class="choice-copy"><strong>${esc(c.label)}</strong><small>${esc(c.detail)}</small></span></button>`).join("")}</div>
    <p class="panel-fine">Your choice locks immediately. Coin results come after round ${step.total}.</p>`;
}

export function consequencePanel(movesMade, total) {
  return `<p class="panel-kicker">MOVE ${movesMade} LOCKED IN <b aria-hidden="true">✓</b></p>
    <h2 class="panel-title is-small" tabindex="-1">THAT HAD <em>CONSEQUENCES.</em></h2>
    <p class="panel-fine">Your cash result unlocks after all ${total} decisions.</p>
    <button type="button" class="story-cta" data-action="next-step">ROUND ${movesMade + 1} <b aria-hidden="true">→</b></button>
    <button type="button" class="story-text-btn" data-action="nav" data-view="home">Pause and keep my progress</button>`;
}

export function resultPanel({ run, result, next, locked }) {
  const win = run.delta >= 0;
  const cta = locked
    ? `<button type="button" class="story-cta is-orange" data-action="nav" data-view="recovery">START RECOVERY <b aria-hidden="true">→</b></button>`
    : next
      ? `<button type="button" class="story-cta" data-action="open-case" data-case="${esc(next.id)}">NEXT MISSION: ${esc(next.title.toUpperCase())} <b aria-hidden="true">→</b></button>`
      : `<button type="button" class="story-cta" data-action="nav" data-view="profile">YOUR STRATEGY DNA <b aria-hidden="true">→</b></button>`;
  return `<p class="panel-kicker">★ MISSION COMPLETE ★</p>
    <h2 class="panel-title is-small" tabindex="-1">${win ? "NICE <em>MOVE!</em>" : "TOUGH <em>CALL.</em>"}</h2>
    <div class="panel-balance"><small>NEW BALANCE</small><b>◉ ${coins(run.balanceAfter)} G</b></div>
    <details class="panel-details"><summary>REPLAY YOUR DECISIONS <b aria-hidden="true">⌄</b></summary>${result.steps.map((s, i) => `<div><small>ROUND ${i + 1} · ${s.delta >= 0 ? "+" : ""}${coins(s.delta)} G</small><strong>${esc(s.label)}</strong><p>${esc(s.outcome)}</p></div>`).join("")}</details>
    ${cta}
    <button type="button" class="story-text-btn" data-action="nav" data-view="home">Back to game home</button>
    <p class="panel-fine">Simulated educational outcomes only. No cash or token redemptions.</p>`;
}

/** Settled coin change, shown over the result scene while Future You speaks. */
export function resultScore(delta) {
  const win = delta >= 0;
  return `<div class="stage-score ${win ? "gain" : "loss"}" role="status"><span class="score-sign">${win ? "+" : "−"}</span><b class="count-value" data-target="${Math.abs(delta)}">${coins(Math.abs(delta))}</b><small>G</small><em>SIMULATED COINS ${win ? "GAINED" : "LOST"}</em></div>`;
}

/* ------------------------------- The stage ------------------------------- */

/**
 * @param {object} shot
 * @param {"intro"|"decision"|"consequence"|"result"} shot.phase
 * @param {object} shot.direction  sceneDirection() output
 * @param {string|null} shot.previous  base path of the prior background, for crossfades
 * @param {string} shot.speaker
 * @param {string} shot.emotion
 * @param {string[]} shot.lines
 * @param {string} shot.panel  trusted markup from a *Panel() helper
 * @param {string} [shot.overlay] trusted markup shown under the HUD (result score)
 * @param {string} [shot.effect]
 * @param {string} shot.label  accessible stage label
 * @param {string} shot.ribbon  short scene caption
 * @param {object} shot.progress {label,total,done,current}
 * @param {number} shot.balance
 */
export function storyStage(shot) {
  const d = shot.direction;
  const motion = storyMotionEnabled();
  const camera = CAMERA_PRESETS.includes(d.camera) ? d.camera : "still";
  const effect = SCENE_EFFECTS.includes(shot.effect) ? shot.effect : "none";
  const classes = ["story-stage", `phase-${shot.phase}`, `cam-${camera}`, `effect-${effect}`, motion ? "" : "story-static"].filter(Boolean).join(" ");
  const style = `--focal:${esc(d.focal)};--origin:${esc(d.origin)};--glow:${esc(d.glow)};--glow-at:${esc(d.glowAt)}`;
  const prev = shot.previous && shot.previous !== d.base
    ? `<div class="stage-layer stage-bg-prev" aria-hidden="true">${picture(shot.previous, { width: 896, height: 1152 })}</div>`
    : "";
  return `<section class="${classes}" data-step="background" data-scene="${esc(d.key)}" style="${style}" aria-label="${esc(shot.label)}">
    ${prev}
    <div class="stage-layer stage-bg" aria-hidden="true"><div class="stage-fallback"><span>${esc(d.title)}</span></div><div class="stage-cam">${picture(d.base, { width: 896, height: 1152, eager: true, cls: "stage-art" })}</div></div>
    <div class="stage-layer stage-fx" aria-hidden="true"><i class="fx-glow"></i><i class="fx-tint"></i>${particles(d.particles)}<i class="fx-sweep"></i><i class="fx-flash"></i></div>
    ${storyProps(d.key)}
    <div class="stage-layer stage-shade" aria-hidden="true"></div>
    <div class="stage-ui">
      ${hud({ progress: shot.progress, balance: shot.balance, motion })}
      <div class="stage-top"><span class="stage-ribbon">${esc(shot.ribbon)}</span>${shot.overlay || ""}</div>
      <div class="stage-spacer" data-action="story-hurry"></div>
      <div class="stage-cast" data-action="story-hurry">${character(shot.speaker, shot.emotion)}${bubble(shot.speaker, shot.lines)}</div>
      <div class="stage-panel" inert>${shot.panel}</div>
    </div>
  </section>`;
}
