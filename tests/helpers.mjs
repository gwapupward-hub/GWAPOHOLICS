// Deterministic timer double for the director and typewriter tests.
export function fakeTimers() {
  let now = 0;
  let id = 0;
  const queue = new Map();
  return {
    set(fn, ms) { id += 1; queue.set(id, { at: now + Math.max(0, ms), fn }); return id; },
    clear(handle) { queue.delete(handle); },
    advance(ms) {
      const end = now + ms;
      for (;;) {
        let next = null;
        for (const [key, t] of queue) if (t.at <= end && (!next || t.at < next[1].at)) next = [key, t];
        if (!next) break;
        queue.delete(next[0]);
        now = next[1].at;
        next[1].fn();
      }
      now = end;
    },
    get pending() { return queue.size; }
  };
}
