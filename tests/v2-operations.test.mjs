import test from "node:test";
import assert from "node:assert/strict";
import { operatingPolicyFor, settleCycle } from "../server/v2/operations.mjs";
import { operationsFixture as policy } from "./support/founder-suite.mjs";

const business = { businessTypeId:"barbershop", version:1, decision:{choiceId:"scheduled"} };
const args = { business, capitalG:100, policy, choiceId:"small", cycleNumber:1, policyVersion:1, now:1000 };

test("only a matching approved policy with finite whole-G outcomes opens a cycle", () => {
  assert.equal(operatingPolicyFor(business,policy),policy);
  const small=policy.options[0];
  for (const invalid of [null,{...policy,status:"draft"},{...policy,templateVersion:2},{...policy,cooldownMs:0},
    {...policy,options:[small,small]},{...policy,options:[{...small,unitCostG:Number.MAX_SAFE_INTEGER},policy.options[1]]}]) {
    assert.equal(operatingPolicyFor(business,invalid),null);
  }
});

test("supplier commitment, stock and purchased capacity bound real sales and affect the receipt", () => {
  const scheduled=settleCycle(args);
  const flexible=settleCycle({...args,business:{...business,decision:{choiceId:"flexible"}}});
  assert.equal(scheduled.unitsSold,3);
  assert.equal(flexible.unitsSold,2);
  assert.equal(scheduled.netG-flexible.netG,5);
  const constrained={...policy,capacity:1};
  assert.equal(settleCycle({...args,policy:constrained}).unitsSold,1);
  assert.equal(settleCycle({...args,policy:constrained,upgrades:[{extraCapacity:1}]}).unitsSold,2);
  assert.deepEqual(settleCycle(args),scheduled);
});
