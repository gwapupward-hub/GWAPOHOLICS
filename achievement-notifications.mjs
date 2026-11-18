import { ACHIEVEMENTS } from "./daily-enhancements.mjs";

// Presentation is supplied by callbacks. Scheduling does not rely on the DOM,
// animation events, audio, or real time in tests. Only enqueue newly unlocked IDs.
export function createAchievementNotificationQueue({
  achievements = ACHIEVEMENTS,
  onShow = () => {},
  onHide = () => {},
  durationMs = 4200,
  setTimer = (callback, delay) => globalThis.setTimeout(callback, delay),
  clearTimer = (timerId) => globalThis.clearTimeout(timerId)
} = {}) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new RangeError("Notification duration must be a positive finite number.");
  }

  const catalog = new Map(achievements.map((achievement) => [achievement.id, achievement]));
  const seen = new Set();
  const pending = [];
  let active = null;
  let disposed = false;
  let paused = false;

  function schedule(entry) {
    if (disposed || paused || active !== entry) return;
    const generation = ++entry.generation;
    entry.timerId = setTimer(() => {
      if (!disposed && !paused && active === entry && entry.generation === generation) dismiss();
    }, durationMs);
  }

  function showNext() {
    if (disposed || paused || active || !pending.length) return;
    const entry = { achievement: catalog.get(pending.shift()), timerId: null, generation: 0 };
    active = entry;
    try {
      onShow(entry.achievement);
    } catch (error) {
      // A failed renderer must not leave the rest of the queue permanently busy.
      active = null;
      showNext();
      throw error;
    }
    // The callback may synchronously dismiss or dispose the queue.
    schedule(entry);
  }

  function dismiss() {
    if (!active || disposed) return;
    const entry = active;
    active = null;
    if (entry.timerId !== null) clearTimer(entry.timerId);
    try {
      onHide(entry.achievement);
    } finally {
      showNext();
    }
  }

  function enqueue(ids) {
    if (disposed) return 0;
    let accepted = 0;
    for (const id of ids) {
      if (!catalog.has(id) || seen.has(id)) continue;
      seen.add(id);
      pending.push(id);
      accepted += 1;
    }
    showNext();
    return accepted;
  }

  // A resumed badge gets a fresh full display interval.
  function pause() {
    if (disposed || paused) return;
    paused = true;
    if (active && active.timerId !== null) {
      clearTimer(active.timerId);
      active.timerId = null;
      active.generation += 1;
    }
  }

  function resume() {
    if (disposed || !paused) return;
    paused = false;
    if (active) schedule(active);
    else showNext();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    pending.length = 0;
    const entry = active;
    active = null;
    if (!entry) return;
    if (entry.timerId !== null) clearTimer(entry.timerId);
    onHide(entry.achievement);
  }

  return {
    enqueue,
    dismiss,
    pause,
    resume,
    dispose,
    get activeId() { return active?.achievement.id || null; },
    get pendingIds() { return [...pending]; }
  };
}
