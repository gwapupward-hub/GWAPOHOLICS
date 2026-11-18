import test from "node:test";
import assert from "node:assert/strict";
import { createAchievementNotificationQueue } from "../achievement-notifications.mjs";
import { evaluateAchievementUnlocks } from "../daily-enhancements.mjs";

function fakeClock() {
  let now = 0;
  let nextId = 0;
  const timers = new Map();
  return {
    setTimer(callback, delay) {
      const id = ++nextId;
      timers.set(id, { callback, at: now + delay });
      return id;
    },
    clearTimer(id) { timers.delete(id); },
    tick(elapsed) {
      const target = now + elapsed;
      for (;;) {
        const next = [...timers.entries()]
          .filter(([, timer]) => timer.at <= target)
          .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!next) break;
        now = next[1].at;
        timers.delete(next[0]);
        next[1].callback();
      }
      now = target;
    },
    get timerCount() { return timers.size; },
    get nextCallback() { return timers.values().next().value?.callback; }
  };
}

function fixture(overrides = {}) {
  const clock = fakeClock();
  const events = [];
  const queue = createAchievementNotificationQueue({
    durationMs: 50,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    onShow: (achievement) => events.push(["show", achievement.id]),
    onHide: (achievement) => events.push(["hide", achievement.id]),
    ...overrides
  });
  return { queue, clock, events };
}

const batch = ["first-call", "bonus-hunter", "top-of-board"];

test("an empty queue does not display a badge or schedule a timer", () => {
  const { queue, clock, events } = fixture();
  assert.equal(queue.enqueue([]), 0);
  queue.dismiss();
  clock.tick(1000);
  assert.equal(queue.activeId, null);
  assert.deepEqual(queue.pendingIds, []);
  assert.deepEqual(events, []);
  assert.equal(clock.timerCount, 0);
});

test("simultaneous unlocks display FIFO, one badge and one timer at a time", () => {
  const { queue, clock, events } = fixture();
  assert.equal(queue.enqueue(batch), 3);
  assert.equal(queue.activeId, "first-call");
  assert.deepEqual(queue.pendingIds, ["bonus-hunter", "top-of-board"]);
  assert.deepEqual(events, [["show", "first-call"]]);
  assert.equal(clock.timerCount, 1);
  clock.tick(50);
  assert.equal(queue.activeId, "bonus-hunter");
  assert.equal(clock.timerCount, 1);
  clock.tick(50);
  assert.equal(queue.activeId, "top-of-board");
  assert.equal(clock.timerCount, 1);
  clock.tick(50);
  assert.equal(queue.activeId, null);
  assert.equal(clock.timerCount, 0);
  assert.deepEqual(events, [
    ["show", "first-call"], ["hide", "first-call"],
    ["show", "bonus-hunter"], ["hide", "bonus-hunter"],
    ["show", "top-of-board"], ["hide", "top-of-board"]
  ]);
});

test("the production default holds a notification for exactly 4200ms", () => {
  const clock = fakeClock();
  const events = [];
  const queue = createAchievementNotificationQueue({
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    onShow: (badge) => events.push(["show", badge.id]),
    onHide: (badge) => events.push(["hide", badge.id])
  });
  queue.enqueue(["first-call"]);
  clock.tick(4199);
  assert.equal(queue.activeId, "first-call");
  assert.equal(events.length, 1);
  clock.tick(1);
  assert.equal(queue.activeId, null);
  assert.deepEqual(events.at(-1), ["hide", "first-call"]);
});

test("new unlocks join behind the active badge and cannot bypass older pending badges", () => {
  const { queue, clock, events } = fixture();
  queue.enqueue(["first-call", "bonus-hunter"]);
  assert.equal(queue.enqueue(["boardroom-ready", "top-of-board"]), 2);
  assert.deepEqual(queue.pendingIds, ["bonus-hunter", "boardroom-ready", "top-of-board"]);
  clock.tick(200);
  assert.deepEqual(events.filter(([kind]) => kind === "show").map(([, id]) => id), [
    "first-call", "bonus-hunter", "boardroom-ready", "top-of-board"
  ]);
  assert.equal(clock.timerCount, 0);
});

test("unknown IDs are skipped and duplicates are suppressed while active, pending, and already shown", () => {
  const { queue, clock, events } = fixture();
  assert.equal(queue.enqueue(["missing", null, "first-call", "first-call", "bonus-hunter"]), 2);
  assert.equal(queue.enqueue(["first-call", "bonus-hunter"]), 0);
  assert.deepEqual(queue.pendingIds, ["bonus-hunter"]);
  clock.tick(100);
  assert.equal(queue.enqueue(["first-call", "bonus-hunter", "missing"]), 0);
  assert.equal(events.filter(([kind]) => kind === "show").length, 2);
  assert.equal(clock.timerCount, 0);
});

