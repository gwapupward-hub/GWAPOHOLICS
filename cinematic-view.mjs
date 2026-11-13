import { narrativeScene, STORY_CHARACTERS } from "./story-runtime.mjs";

const MOTION_PREF = "gwapoholics.motion.v1";
const portraits = Object.freeze({
  "gwap-o": "/assets/characters/gwap-o.jpg",
  advisor: "/assets/characters/advisor.jpg",
  "market-force": "/assets/characters/market-force.jpg",
  "future-you": "/assets/characters/future-you.jpg"
});
const esc = (v) => String(v).replace(/[&<>"']/g, (x) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[x]);

let motion = true;
try { motion = localStorage.getItem(MOTION_PREF) !== "off"; } catch { /* storage optional */ }

export function cinematicMotionClass() { return motion ? "" : "story-static"; }
export function toggleCinematicMotion() {
  motion = !motion;
  try { localStorage.setItem(MOTION_PREF, motion ? "on" : "off"); } catch { /* optional */ }
  return motion;
}

export function homeNarrator() {
  return "<div class='cinematic-home-narrator'>" +
    "<img src='/assets/characters/gwap-o.jpg' alt='' width='60' height='60' decoding='async'>" +
    "<span><b>GWAP-O SAYS</b><small>Pick a mission. Make four moves. Let's find out what kind of boss you are.</small></span></div>";
}

/**
 * Storytelling is presentation only: no coin deltas, options, or authoritative
 * settlement inputs. Sprint 1 assets cover only The Streaming Pivot.
 */
export function cinematicScene(entry, phase, { round, band, lineOverride, speakerOverride, compact = false } = {}) {
  if (!entry || entry.id !== "streaming-pivot") return "";
  const scene = narrativeScene(entry.id, phase, { round, band });
  if (!scene) return "";
  const speaker = speakerOverride || scene.speaker;
  const character = STORY_CHARACTERS[speaker];
  if (!character || !portraits[speaker]) return "";
  const line = lineOverride || scene.line;
  const label = phase === "intro" ? "MISSION BRIEF" : phase === "result" ? "AFTER THE DUST SETTLES" : compact ? "THE FALLOUT" : "IN THE ROOM";
  const anim = motion ? "LESS MOTION" : "MORE MOTION";
  const actionLabel = motion ? "Turn story animation off" : "Turn story animation on";
  return "<section class='cinematic-scene cinematic-" + esc(phase) + (compact ? " cinematic-compact" : "") + "' aria-label='" + label + "'>" +
    "<div class='cinematic-backdrop'><img src='" + esc(scene.image) + "' alt='' loading='" + (phase === "intro" ? "eager" : "lazy") + "' decoding='async' width='864' height='1152'><div class='cinematic-vignette'></div></div>" +
    "<div class='cinematic-caption'><span class='cinematic-ribbon'>" + label + "</span>" +
    "<button type='button' class='cinematic-motion-switch' data-action='toggle-story-motion' aria-label='" + actionLabel + "' aria-pressed='" + !motion + "'>" + anim + "</button></div>" +
    "<div class='cinematic-speaker'><img class='cinematic-portrait' src='" + portraits[speaker] + "' alt='' width='80' height='80' loading='lazy' decoding='async'>" +
    "<div class='cinematic-bubble'><strong>" + esc(character.name) + "</strong><p>" + esc(line) + "</p></div></div>" +
    "<span class='cinematic-flare' aria-hidden='true'></span></section>";
}
