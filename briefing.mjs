const FOUNDER_BRIEFS = [
  {
    id: "runway",
    signal: "Cash buys options.",
    prompt: "If your runway shrank tomorrow, what would you protect first?",
    takeaway: "Protect the evidence loop: customers, margins, and one clear next test."
  },
  {
    id: "focus",
    signal: "Every yes spends attention.",
    prompt: "Which promise deserves the whole team this week?",
    takeaway: "A smaller promise delivered beats a bigger roadmap nobody can explain."
  },
  {
    id: "resilience",
    signal: "Cheap supply can be expensive later.",
    prompt: "Where is one dependency quietly holding your business hostage?",
    takeaway: "Build a second option before the first option becomes an emergency."
  },
  {
    id: "signal",
    signal: "A headline is not a metric.",
    prompt: "What number would prove that customers are actually getting value?",
    takeaway: "Choose the measure closest to a real customer decision, not the easiest number to celebrate."
  },
  {
    id: "trust",
    signal: "Trust compounds slowly and breaks quickly.",
    prompt: "What would you tell the team if the result missed the pitch?",
    takeaway: "Name the gap, share the next move, and make the plan easy to check."
  }
];

const DAY_MS = 24 * 60 * 60 * 1000;
const CYCLE_ANCHOR = Date.UTC(2024, 0, 1);

function asTime(value) {
  const time = value instanceof Date ? value.getTime() : Number(value);
  if (!Number.isFinite(time)) throw new Error("A valid date is required.");
  return time;
}

export function briefingFor(value = Date.now()) {
  const time = asTime(value);
  const day = Math.floor((time - CYCLE_ANCHOR) / DAY_MS);
  const brief = FOUNDER_BRIEFS[((day % FOUNDER_BRIEFS.length) + FOUNDER_BRIEFS.length) % FOUNDER_BRIEFS.length];
  const date = new Date(time);
  return {
    ...brief,
    dateKey: date.toISOString().slice(0, 10),
    dateLabel: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date)
  };
}

export function allBriefings() {
  return FOUNDER_BRIEFS.map((brief) => ({ ...brief }));
}