test("an unknown-only batch never makes the queue busy", () => {
  const { queue, clock, events } = fixture();
  assert.equal(queue.enqueue(["missing", "", undefined]), 0);
  assert.equal(queue.activeId, null);
  assert.equal(clock.timerCount, 0);
  queue.enqueue(["first-call"]);
  assert.deepEqual(events, [["show", "first-call"]]);
  queue.dispose();
});

test("manual dismissal cancels the active timer and immediately displays the next badge", () => {
  const { queue, clock, events } = fixture();
  queue.enqueue(batch);
  clock.tick(20);
  queue.dismiss();
  assert.equal(queue.activeId, "bonus-hunter");
  assert.equal(clock.timerCount, 1);
  clock.tick(30);
  assert.equal(queue.activeId, "bonus-hunter");
  clock.tick(20);
  assert.equal(queue.activeId, "top-of-board");
  clock.tick(50);
  assert.equal(queue.activeId, null);
  assert.equal(events.filter(([kind, id]) => kind === "hide" && id === "first-call").length, 1);
});

test("pausing an active toast freezes the queue until resume", () => {
  const { queue, clock, events } = fixture();
  queue.enqueue(batch);
  const stale = clock.nextCallback;
  clock.tick(20);
  queue.pause();
  queue.pause();
  assert.equal(clock.timerCount, 0);
  clock.tick(1000);
  assert.equal(queue.activeId, "first-call");
  assert.deepEqual(events, [["show", "first-call"]]);
  queue.resume();
  queue.resume();
  assert.equal(clock.timerCount, 1);
  stale();
  assert.equal(queue.activeId, "first-call", "cancelled timer cannot dismiss resumed toast");
  clock.tick(50);
  assert.equal(queue.activeId, "bonus-hunter");
  queue.dispose();
});

test("while paused, new and dismissed badges wait for resume in FIFO order", () => {
  const { queue, clock, events } = fixture();
  queue.pause();
  queue.enqueue(batch);
  assert.equal(queue.activeId, null);
  assert.equal(clock.timerCount, 0);
  assert.deepEqual(events, []);
  queue.resume();
  assert.equal(queue.activeId, "first-call");
  queue.pause();
  queue.dismiss();
  assert.equal(queue.activeId, null);
  assert.deepEqual(queue.pendingIds, ["bonus-hunter", "top-of-board"]);
  queue.resume();
  assert.equal(queue.activeId, "bonus-hunter");
  clock.tick(100);
  assert.equal(clock.timerCount, 0);
  assert.deepEqual(events.filter(([type]) => type === "show").map(([, id]) => id), batch);
});

test("a late callback from a cancelled timer cannot hide the next active badge", () => {
  const { queue, clock, events } = fixture();
  queue.enqueue(batch);
  const staleCallback = clock.nextCallback;
  queue.dismiss();
  staleCallback();
  assert.equal(queue.activeId, "bonus-hunter");
  assert.deepEqual(queue.pendingIds, ["top-of-board"]);
  assert.deepEqual(events, [["show", "first-call"], ["hide", "first-call"], ["show", "bonus-hunter"]]);
  queue.dispose();
});

test("dispose hides once, discards pending badges, cancels timers, and rejects future work", () => {
  const { queue, clock, events } = fixture();
  queue.enqueue(batch);
  const staleCallback = clock.nextCallback;
  queue.dispose();
  queue.dispose();
  queue.dismiss();
  assert.equal(queue.enqueue(["boardroom-ready"]), 0);
  staleCallback();
  clock.tick(1000);
  assert.equal(queue.activeId, null);
  assert.deepEqual(queue.pendingIds, []);
  assert.equal(clock.timerCount, 0);
  assert.deepEqual(events, [["show", "first-call"], ["hide", "first-call"]]);
});

test("disposing an empty queue does not invoke hide", () => {
  const { queue, clock, events } = fixture();
  queue.dispose();
  assert.deepEqual(events, []);
  assert.equal(clock.timerCount, 0);
});

test("disposing inside the show callback never leaves a newly scheduled timer", () => {
  let queue;
  const clock = fakeClock();
  const hidden = [];
  queue = createAchievementNotificationQueue({
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    onShow: () => queue.dispose(),
    onHide: (badge) => hidden.push(badge.id)
  });
  queue.enqueue(batch);
  assert.equal(queue.activeId, null);
  assert.deepEqual(queue.pendingIds, []);
  assert.equal(clock.timerCount, 0);
  assert.deepEqual(hidden, ["first-call"]);
});

