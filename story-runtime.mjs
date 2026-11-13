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
  return `/assets/scenes/${caseId}/${suffix}.webp`;
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
