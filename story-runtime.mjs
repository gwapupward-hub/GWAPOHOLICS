/**
 * Narrative presentation data; intentionally does not touch economic settlement.
 * Art paths are RESERVED filenames. Artwork must be exported from Adobe to
 * static assets before the renderer enables them in a public build.
 */

export const STORY_RESULT_BANDS = Object.freeze(["strong", "steady", "rough", "collapse"]);

export const STORY_CHARACTERS = Object.freeze({
  "gwap-o": { name: "GWAP-O", role: "host" },
  advisor: { name: "The Advisor", role: "strategy" },
  "market-force": { name: "The Market Force", role: "pressure" },
  "future-you": { name: "Future You", role: "reflection" }
});

const data = {
  "streaming-pivot": {
    intro: ["gwap-o", "Your DVD business is still winning. But a new screen is changing everything."],
    decisions: [
      ["advisor", "Ten million dollars. You can fund the future, defend today's revenue, or find a balance."],
      ["market-force", "A rival just landed a studio deal. The clock is moving."],
      ["advisor", "Physical delivery still works. Keeping both systems running costs real money."],
      ["gwap-o", "Investors want a confident story. Your cash balance wants the truth."]
    ],
    outcomes: {
      strong: "You invested in change without losing control of the business.",
      steady: "You kept the lights on and moved at a pace the company could carry.",
      rough: "The idea had promise, but execution and cash did not stay in sync.",
      collapse: "The pivot outran the resources. Next time, protect your runway."
    }
  },
  "brand-backlash": {
    intro: ["gwap-o", "Customers loved the old formula. The taste tests love the new one. Uh-oh."],
    decisions: [
      ["advisor", "Launching a product is easier than changing what people think it means."],
      ["market-force", "Retailers are watching the headlines. So is your rival."],
      ["advisor", "Loyal customers feel unheard. Your next response changes the relationship."],
      ["gwap-o", "A brand isn't just a bottle. It's what people believe you stand for."]
    ],
    outcomes: {
      strong: "You made room for change while respecting the people who built your brand.",
      steady: "You protected trust and kept the business moving.",
      rough: "The changes landed, but trust took a real hit.",
      collapse: "You forgot why customers cared. Now you have to rebuild that trust."
    }
  },
  "supply-shock": {
    intro: ["gwap-o", "Your supplier shut down. Orders didn't. Welcome to the pressure cooker."],
    decisions: [
      ["advisor", "The cheapest plan isn't always the one that keeps orders moving."],
      ["market-force", "Ports are congested and the new supplier is asking for more money."],
      ["advisor", "You cannot ship everything first. Your priorities will be remembered."],
      ["gwap-o", "The emergency is easing. What would make the next one less dangerous?"]
    ],
    outcomes: {
      strong: "You built a supply chain that can handle surprises.",
      steady: "The business stayed alive and customers kept receiving orders.",
      rough: "You recovered, but margins and customer trust suffered.",
      collapse: "Too much depended on one fragile route. The shortage won."
    }
  },
  "founder-runway": {
    intro: ["gwap-o", "Great product. Four months of cash. The countdown has started."],
    decisions: [
      ["advisor", "More money can buy time. It cannot buy proof that customers will pay."],
      ["advisor", "Your early customers are asking for features—and offering to pay for some."],
      ["market-force", "A competitor just dropped prices. Respond with purpose, not panic."],
      ["gwap-o", "The team needs a target. Pick the result that proves the business works."]
    ],
    outcomes: {
      strong: "You turned excitement into real customers and usable evidence.",
      steady: "You earned enough proof to fight another day.",
      rough: "You bought time, but the business still needs stronger conversion.",
      collapse: "The cash disappeared before the customer proof arrived."
    }
  },
  "inflation-trap": {
    intro: ["gwap-o", "Prices keep climbing. Everyone has a hot tip. Nobody has tomorrow's newspaper."],
    decisions: [
      ["advisor", "Not every client can afford the same risk or wait the same amount of time."],
      ["advisor", "Someone needs cash earlier than planned. Liquidity is no longer theoretical."],
      ["market-force", "Markets moved against popular bets. Chasing the crowd suddenly feels expensive."],
      ["gwap-o", "Your clients have different futures. Show them a plan that respects that."]
    ],
    outcomes: {
      strong: "You protected purchasing power while respecting each client's timeline.",
      steady: "You avoided the biggest mistakes and preserved most client value.",
      rough: "Some choices cost your clients more value than necessary.",
      collapse: "The wrong risks and forced sales damaged the portfolio badly."
    }
  }
};

export const STORYLINES = Object.freeze(data);

function artPath(caseId, suffix) {
  return `/assets/scenes/${caseId}/${suffix}.${["streaming-pivot", "brand-backlash"].includes(caseId) ? "jpg" : "webp"}`;
}

