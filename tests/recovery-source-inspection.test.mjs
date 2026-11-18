import test from "node:test";
import assert from "node:assert/strict";
import { inspectRecoverySource } from "../server/recovery-source-inspection.mjs";
const expected="ep-empty-union-bcc2zwqc.c-16.us-east-1.aws.neon.tech";
test("recovery diagnostic only recognizes isolated endpoint and neondb",()=>{
  assert.equal(inspectRecoverySource(`postgresql://user:pass@${expected}/neondb?sslmode=require`),"correct_isolated_source");
  assert.equal(inspectRecoverySource("postgres://user:pass@ep-empty-union-bcc2zwqc-pooler.c-16.us-east-1.aws.neon.tech/neondb"),"correct_isolated_source");
});
test("wrong branch, wrong database, missing and malformed settings fail closed",()=>{
  for (const input of [
    "postgresql://user:pass@ep-super-shadow-bci5cjya.c-16.us-east-1.aws.neon.tech/neondb",
    `postgresql://user:pass@${expected}/other_database`,
    `https://${expected}/neondb`,
    "",
    null
  ]) assert.notEqual(inspectRecoverySource(input),"correct_isolated_source");
});
