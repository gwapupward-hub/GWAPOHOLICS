import test from "node:test";
import assert from "node:assert/strict";
import { ACHIEVEMENTS, MINI_GAMES, MODIFIERS, allEnhancements, enhancementsFor, enhancedScore, evaluateMiniGame, unlockAchievements } from "../daily-enhancements.mjs";

test("all proposed mini-games are present and daily rotation is deterministic", () => {
  assert.equal(MINI_GAMES.length, 8);
  const first = enhancementsFor("2026-11-18");
  assert.equal(first.miniGame.id, enhancementsFor("2026-11-18").miniGame.id);
  assert.equal(first.modifier.id, enhancementsFor("2026-11-18").modifier.id);
  assert.ok(MINI_GAMES.some((game) => game.id === first.miniGame.id));
  assert.ok(MODIFIERS.some((modifier) => modifier.id === first.modifier.id));
});

test("mini-game scoring and modifiers stay within the daily challenge score bounds", () => {
  const pack = enhancementsFor("2026-11-18");
  const result = evaluateMiniGame(pack.miniGame, pack.miniGame.answer);
  assert.equal(result.points, 100);
  assert.equal(result.correct, true);
  assert.ok(enhancedScore(950, result.points, pack.modifier) <= 1000);
  assert.ok(enhancedScore(-100, 0, pack.modifier) >= 0);
});

test("achievement state unlocks first run, score, bonus, streak, and board rank", () => {
  let state = unlockAchievements(undefined, { challengeId: "d1", dateKey: "2026-11-16", score: 850, bonusPoints: 100, modifierId: "cash-tight", miniGameCorrect: true, rank: 1 });
  state = unlockAchievements(state, { challengeId: "d2", dateKey: "2026-11-17", score: 720, bonusPoints: 40, modifierId: "trust-fragile", miniGameCorrect: false, rank: 2 });
  state = unlockAchievements(state, { challengeId: "d3", dateKey: "2026-11-18", score: 710, bonusPoints: 35, modifierId: "second-order", miniGameCorrect: false, rank: 3 });
  assert.ok(state.unlocked.includes("first-call"));
  assert.ok(state.unlocked.includes("boardroom-ready"));
  assert.ok(state.unlocked.includes("bonus-hunter"));
  assert.ok(state.unlocked.includes("signal-reader"));
  assert.ok(state.unlocked.includes("top-of-board"));
  assert.ok(state.unlocked.includes("three-day-operator"));
});

test("enhancement catalog exposes every content family for the UI", () => {
  const catalog = allEnhancements();
  assert.equal(catalog.miniGames.length, MINI_GAMES.length);
  assert.equal(catalog.modifiers.length, MODIFIERS.length);
  assert.equal(catalog.achievements.length, ACHIEVEMENTS.length);
});

test("long streak achievements require unique completed dates", () => {
  let state;
  for (let index = 0; index < 7; index += 1) {
    state = unlockAchievements(state, { challengeId: "same-day", dateKey: "2026-11-18", score: 300 + index, bonusPoints: 0, modifierId: "no-regrets", miniGameCorrect: false, rank: 2 });
  }
  assert.equal(state.unlocked.includes("week-one"), false);
});
