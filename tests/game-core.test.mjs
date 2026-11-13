import test from "node:test";
import assert from "node:assert/strict";
import { CASES, RECOVERY_QUESTIONS } from "../cases.mjs";
import { STARTING_COINS, MIN_PLAY_BALANCE, RECOVERY_REWARD, RECOVERY_COOLDOWN_MS, createGame, startCase, chooseStep, completeChain, playableCases, isLocked, isValidGame, recoveryAvailable, completeRecovery } from "../game-core.mjs";

test("five quests each contain four decisions and three options", () => {
  assert.equal(CASES.length, 5);
  assert.equal(new Set(CASES.map((c) => c.id)).size, CASES.length);
  for (const quest of CASES) {
    assert.equal(quest.stages.length, 4, quest.id);
    for (const stage of quest.stages) assert.equal(stage.options.length, 3, quest.id);
  }
});

test("new players receive only the 1,000-coin virtual starting balance", () => {
  const state = createGame(1700000000000, 123);
  assert.equal(state.balance, STARTING_COINS);
  assert.equal(STARTING_COINS, 1000);
  assert.equal(state.played.length, 0);
  assert.equal(playableCases(state).length, CASES.length);
  assert.equal(isValidGame(state), true);
});

test("four decisions settle once and replay does not award coins", () => {
  const quest = CASES[0];
  let state = startCase(createGame(1700000000000, 234), quest.id);
  for (const stage of quest.stages) state = chooseStep(state, quest.id, stage.options[0].id);
  state = completeChain(state, quest.id, 1700000005000);
  assert.equal(state.played.length, 1);
  assert.equal(state.draft, null);
  assert.equal(playableCases(state).length, CASES.length - 1);
  assert.throws(() => startCase(state, quest.id), /already completed|cannot|replay/i);
  assert.throws(() => completeChain(state, quest.id), /Start this scenario|already completed/i);
});

test("below-100 lockout and educational recovery respect 24h cooldown", () => {
  const now = 1700000000000;
  const locked = { ...createGame(now, 234), balance: 0 };
  assert.equal(MIN_PLAY_BALANCE, 100);
  assert.equal(RECOVERY_REWARD, 60);
  assert.equal(isLocked(locked), true);
  assert.equal(recoveryAvailable(locked, now), true);
  assert.equal(playableCases(locked).length, 0);
  const recovered = completeRecovery(locked, RECOVERY_QUESTIONS.map((q) => q.correct), now);
  assert.equal(recovered.balance, 60);
  assert.equal(recoveryAvailable(recovered, now + RECOVERY_COOLDOWN_MS - 1), false);
  assert.equal(recoveryAvailable(recovered, now + RECOVERY_COOLDOWN_MS), true);
});