test("synchronous dismissal inside show cannot schedule a stale timer", () => {
  let queue;
  const clock = fakeClock();
  const shown = [];
  queue = createAchievementNotificationQueue({
    durationMs: 50,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    onShow: (badge) => {
      shown.push(badge.id);
      if (badge.id === "first-call") queue.dismiss();
    }
  });
  queue.enqueue(["first-call", "bonus-hunter"]);
  assert.equal(queue.activeId, "bonus-hunter");
  assert.equal(clock.timerCount, 1);
  clock.tick(50);
  assert.deepEqual(shown, ["first-call", "bonus-hunter"]);
  assert.equal(queue.activeId, null);
  assert.equal(clock.timerCount, 0);
});

test("pending snapshots and submitted arrays cannot mutate queue ordering", () => {
  const { queue, clock, events } = fixture();
  const submitted = [...batch];
  queue.enqueue(submitted);
  submitted.reverse();
  const snapshot = queue.pendingIds;
  snapshot.pop();
  assert.deepEqual(queue.pendingIds, ["bonus-hunter", "top-of-board"]);
  clock.tick(150);
  assert.deepEqual(events.filter(([kind]) => kind === "show").map(([, id]) => id), batch);
});

test("invalid notification durations are rejected before scheduling", () => {
  for (const durationMs of [0, -1, NaN, Infinity, "4200"]) {
    assert.throws(() => createAchievementNotificationQueue({ durationMs }), RangeError);
  }
});

test("the queue drains without animation-completion or DOM events", () => {
  const { queue, clock, events } = fixture();
  queue.enqueue(batch);
  clock.tick(150);
  assert.equal(queue.activeId, null);
  assert.equal(clock.timerCount, 0);
  assert.equal(events.length, 6);
});

test("a failed hide callback does not strand remaining unlocks", () => {
  const clock = fakeClock();
  const shown = [];
  const queue = createAchievementNotificationQueue({
    durationMs: 50,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    onShow: (badge) => shown.push(badge.id),
    onHide: (badge) => { if (badge.id === "first-call") throw new Error("renderer failed"); }
  });
  queue.enqueue(["first-call", "bonus-hunter"]);
  assert.throws(() => queue.dismiss(), /renderer failed/);
  assert.equal(queue.activeId, "bonus-hunter");
  assert.equal(clock.timerCount, 1);
  clock.tick(50);
  assert.deepEqual(shown, ["first-call", "bonus-hunter"]);
  assert.equal(clock.timerCount, 0);
});

test("a failed show callback clears its busy state and continues to the next unlock", () => {
  const clock = fakeClock();
  const shown = [];
  const queue = createAchievementNotificationQueue({
    durationMs: 50,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    onShow: (badge) => {
      if (badge.id === "first-call") throw new Error("renderer failed");
      shown.push(badge.id);
    }
  });
  assert.throws(() => queue.enqueue(["first-call", "bonus-hunter"]), /renderer failed/);
  assert.equal(queue.activeId, "bonus-hunter");
  clock.tick(50);
  assert.deepEqual(shown, ["bonus-hunter"]);
  assert.equal(clock.timerCount, 0);
});

test("actual unlock transitions feed the queue once, including after saved-state reload", () => {
  const { queue, clock, events } = fixture();
  const event = {
    challengeId: "daily:2026-11-18:supply",
    dateKey: "2026-11-18",
    score: 850,
    bonusPoints: 100,
    modifierId: "trust-fragile",
    miniGameId: "signal-noise",
    miniGameCorrect: true,
    rank: 1
  };
  const first = evaluateAchievementUnlocks(undefined, event);
  assert.deepEqual(first.newlyUnlocked, ["first-call", "boardroom-ready", "bonus-hunter", "signal-reader", "top-of-board"]);
  queue.enqueue(first.newlyUnlocked);
  clock.tick(250);
  assert.deepEqual(events.filter(([kind]) => kind === "show").map(([, id]) => id), first.newlyUnlocked);

  const saved = JSON.parse(JSON.stringify(first.state));
  const replay = evaluateAchievementUnlocks(saved, { ...event, score: 700 });
  assert.deepEqual(replay.newlyUnlocked, []);
  assert.equal(queue.enqueue(replay.newlyUnlocked), 0);
  const reloaded = fixture();
  assert.equal(reloaded.queue.enqueue(replay.newlyUnlocked), 0);
  assert.deepEqual(reloaded.events, []);
  assert.equal(clock.timerCount, 0);
});
