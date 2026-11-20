import test from "node:test";
import assert from "node:assert/strict";
import { createAudioDirector, AUDIO_EVENTS } from "../audio-director.mjs";

test("rejects unconfirmed economic cues", () => {
  const played = [];
  const director = createAudioDirector({ sensory: { playEffect: x => played.push(x) } });
  assert.equal(director.emit(AUDIO_EVENTS.BUSINESS_CONFIRMED), false);
  assert.deepEqual(played, []);
});
test("deduplicates confirmed receipts and permits independent events", () => {
  const played = [];
  const director = createAudioDirector({ sensory: { playEffect: x => played.push(x) } });
  assert.equal(director.emit(AUDIO_EVENTS.BUSINESS_CONFIRMED, { confirmed: true, receiptId: "tx-1" }), true);
  assert.equal(director.emit(AUDIO_EVENTS.BUSINESS_CONFIRMED, { confirmed: true, receiptId: "tx-1" }), false);
  assert.equal(director.emit(AUDIO_EVENTS.FOUNDER_MILESTONE, { confirmed: true, receiptId: "tx-1" }), true);
  assert.deepEqual(played, ["success", "success"]);
});
test("adapter failure falls back and disposal disables playback", () => {
  const played = [];
  const director = createAudioDirector({ adapter: { play() { throw Error("unavailable"); } }, sensory: { playEffect: x => played.push(x) } });
  assert.equal(director.emit(AUDIO_EVENTS.SPLASH_REVEAL), true);
  director.dispose();
  assert.equal(director.emit(AUDIO_EVENTS.SPLASH_REVEAL), false);
  assert.deepEqual(played, ["reveal"]);
});
test("rejects unknown events", () => {
  const director = createAudioDirector();
  assert.equal(director.emit("arbitrary"), false);
});
