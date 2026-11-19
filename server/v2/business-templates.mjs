import { deepFreeze, V2_CONTRACTS } from "./versions.mjs";

/**
 * Starter business templates (contract v1) — INACTIVE and NON-PURCHASABLE.
 *
 * Sprint 1 only registers category references and lets the Founder Hub show a
 * preview. Nothing here can create, charge for or open a business: the
 * `openBusiness` seam always throws, no HTTP command exists for it, and the
 * database trigger on v2_businesses rejects inserts until a later migration.
 *
 * `economics` is the authoritative (approved) configuration and is entirely
 * null until the founder approves numbers. `illustrativeEconomics` holds the
 * planning hypotheses from the roadmap (derived from draft PR #47); they are
 * shown only when the server explicitly enables illustrative previews.
 */
export const BUSINESS_TEMPLATE_VERSION = V2_CONTRACTS.businessTemplate;

const unapprovedEconomics = () => ({
  status: "unapproved",
  setupCostG: null,
  minimumOperatingReserveG: null,
  expectedCycleCostsG: null,
  capacity: null,
  demandModel: null,
  grossMarginPct: null,
  riskVariance: null
});

export const BUSINESS_TEMPLATES = deepFreeze([
  {
    businessTypeId: "food-market-stall", version: BUSINESS_TEMPLATE_VERSION, name: "Food market stall", category: "retail",
    blurb: "Low entry cost, daily foot traffic, perishable stock.",
    status: "inactive", purchasable: false, inventoryApplicable: true,
    economics: unapprovedEconomics(),
    illustrativeEconomics: { approved: false, setupCostG: 250, minimumOperatingReserveG: 75, source: "draft PR #47 market-stall tier" },
    hooks: { content: "business.food-market-stall.scene", art: null }
  },
  {
    businessTypeId: "online-fashion-shop", version: BUSINESS_TEMPLATE_VERSION, name: "Online fashion shop", category: "commerce",
    blurb: "Global reach, trend risk, marketing-driven demand.",
    status: "inactive", purchasable: false, inventoryApplicable: true,
    economics: unapprovedEconomics(),
    illustrativeEconomics: { approved: false, setupCostG: 500, minimumOperatingReserveG: 150, source: "draft PR #47 online-shop tier" },
    hooks: { content: "business.online-fashion-shop.scene", art: null }
  },
  {
    businessTypeId: "barbershop", version: BUSINESS_TEMPLATE_VERSION, name: "Barbershop", category: "services",
    blurb: "Skilled labour, repeat customers, capacity-limited chairs.",
    status: "inactive", purchasable: false, inventoryApplicable: false,
    economics: unapprovedEconomics(),
    illustrativeEconomics: { approved: false, setupCostG: 850, minimumOperatingReserveG: 250, source: "draft PR #47 service-agency tier proxy" },
    hooks: { content: "business.barbershop.scene", art: null }
  }
]);

export const BUSINESS_TYPE_IDS = Object.freeze(BUSINESS_TEMPLATES.map((t) => t.businessTypeId));

/** Client-safe previews. Prices appear only when illustrative economics are explicitly enabled. */
export function previewBusinessTemplates({ showIllustrativeEconomics = false } = {}) {
  return BUSINESS_TEMPLATES.map((t) => ({
    businessTypeId: t.businessTypeId,
    version: t.version,
    name: t.name,
    category: t.category,
    blurb: t.blurb,
    status: "upcoming",
    purchasable: false,
    pricing: showIllustrativeEconomics
      ? {
        label: "Illustrative planning estimate. Not final.",
        setupCostG: t.illustrativeEconomics.setupCostG,
        minimumOperatingReserveG: t.illustrativeEconomics.minimumOperatingReserveG
      }
      : { label: "Pricing is announced when this business opens." }
  }));
}

/** Smallest illustrative entry cost, or null when previews do not expose prices. */
export function entryCapitalThresholdG({ showIllustrativeEconomics = false } = {}) {
  if (!showIllustrativeEconomics) return null;
  return Math.min(...BUSINESS_TEMPLATES.map((t) => t.illustrativeEconomics.setupCostG + t.illustrativeEconomics.minimumOperatingReserveG));
}

/** 'zero' | 'insufficient' | 'unclassified'. Never claims "sufficient": prices are unapproved. */
export function classifyCapital(balanceG, thresholdG) {
  if (!Number.isSafeInteger(balanceG) || balanceG < 0) throw new Error("Invalid capital balance");
  if (balanceG === 0) return "zero";
  if (Number.isSafeInteger(thresholdG) && balanceG < thresholdG) return "insufficient";
  return "unclassified";
}

/** Future-business seam: deliberately unusable in Sprint 1. */
export function openBusiness() {
  const error = new Error("Opening a business is not available yet");
  error.code = "BUSINESS_FEATURE_DISABLED";
  throw error;
}
