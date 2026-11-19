import { FounderError } from "./origin-engine.mjs";

const whole = n => Number.isSafeInteger(n) && n >= 0;

// A reviewed business template owns its scenario, prices, demand and reward limits.
// Configuration is usable only for its original business type and template version.
export function operatingPolicyFor(business, policy) {
  if (!business || !policy || policy.status !== "approved" || policy.businessTypeId !== business.businessTypeId ||
      policy.templateVersion !== business.version || !whole(policy.version) || policy.version < 1 ||
      !whole(policy.cooldownMs) || !policy.cooldownMs || !whole(policy.firstCycleXp) ||
      !Array.isArray(policy.options) || policy.options.length < 2) return null;
  if (!whole(policy.capacity) || policy.capacity < 1) return null;
  if (policy.upgrade && (typeof policy.upgrade.id !== "string" || !/^[a-z][a-z0-9_-]{0,39}$/.test(policy.upgrade.id) ||
      !whole(policy.upgrade.costG) || policy.upgrade.costG < 1 || !whole(policy.upgrade.extraCapacity) ||
      policy.upgrade.extraCapacity < 1 || !whole(policy.capacity + policy.upgrade.extraCapacity))) return null;
  const ids = new Set();
  for (const o of policy.options) {
    if (!o || typeof o.id !== "string" || !/^[a-z][a-z0-9_-]{0,39}$/.test(o.id) || ids.has(o.id) ||
        typeof o.label !== "string" || !o.label.trim() || ![o.stock,o.unitCostG,o.unitPriceG,o.overheadG,o.demand?.scheduled,o.demand?.flexible].every(whole) ||
        !whole(o.stock * o.unitCostG + o.overheadG) || !whole(o.stock * o.unitPriceG)) return null;
    ids.add(o.id);
  }
  return policy;
}

export function operatingChoices(policy) {
  return policy.options.map(o => ({ id: o.id, label: o.label, stock: o.stock, unitPriceG: o.unitPriceG,
    costG: o.stock * o.unitCostG + o.overheadG }));
}

export function settleCycle({ business, previous, upgrades = [], capitalG, policy, choiceId, cycleNumber, policyVersion, now }) {
  if (!policy || policy.version !== policyVersion) throw new FounderError("cycle_closed", "Operating terms unavailable", 409);
  if (cycleNumber !== (previous?.cycleNumber ?? 0) + 1) throw new FounderError("cycle_changed", "Review the latest cycle", 409);
  if (previous && now < previous.nextAt) throw new FounderError("cycle_wait", "The next operating cycle has not started", 409);
  const option = policy.options.find(o => o.id === choiceId);
  if (!option) throw new FounderError("invalid_choice", "Select an available operating choice", 400);
  const costG = option.stock * option.unitCostG + option.overheadG;
  if (capitalG < costG) throw new FounderError("insufficient_capital", "Insufficient operating capital", 409);
  const supplier = business.decision.choiceId;
  const capacity = upgrades.reduce((n,u) => n + u.extraCapacity, policy.capacity);
  const unitsSold = Math.min(option.stock, option.demand[supplier], capacity);
  const revenueG = unitsSold * option.unitPriceG;
  const netG = revenueG - costG;
  const balanceAfterG = capitalG - costG + revenueG;
  const nextAt = now + policy.cooldownMs;
  if (!whole(balanceAfterG) || !whole(nextAt)) throw new FounderError("cycle_closed", "Operating limits exceeded", 409);
  return { cycleNumber, policyVersion, choiceId, supplier, unitsSold, unitPriceG: option.unitPriceG, costG, revenueG,
    netG, balanceBeforeG: capitalG, balanceAfterG, xp: cycleNumber === 1 ? policy.firstCycleXp : 0, settledAt: now, nextAt };
}