export function narrativeScene(caseId, phase, { round, band } = {}) {
  const story = STORYLINES[caseId];
  if (!story) return null;
  if (phase === "intro") {
    const [speaker, line] = story.intro;
    return { caseId, phase, speaker, line, image: artPath(caseId, "intro"), motion: "scene-parallax" };
  }
  if (phase === "decision") {
    if (!Number.isInteger(round) || round < 0 || round > 3) return null;
    const [speaker, line] = story.decisions[round];
    return { caseId, phase, round, speaker, line, image: artPath(caseId, "decision-" + String(round + 1).padStart(2, "0")), motion: "bubble-pop" };
  }
  if (phase === "result") {
    if (!STORY_RESULT_BANDS.includes(band)) return null;
    return { caseId, phase, band, speaker: "future-you", line: story.outcomes[band], image: artPath(caseId, "result-" + band), motion: band === "strong" ? "result-burst" : "result-reveal" };
  }
  return null;
}

/* ------------------------------------------------------------------------- *
 * Cinematic presentation (Sprint 1A). Pure display data: focal points,
 * camera presets, lighting and character emotions. Nothing here is read by
 * game-core.mjs, and nothing here may change coins, options or outcomes.
 * ------------------------------------------------------------------------- */

export const CHARACTER_STATES = Object.freeze(["idle", "enter", "talking", "surprised", "worried", "celebrating", "reflecting", "exit"]);
export const CAMERA_PRESETS = Object.freeze(["push", "pull", "pan-left", "pan-right", "pan-down", "drift", "still"]);
export const SCENE_EFFECTS = Object.freeze(["none", "impact", "victory", "glow", "dim"]);

// Portraits are raster concepts on dark plates. `cutout` stays null until a
// transparent export exists; the renderer then switches off the soft mask.
export const CHARACTER_ART = Object.freeze({
  "gwap-o": { image: "/assets/characters/gwap-o", cutout: null, accent: "#13dd13", focus: "50% 46%", zoom: 1.04 },
  advisor: { image: "/assets/characters/advisor", cutout: null, accent: "#36e07a", focus: "46% 26%", zoom: 1.5 },
  "market-force": { image: "/assets/characters/market-force", cutout: null, accent: "#a855f7", focus: "52% 30%", zoom: 1.45 },
  "future-you": { image: "/assets/characters/future-you", cutout: null, accent: "#2dd4bf", focus: "46% 32%", zoom: 1.35 }
});

const pivotScenes = {
  intro: { title: "Mission brief", focal: "34% 42%", camera: "push", origin: "30% 38%", glow: "#13dd13", glowAt: "18% 22%", particles: "rain", emotion: "talking" },
  "decision-01": { title: "The $10M question", focal: "56% 18%", camera: "pan-right", origin: "50% 20%", glow: "#2dd4bf", glowAt: "62% 30%", particles: "dust", emotion: "talking" },
  "decision-02": { title: "The rival deal", focal: "62% 36%", camera: "push", origin: "64% 28%", glow: "#a855f7", glowAt: "30% 30%", particles: "sparks", emotion: "surprised" },
  "decision-03": { title: "The warehouse", focal: "50% 28%", camera: "pan-down", origin: "50% 24%", glow: "#f59e0b", glowAt: "50% 6%", particles: "dust", emotion: "reflecting" },
  "decision-04": { title: "Investor day", focal: "50% 30%", camera: "push", origin: "50% 28%", glow: "#f59e0b", glowAt: "50% 40%", particles: "dust", emotion: "worried" },
  "result-strong": { title: "A platform is born", focal: "40% 26%", camera: "push", origin: "36% 30%", glow: "#13dd13", glowAt: "70% 25%", particles: "coins", emotion: "celebrating", effect: "victory" },
  "result-steady": { title: "Still standing", focal: "55% 42%", camera: "drift", origin: "55% 40%", glow: "#2dd4bf", glowAt: "70% 20%", particles: "dust", emotion: "talking", effect: "glow" },
  "result-rough": { title: "Exposed", focal: "46% 58%", camera: "pan-down", origin: "46% 50%", glow: "#f59e0b", glowAt: "40% 30%", particles: "dust", emotion: "reflecting", effect: "dim" },
  "result-collapse": { title: "Out of runway", focal: "44% 72%", camera: "pull", origin: "44% 70%", glow: "#ef4444", glowAt: "70% 60%", particles: "none", emotion: "worried", effect: "impact" }
};

