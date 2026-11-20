/**
 * GWAPOHOLICS v2.1 adaptive audio director (experimental).
 * Presentation only. Never derives authoritative economic outcomes from UI state.
 * Tone.js can implement the optional adapter later; the existing sensory layer remains default.
 */
export const AUDIO_EVENTS = Object.freeze({
  SPLASH_REVEAL: "splash.reveal",
  BUSINESS_CONFIRMED: "business.confirmed",
  BUSINESS_REJECTED: "business.rejected",
  FOUNDER_MILESTONE: "founder.milestone"
});
export const AUDIO_PROFILES = Object.freeze({
  [AUDIO_EVENTS.SPLASH_REVEAL]: { mood: "menu", cue: "reveal" },
  [AUDIO_EVENTS.BUSINESS_CONFIRMED]: { mood: "victory", cue: "success" },
  [AUDIO_EVENTS.BUSINESS_REJECTED]: { mood: "tension", cue: "impact" },
  [AUDIO_EVENTS.FOUNDER_MILESTONE]: { mood: "founder", cue: "success" }
});

/**
 * @param {object} options
 * @param {object} options.sensory existing sensory-layer controller
 * @param {object|null} options.adapter optional Tone.js-backed adapter with play(event, profile)
 * @param {number} options.maxReceipts bounded deduplication memory
 */
export function createAudioDirector({ sensory, adapter = null, maxReceipts = 256 } = {}) {
  const receipts = new Set();
  const limit = Number.isInteger(maxReceipts) && maxReceipts > 0 ? maxReceipts : 256;
  let disposed = false;
  function emit(event, { confirmed = false, receiptId = null } = {}) {
    if (disposed || !Object.hasOwn(AUDIO_PROFILES, event)) return false;
    // Business and milestone events must originate from confirmed server receipts.
    if (event !== AUDIO_EVENTS.SPLASH_REVEAL && (!confirmed || typeof receiptId !== "string" || !receiptId.trim())) return false;
    const key = receiptId ? event + ":" + receiptId : null;
    if (key && receipts.has(key)) return false;
    if (key) {
      receipts.add(key);
      if (receipts.size > limit) receipts.delete(receipts.values().next().value);
    }
    const profile = AUDIO_PROFILES[event];
    try {
      if (adapter?.play?.(event, profile) === true) return true;
    } catch { /* fall back to existing presentation layer */ }
    try {
      sensory?.setMood?.(profile.mood);
      sensory?.playEffect?.(profile.cue);
    } catch { /* audio is always optional */ }
    return true;
  }
  function dispose() {
    disposed = true;
    receipts.clear();
    try { adapter?.dispose?.(); } catch { /* optional */ }
  }
  return { emit, dispose };
}
