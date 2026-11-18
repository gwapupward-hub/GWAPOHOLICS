import test from "node:test";
import assert from "node:assert/strict";
import {
  ACHIEVEMENTS,
  MODIFIERS,
  evaluateAchievementUnlocks,
  unlockAchievements,
} from "../daily-enhancements.mjs";

function event(overrides = {}) {
  return {
    challengeId: "daily-2026-11-18",
    dateKey: "2026-11-18",
    score: 300,
    bonusPoints: 35,
    modifierId: "cash-tight",
    miniGameId: "signal-noise",
    miniGameCorrect: false,
    rank: 2,
    ...overrides,
  };
}

function emptyState() {
  return { unlocked: [], history: [] };
}

function utcDate(index) {
  return new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10);
}

function deepFreeze(value) {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

test("each achievement has a unique ID and a supported rarity label", () => {
  const rarities = new Set(["common", "uncommon", "rare", "epic", "legendary"]);
  assert.equal(new Set(ACHIEVEMENTS.map((badge) => badge.id)).size, ACHIEVEMENTS.length);
  for (const badge of ACHIEVEMENTS) assert.ok(rarities.has(badge.rarity), badge.id);
});

test("a minimal first completion unlocks only first-call, including default state", () => {
  const completion = event();
  for (const previous of [undefined, emptyState()]) {
    const result = evaluateAchievementUnlocks(previous, completion);
    assert.deepEqual(Object.keys(result).sort(), ["newlyUnlocked", "state"]);
    assert.deepEqual(result.state, {
      unlocked: ["first-call"],
      history: [completion],
    });
    assert.deepEqual(result.newlyUnlocked, ["first-call"]);
  }
});

test("legacy unlockAchievements keeps its state-only return shape", () => {
  const previous = emptyState();
  const completion = event({ score: 800, bonusPoints: 100, miniGameCorrect: true, rank: 1 });
  const legacy = unlockAchievements(previous, completion);
  assert.deepEqual(Object.keys(legacy).sort(), ["history", "unlocked"]);
  assert.deepEqual(evaluateAchievementUnlocks(previous, completion).state, legacy);
});

test("boardroom-ready starts at 800, not 799", () => {
  for (const score of [799, 800]) {
    const result = evaluateAchievementUnlocks(emptyState(), event({ score }));
    const expected = score === 800 ? ["first-call", "boardroom-ready"] : ["first-call"];
    assert.deepEqual(result.state.unlocked, expected);
    assert.deepEqual(result.newlyUnlocked, expected);
  }
});

test("bonus-hunter starts at 100 bonus points, not 99", () => {
  for (const bonusPoints of [99, 100]) {
    const result = evaluateAchievementUnlocks(emptyState(), event({ bonusPoints }));
    const expected = bonusPoints === 100 ? ["first-call", "bonus-hunter"] : ["first-call"];
    assert.deepEqual(result.state.unlocked, expected);
    assert.deepEqual(result.newlyUnlocked, expected);
  }
});

test("top-of-board requires rank 1 rather than rank 2", () => {
  for (const rank of [2, 1]) {
    const result = evaluateAchievementUnlocks(emptyState(), event({ rank }));
    const expected = rank === 1 ? ["first-call", "top-of-board"] : ["first-call"];
    assert.deepEqual(result.state.unlocked, expected);
    assert.deepEqual(result.newlyUnlocked, expected);
  }
});

test("signal-reader distinguishes correct and incorrect signal-noise answers", () => {
  for (const miniGameCorrect of [false, true]) {
    const result = evaluateAchievementUnlocks(emptyState(), event({
      miniGameId: "signal-noise",
      miniGameCorrect,
      bonusPoints: miniGameCorrect ? 100 : 35,
    }));
    const expected = miniGameCorrect
      ? ["first-call", "bonus-hunter", "signal-reader"]
      : ["first-call"];
    assert.deepEqual(result.state.unlocked, expected);
    assert.deepEqual(result.newlyUnlocked, expected);
  }
});

test("score-chaser must beat the prior BEST score for the same challengeId", () => {
  const previous = {
    unlocked: ["first-call"],
    history: [
      event({ score: 700 }),
      event({ challengeId: "different-case", score: 950 }),
      event({ score: 600 }),
    ],
  };
  for (const score of [650, 700, 701]) {
    const result = evaluateAchievementUnlocks(previous, event({ score }));
    const expected = score === 701 ? ["score-chaser"] : [];
    assert.deepEqual(result.newlyUnlocked, expected, `replay score ${score}`);
    assert.equal(result.state.unlocked.includes("score-chaser"), score === 701);
  }
});

test("a higher score for an unrelated challenge does not unlock score-chaser", () => {
  const previous = {
    unlocked: ["first-call"],
    history: [event({ challengeId: "different-case", score: 600 })],
  };
  const result = evaluateAchievementUnlocks(previous, event({ score: 700 }));
  assert.equal(result.state.unlocked.includes("score-chaser"), false);
  assert.deepEqual(result.newlyUnlocked, []);
});

test("three unique consecutive UTC dates unlock across month and year boundaries", () => {
  for (const dates of [
    ["2026-01-30", "2026-01-31", "2026-02-01"],
    ["2026-12-30", "2026-12-31", "2027-01-01"],
  ]) {
    let state = emptyState();
    for (const dateKey of dates.slice(0, 2)) {
      const completion = event({ dateKey, challengeId: `daily-${dateKey}` });
      state = evaluateAchievementUnlocks(state, completion).state;
      state = evaluateAchievementUnlocks(state, completion).state;
      assert.equal(state.unlocked.includes("three-day-operator"), false);
    }
    const dateKey = dates[2];
    const result = evaluateAchievementUnlocks(state, event({ dateKey, challengeId: `daily-${dateKey}` }));
    assert.equal(result.state.unlocked.includes("three-day-operator"), true);
    assert.deepEqual(result.newlyUnlocked, ["three-day-operator"]);
  }
});

test("gaps and duplicate dates do not manufacture a three-day streak", () => {
  for (const dates of [
    ["2026-12-30", "2027-01-01", "2027-01-02"],
    ["2026-01-30", "2026-01-31", "2026-01-31"],
    ["2026-11-18", "2026-11-18", "2026-11-18"],
  ]) {
    let state = emptyState();
    for (const dateKey of dates) {
      const result = evaluateAchievementUnlocks(state, event({ dateKey, challengeId: `daily-${dateKey}` }));
      assert.equal(result.newlyUnlocked.includes("three-day-operator"), false);
      state = result.state;
    }
    assert.equal(state.unlocked.includes("three-day-operator"), false);
  }
});

for (const [achievementId, threshold] of [["week-one", 7], ["month-in-room", 30]]) {
  test(`${achievementId} requires ${threshold} UNIQUE completed dates despite repeated runs`, () => {
    let state = emptyState();
    for (let index = 0; index < threshold - 1; index += 1) {
      const dateKey = utcDate(index);
      const completion = event({ dateKey, challengeId: `daily-${dateKey}` });
      for (let replay = 0; replay < 2; replay += 1) {
        const result = evaluateAchievementUnlocks(state, completion);
        assert.equal(result.state.unlocked.includes(achievementId), false);
        assert.equal(result.newlyUnlocked.includes(achievementId), false);
        state = result.state;
      }
    }
    const dateKey = utcDate(threshold - 1);
    const completion = event({ dateKey, challengeId: `daily-${dateKey}` });
    const result = evaluateAchievementUnlocks(state, completion);
    assert.equal(new Set(result.state.history.map((entry) => entry.dateKey)).size, threshold);
    assert.equal(result.state.unlocked.includes(achievementId), true);
    assert.deepEqual(result.newlyUnlocked, [achievementId]);
    assert.deepEqual(evaluateAchievementUnlocks(result.state, completion).newlyUnlocked, []);
  });
}

test("modifier-master requires every known modifier; repeating covered modifiers is insufficient", () => {
  let state = emptyState();
  for (const modifier of MODIFIERS.slice(0, -1)) {
    const completion = event({ modifierId: modifier.id });
    for (let replay = 0; replay < MODIFIERS.length; replay += 1) {
      const result = evaluateAchievementUnlocks(state, completion);
      assert.equal(result.state.unlocked.includes("modifier-master"), false);
      state = result.state;
    }
  }
  const result = evaluateAchievementUnlocks(state, event({ modifierId: MODIFIERS.at(-1).id }));
  assert.equal(result.state.unlocked.includes("modifier-master"), true);
  assert.deepEqual(result.newlyUnlocked, ["modifier-master"]);
});

test("unknown modifier IDs cannot stand in for a missing known modifier", () => {
  const previous = {
    unlocked: ["first-call"],
    history: MODIFIERS.slice(0, -1).map((modifier) => event({ modifierId: modifier.id })),
  };
  const result = evaluateAchievementUnlocks(previous, event({ modifierId: "unknown-modifier" }));
  assert.equal(result.state.unlocked.includes("modifier-master"), false);
  assert.deepEqual(result.newlyUnlocked, []);
});

test("old unlocks retain their order and deeply frozen input state/event are not mutated", () => {
  const previous = deepFreeze({
    unlocked: ["top-of-board", "first-call"],
    history: [event({ score: 700 })],
  });
  const completion = deepFreeze(event({ score: 800, bonusPoints: 100, miniGameCorrect: true, rank: 1 }));
  const stateSnapshot = structuredClone(previous);
  const eventSnapshot = structuredClone(completion);
  const result = evaluateAchievementUnlocks(previous, completion);
  assert.deepEqual(previous, stateSnapshot);
  assert.deepEqual(completion, eventSnapshot);
  assert.notEqual(result.state, previous);
  assert.notEqual(result.state.unlocked, previous.unlocked);
  assert.notEqual(result.state.history, previous.history);
  assert.notEqual(result.state.history.at(-1), completion);
  assert.deepEqual(result.state.history, [...stateSnapshot.history, eventSnapshot]);
  assert.deepEqual(result.newlyUnlocked, ["boardroom-ready", "bonus-hunter", "score-chaser", "signal-reader"]);
  assert.deepEqual(result.state.unlocked, [...previous.unlocked, ...result.newlyUnlocked]);
});

test("history keeps only the newest 100 events without forgetting old unlocks", () => {
  const previous = {
    unlocked: ACHIEVEMENTS.map((achievement) => achievement.id),
    history: Array.from({ length: 100 }, (_, index) => {
      const dateKey = utcDate(index);
      return event({ dateKey, challengeId: `daily-${dateKey}` });
    }),
  };
  const dateKey = utcDate(100);
  const completion = event({ dateKey, challengeId: `daily-${dateKey}` });
  const snapshot = structuredClone(previous);
  const result = evaluateAchievementUnlocks(previous, completion);
  assert.equal(result.state.history.length, 100);
  assert.deepEqual(result.state.history, [...previous.history.slice(1), completion]);
  assert.deepEqual(result.state.unlocked, previous.unlocked);
  assert.deepEqual(result.newlyUnlocked, []);
  assert.deepEqual(previous, snapshot);
});

test("newlyUnlocked reports transitions in unlock order, never repeat or lower replays", () => {
  const completion = event({ score: 800, bonusPoints: 100, miniGameCorrect: true, rank: 1 });
  const first = evaluateAchievementUnlocks(emptyState(), completion);
  assert.deepEqual(first.newlyUnlocked, ["first-call", "boardroom-ready", "bonus-hunter", "signal-reader", "top-of-board"]);
  const repeat = evaluateAchievementUnlocks(first.state, completion);
  assert.deepEqual(repeat.newlyUnlocked, []);
  const lower = evaluateAchievementUnlocks(repeat.state, { ...completion, score: 799 });
  assert.deepEqual(lower.newlyUnlocked, []);
  assert.deepEqual(lower.state.unlocked, first.state.unlocked);
  const improved = evaluateAchievementUnlocks(lower.state, { ...completion, score: 801 });
  assert.deepEqual(improved.newlyUnlocked, ["score-chaser"]);
  assert.deepEqual(evaluateAchievementUnlocks(improved.state, { ...completion, score: 801 }).newlyUnlocked, []);
});

test("JSON-reloaded achievement state does not repeat unlock notifications", () => {
  const completion = event({ score: 850, bonusPoints: 100, miniGameCorrect: true, rank: 1 });
  const first = evaluateAchievementUnlocks(emptyState(), completion);
  assert.ok(first.newlyUnlocked.length > 0);
  const reloaded = JSON.parse(JSON.stringify(first.state));
  const repeat = evaluateAchievementUnlocks(reloaded, JSON.parse(JSON.stringify(completion)));
  assert.deepEqual(repeat.newlyUnlocked, []);
  assert.deepEqual(repeat.state.unlocked, reloaded.unlocked);
  const lower = evaluateAchievementUnlocks(JSON.parse(JSON.stringify(repeat.state)), { ...completion, score: 800 });
  assert.deepEqual(lower.newlyUnlocked, []);
  assert.deepEqual(lower.state.unlocked, reloaded.unlocked);
});