// Consequence reactions are keyed by the exact resolved outcome text the
// player is already shown, so the emotion can never disagree with (or reveal
// more than) the story beat. Unknown text falls back to a neutral reflection.
const pivotReactions = {
  "You bet the next $10 million on streaming before the audience was ready, and the infrastructure bill arrived first.": "worried",
  "You squeezed more margin from DVDs and let rivals spend first on streaming.": "reflecting",
  "With little runway left, protecting DVD cash kept the company alive while you planned the next move.": "celebrating",
  "You funded a small streaming pilot, and DVD cash paid for the experiment.": "celebrating",
  "The pilot ate into thin cash, leaving no buffer for the quarters ahead.": "worried",
  "The exclusive deal lifted sign-ups for a season, but its cost stayed on the books long after the buzz faded.": "surprised",
  "Your own app let subscribers stream the catalog you already owned, and cancellations began to slow.": "celebrating",
  "Licensed titles filled the app quickly, and the library grew without betting the budget on one exclusive.": "celebrating",
  "Closing the warehouse saved money on paper, but loyal disc customers left faster than the app could absorb them.": "worried",
  "Running both channels for another year kept disc customers while the app earned its place.": "talking",
  "The warehouse kept shipping discs, but rising delivery costs ate most of the margin you had saved.": "reflecting"
};

const brandScenes = Object.freeze({
  intro: { title:"The formula gamble", focal:"50% 38%", camera:"push", origin:"50% 25%", glow:"#13dd13", glowAt:"45% 21%", particles:"dust", emotion:"talking" },
  "decision-01": { title:"Launch or listen", focal:"50% 20%", camera:"pan-right", origin:"50% 24%", glow:"#13dd13", glowAt:"35% 19%", particles:"dust", emotion:"talking" },
  "decision-02": { title:"Retail pressure", focal:"53% 34%", camera:"push", origin:"53% 34%", glow:"#a855f7", glowAt:"45% 22%", particles:"sparks", emotion:"worried" },
  "decision-03": { title:"The public speaks", focal:"50% 32%", camera:"pan-left", origin:"50% 30%", glow:"#ff933b", glowAt:"50% 25%", particles:"dust", emotion:"surprised" },
  "decision-04": { title:"Tell the truth", focal:"51% 28%", camera:"push", origin:"50% 25%", glow:"#a855f7", glowAt:"40% 20%", particles:"dust", emotion:"reflecting" },
  "result-strong": { title:"Trust restored", focal:"48% 25%", camera:"push", origin:"50% 28%", glow:"#13dd13", glowAt:"65% 30%", particles:"coins", emotion:"celebrating", effect:"victory" },
  "result-steady": { title:"A brand rebuilt carefully", focal:"48% 36%", camera:"drift", origin:"48% 30%", glow:"#2dd4bf", glowAt:"50% 30%", particles:"dust", emotion:"reflecting", effect:"glow" },
  "result-rough": { title:"Trust is expensive", focal:"49% 43%", camera:"pan-down", origin:"50% 45%", glow:"#f59e0b", glowAt:"45% 35%", particles:"dust", emotion:"worried", effect:"dim" },
  "result-collapse": { title:"Loyalty has limits", focal:"54% 53%", camera:"pull", origin:"53% 45%", glow:"#ef4444", glowAt:"65% 40%", particles:"none", emotion:"worried", effect:"dim" }
});
export function storyAssetExt(base) {
  return String(base).startsWith("/assets/scenes/brand-backlash/") ? "jpg" : "webp";
}
const PRESENTATION = Object.freeze({
  "streaming-pivot": { scenes: pivotScenes, reactions: pivotReactions },
  "brand-backlash": { scenes: brandScenes, reactions: {} }
});

export function hasStoryMode(caseId) {
  return Object.hasOwn(PRESENTATION, caseId);
}

function sceneKey(phase, { round, band } = {}) {
  if (phase === "intro") return "intro";
  if (phase === "decision" || phase === "consequence") return Number.isInteger(round) && round >= 0 && round <= 3 ? "decision-" + String(round + 1).padStart(2, "0") : null;
  if (phase === "result") return STORY_RESULT_BANDS.includes(band) ? "result-" + band : null;
  return null;
}

/** Display-only direction for one shot. Returns null outside Story Mode. */
export function sceneDirection(caseId, phase, opts = {}) {
  const config = PRESENTATION[caseId];
  const key = sceneKey(phase, opts);
  if (!config || !key) return null;
  const scene = config.scenes[key];
  return {
    caseId,
    key,
    base: `/assets/scenes/${caseId}/${key}`,
    title: scene.title,
    focal: scene.focal,
    camera: scene.camera,
    origin: scene.origin,
    glow: scene.glow,
    glowAt: scene.glowAt,
    particles: scene.particles,
    emotion: scene.emotion,
    effect: scene.effect || "none"
  };
}

export function reactionFor(caseId, outcomeText) {
  return PRESENTATION[caseId]?.reactions[outcomeText] || "reflecting";
}

export function storyReactionTexts(caseId) {
  return Object.keys(PRESENTATION[caseId]?.reactions || {});
}
