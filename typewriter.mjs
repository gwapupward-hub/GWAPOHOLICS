/**
 * TypewriterDialogue. Reveals one or more paragraphs character by character.
 *
 * The core is DOM-free so it can be tested with fake timers: it reports
 * progress through `onFrame({ paragraph, shown, chars })`. `bindTypewriter`
 * wires it to the bubble markup produced by cinematic-view.mjs, where the
 * untyped remainder is already laid out (invisible) so the bubble never
 * changes size while typing. Screen readers get the full text from a
 * separate visually hidden copy; the typed layer is aria-hidden.
 */

export const DEFAULT_TYPE_SPEED = 30; // ms per character, tuned for 25–40ms
export const PARAGRAPH_PAUSE = 420;

const defaultTimers = {
  set: (fn, ms) => globalThis.setTimeout(fn, ms),
  clear: (id) => globalThis.clearTimeout(id)
};

// Splits by code point so emoji and accented characters never break in half.
export const charsOf = (text) => Array.from(String(text ?? ""));

export function clampSpeed(ms) {
  const value = Number(ms);
  return Number.isFinite(value) ? Math.min(80, Math.max(10, Math.round(value))) : DEFAULT_TYPE_SPEED;
}

export function createTypewriter({ paragraphs = [], speed = DEFAULT_TYPE_SPEED, pause = PARAGRAPH_PAUSE, instant = false, timers = defaultTimers, onFrame = () => {}, onDone = () => {} } = {}) {
  const lines = paragraphs.map(charsOf);
  const ms = clampSpeed(speed);
  let paragraph = 0;
  let shown = 0;
  let timer = null;
  let done = false;
  let disposed = false;

  const emit = () => onFrame({ paragraph, shown, chars: lines[paragraph] || [] });
  const stop = () => { if (timer !== null) { timers.clear(timer); timer = null; } };

  const finish = () => {
    if (done || disposed) return;
    stop();
    for (paragraph = 0; paragraph < lines.length; paragraph += 1) { shown = lines[paragraph].length; emit(); }
    paragraph = Math.max(0, lines.length - 1);
    done = true;
    onDone();
  };

  const tick = () => {
    timer = null;
    if (disposed || done) return;
    const line = lines[paragraph];
    if (!line) { finish(); return; }
    if (shown < line.length) {
      shown += 1;
      emit();
      // Brief beats on punctuation keep the rhythm readable.
      const ch = line[shown - 1];
      const beat = /[.!?]/.test(ch) ? ms * 6 : /[,;:—]/.test(ch) ? ms * 3 : ms;
      timer = timers.set(tick, beat);
      return;
    }
    if (paragraph < lines.length - 1) {
      paragraph += 1;
      shown = 0;
      timer = timers.set(tick, pause);
      return;
    }
    done = true;
    onDone();
  };

  return {
    get done() { return done; },
    get progress() { return { paragraph, shown }; },
    start() {
      if (disposed || done || timer !== null) return;
      if (instant || !lines.length) { finish(); return; }
      timer = timers.set(tick, ms);
    },
    /** Tap-to-reveal: shows every remaining character immediately. */
    complete: finish,
    dispose() { disposed = true; stop(); }
  };
}

/** Connects a typewriter to `.tw-line` elements inside a bubble. */
export function bindTypewriter(bubble, options = {}) {
  const nodes = [...bubble.querySelectorAll(".tw-line")].map((line) => ({
    shown: line.querySelector(".tw-shown"),
    rest: line.querySelector(".tw-rest"),
    line
  }));
  const paragraphs = nodes.map((n) => (n.shown?.textContent || "") + (n.rest?.textContent || ""));
  // Later paragraphs stay out of layout until reached, so the bubble grows a paragraph at a time
  // (never a character at a time) and an unstarted bubble is not a large empty box.
  nodes.forEach((n, i) => { n.shown.textContent = ""; n.rest.textContent = paragraphs[i]; n.line.classList.toggle("is-pending", i > 0); });
  return createTypewriter({
    ...options,
    paragraphs,
    onFrame: ({ paragraph, shown, chars }) => {
      const n = nodes[paragraph];
      if (!n) return;
      n.shown.textContent = chars.slice(0, shown).join("");
      n.rest.textContent = chars.slice(shown).join("");
      n.line.classList.remove("is-pending");
      n.line.classList.toggle("is-typing", shown < chars.length);
      options.onFrame?.({ paragraph, shown, chars });
    }
  });
}
