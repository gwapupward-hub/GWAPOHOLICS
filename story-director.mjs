/**
 * Cinematic scene controller. A small state machine that sequences one shot:
 *
 *   background → camera → details → enter → bubble → typing → choices
 *   choices → locked → feedback → exit (then the caller commits the move)
 *
 * It owns every timer it creates, so a new shot, a skip, or leaving Story Mode
 * can never leave a stale callback behind. It is presentation only: the
 * director never reads or writes game state; `select()` merely gates input
 * and delays the caller's own commit until the feedback beat has played.
 */

export const SCENE_STEPS = Object.freeze(["background", "camera", "details", "enter", "bubble", "typing", "choices"]);
export const EXIT_STEPS = Object.freeze(["locked", "feedback", "exit"]);

// Milliseconds from shot start. Short on purpose: the whole intro runs in about
// one second before typing starts, and any tap skips straight ahead.
export const DEFAULT_TIMELINE = Object.freeze({ background: 0, camera: 120, details: 320, enter: 560, bubble: 860, typing: 1080 });
export const DEFAULT_FEEDBACK = Object.freeze({ feedback: 160, exit: 620, commit: 820 });

const defaultTimers = {
  set: (fn, ms) => globalThis.setTimeout(fn, ms),
  clear: (id) => globalThis.clearTimeout(id)
};

export function createSceneDirector({ timers = defaultTimers, onStep = () => {}, timeline = DEFAULT_TIMELINE, feedback = DEFAULT_FEEDBACK } = {}) {
  let step = "idle";
  let generation = 0;
  let pending = new Set();
  let reduced = false;

  const clearAll = () => {
    for (const id of pending) timers.clear(id);
    pending = new Set();
  };

  const go = (next) => {
    if (step === next) return;
    step = next;
    onStep(next);
  };

  const later = (ms, fn) => {
    const gen = generation;
    const id = timers.set(() => {
      pending.delete(id);
      if (gen === generation) fn();
    }, ms);
    pending.add(id);
  };

  const rank = (name) => SCENE_STEPS.indexOf(name);

  return {
    get step() { return step; },
    get busy() { return EXIT_STEPS.includes(step); },

    /** Starts a new shot, cancelling everything from the previous one. */
    play({ reducedMotion = false } = {}) {
      generation += 1;
      clearAll();
      reduced = reducedMotion;
      step = "idle";
      if (reduced) {
        // Reduced motion: no staging, text appears complete, choices are ready.
        go("choices");
        return;
      }
      for (const name of SCENE_STEPS.slice(0, -1)) {
        const at = timeline[name] ?? 0;
        if (at <= 0) go(name);
        else later(at, () => { if (rank(step) < rank(name)) go(name); });
      }
    },

    /** Narration finished typing (or was revealed in full). */
    typingDone() {
      if (rank(step) < 0 || step === "choices") return;
      clearAll();
      go("choices");
    },

    /**
     * A tap before the dialogue is typing jumps ahead to typing; a tap while
     * typing is handled by the typewriter, which then calls typingDone().
     * Returns the step after hurrying.
     */
    hurry() {
      if (rank(step) >= 0 && rank(step) < rank("typing")) {
        clearAll();
        go("typing");
      }
      return step;
    },

    /** Reveal everything now: full text and the decisions. Never traps players. */
    skip() {
      if (EXIT_STEPS.includes(step) || step === "choices") return step;
      clearAll();
      go("choices");
      return step;
    },

    /**
     * Gate a decision. Only one selection per shot is accepted, and only once
     * the decisions are visible. `commit` runs after the feedback beat.
     */
    select(commit) {
      if (step !== "choices") return false;
      clearAll();
      go("locked");
      if (reduced) {
        go("feedback");
        later(0, () => { go("exit"); commit(); });
        return true;
      }
      later(feedback.feedback, () => go("feedback"));
      later(feedback.exit, () => go("exit"));
      later(feedback.commit, () => commit());
      return true;
    },

    /** Leaving Story Mode or replacing the shot: drop every timer. */
    dispose() {
      generation += 1;
      clearAll();
      step = "idle";
    }
  };
}
