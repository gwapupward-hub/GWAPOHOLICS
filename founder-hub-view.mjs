import { esc } from "./cinematic-view.mjs";
import { CHARACTER_ART, sceneDirection, storyAssetExt } from "./story-runtime.mjs";

/**
 * Presentation-only markup for the v2.1-A Origin flow and Founder Hub.
 * Receives the server's snapshot and never computes scores, capital, goals or
 * eligibility. Every server string is escaped. No purchase control exists for
 * upcoming businesses: previews render as information only.
 */
const fmt = (value) => new Intl.NumberFormat("en-US").format(value);

const CAPITAL_COPY = {
  zero: { chip: "ZERO CAPITAL", tone: "is-zero", text: "You start with 0 G. That is a starting line, not a verdict: replay the Origin to earn capital." },
  insufficient: { chip: "INSUFFICIENT STARTING CAPITAL", tone: "is-low", text: "Not enough yet to open a company. Replay the Origin to raise it. Only improvements pay." },
  unclassified: { chip: "CAPITAL VERIFIED", tone: "is-ok", text: "Your Origin capital is verified and held for your first company." }
};
const HERO_LINE = {
  zero: "Zero capital is a starting line, not a verdict. Beat your best and the Origin pays you for it.",
  insufficient: "Not enough to open a company yet. Replay the Origin. Only an improvement pays, and a worse run never costs you.",
  unclassified: "Your Origin is verified. Your first company is next. Until then, your capital waits for you."
};
const GOAL_CHIP = { completed: "DONE", in_progress: "IN PROGRESS", available: "UP NEXT", upcoming: "UPCOMING" };

/** Presentation-only: picks result art for a verified score (never used for any economic decision). */
export function storyBandForScore(scoreG, maxG) {
  const ratio = maxG > 0 ? scoreG / maxG : 0;
  return ratio >= 0.75 ? "strong" : ratio >= 0.5 ? "steady" : ratio >= 0.25 ? "rough" : "collapse";
}

function picture(base, cls, size) {
  const webp = storyAssetExt(base) === "webp" ? `<source type="image/webp" srcset="${esc(base)}.webp">` : "";
  return `<picture>${webp}<img class="${cls}" src="${esc(base)}.jpg" alt="" width="${size}" height="${size}" decoding="async"></picture>`;
}

function draftChip(state) {
  return state.origin?.policy?.approvalStatus === "unapproved"
    ? `<p class="fh-draft" role="note"><b>PREVIEW SCORING</b> Scoring numbers are not final and may change before launch.</p>`
    : "";
}

const FINE = `<p class="fh-fine">Fictional, non-transferable G · no cash value · educational simulation</p>`;

/* ----------------------------- Origin gate ----------------------------- */

export function originGatePage(state) {
  const o = state.origin;
  if (!o.available) {
    return `<div class="fh-page page-enter"><div class="eyebrow with-line">FOUNDER ENTRY <span>NOT OPEN YET</span></div>
      <div class="page-heading"><h1>THE ORIGIN<br><em>OPENS SOON.</em></h1><p>${esc(o.unavailableMessage || "Origin qualification is not open yet.")}</p></div>${FINE}</div>`;
  }
  const cta = state.nextStep?.action;
  // The button must do what its label says for every server-provided next step, not only "start".
  const ctaAction = { origin_start_run: "fh-start-run", enter_hub: "fh-enter-hub", open_origin: "fh-open-run" }[cta?.kind];
  return `<div class="fh-page page-enter"><div class="eyebrow with-line">FOUNDER ENTRY <span>THE BUSINESS UNDERWORLD</span></div>
    <div class="page-heading"><h1>START AT<br><em>ZERO.</em></h1><p>You begin with 0 G. Play five cinematic quests. Your verified Origin Score becomes your startup capital.</p></div>
    ${draftChip(state)}
    <ol class="fh-rules">
      <li><b>1</b><span><strong>Five quests, four decisions each.</strong><small>Every choice changes what happens next.</small></span></li>
      <li><b>2</b><span><strong>Capital arrives when you finish all five.</strong><small>An unfinished run earns nothing, and you can pick it up later.</small></span></li>
      <li><b>3</b><span><strong>Replay as often as you like.</strong><small>Only a score above your personal best pays. A lower score never costs you.</small></span></li>
    </ol>
    <p class="fh-note">Played the original season? Your original coins stay exactly as they are and are completely separate from your founder capital.</p>
    ${cta && ctaAction ? `<button class="arcade-button" data-action="${ctaAction}">${esc(cta.label)} <b>→</b></button>` : ""}
    ${FINE}</div>`;
}

/* ---------------------------- Origin run page ---------------------------- */

export function originRunPage(state, quests) {
  const q = state.quest;
  const done = new Set(q.completed.map((c) => c.caseId));
  const openId = q.draft?.caseId ?? null;
  const next = quests.find((entry) => !done.has(entry.id));
  const max = state.origin.policy.maxScoreG;
  return `<div class="fh-page page-enter"><div class="eyebrow with-line">ORIGIN RUN ${q.runNumber} <span>${done.size} / ${q.questIds.length} QUESTS</span></div>
    <div class="page-heading"><h1>YOUR<br><em>ORIGIN.</em></h1><p>Finish all five to verify your score. Capital is credited once, when the run is complete.</p></div>
    ${draftChip(state)}
    <div class="fh-score"><span>SCORE SO FAR</span><strong>${fmt(q.provisionalScoreG)}<small> / ${fmt(max)}</small></strong><em>Provisional until all five are done</em></div>
    <div class="case-list">${quests.map((entry) => {
      const row = q.completed.find((c) => c.caseId === entry.id);
      return `<button class="case-list-item ${row ? "done" : ""}" data-action="${row ? "fh-view-quest" : "fh-open-quest"}" data-case="${esc(entry.id)}">
        <div class="case-list-num">${esc(entry.number)}</div><div class="case-list-content"><span class="case-list-category">${esc(entry.category.toUpperCase())} <span>· ${entry.minutes} MIN</span></span><strong>${esc(entry.title)}</strong><small>${row ? `SCORED · ${fmt(row.questScoreG)} / ${fmt(row.maxQuestScoreG)}` : openId === entry.id ? "IN PROGRESS · RESUME" : esc(entry.hook)}</small></div><span class="case-list-arrow">${row ? "✓" : "↗"}</span>
      </button>`;
    }).join("")}</div>
    ${next ? `<button class="arcade-button" data-action="fh-open-quest" data-case="${esc(openId ?? next.id)}">${openId ? "RESUME QUEST" : "PLAY NEXT QUEST"} <b>→</b></button>` : ""}
    ${FINE}</div>`;
}

/* ------------------------- Cinematic quest panels ------------------------- */

export function originIntroPanel(entry, evidence, { index, total, maxScoreG }) {
  return `<p class="panel-kicker">ORIGIN QUEST ${index} OF ${total} <b aria-hidden="true">✦</b></p>
    <h1 class="panel-title" tabindex="-1">${esc(entry.title.toUpperCase())}<em>.</em></h1>
    <p class="panel-hook">${esc(entry.hook)}</p>
    <div class="panel-evidence">${evidence.slice(0, 3).map((e) => `<div><small>${esc(e.label)}</small><b>${esc(e.value)}</b></div>`).join("")}</div>
    <button type="button" class="story-cta" data-action="og-decide">LET'S DO BUSINESS <b aria-hidden="true">→</b></button>
    <p class="panel-fine">4 moves · up to ${fmt(maxScoreG)} Origin points · capital is credited when all five quests are done</p>`;
}

export function originDecisionPanel(step) {
  return `<p class="panel-kicker">⚡ WHAT'S YOUR MOVE? <small>TAP ONE</small></p>
    <h2 class="panel-prompt" tabindex="-1">${esc(step.prompt)}</h2>
    <div class="story-choices">${step.choices.map((c, i) => `<button type="button" class="story-choice" data-action="og-choose" data-choice="${esc(c.id)}"><span class="choice-letter" aria-hidden="true">${String.fromCharCode(65 + i)}</span><span class="choice-copy"><strong>${esc(c.label)}</strong><small>${esc(c.detail)}</small></span></button>`).join("")}</div>
    <p class="panel-fine">Your choice locks immediately. Your quest score comes after round ${step.total}.</p>`;
}

export function originConsequencePanel(movesMade, total) {
  return `<p class="panel-kicker">MOVE ${movesMade} LOCKED IN <b aria-hidden="true">✓</b></p>
    <h2 class="panel-title is-small" tabindex="-1">THAT HAD <em>CONSEQUENCES.</em></h2>
    <p class="panel-fine">Your quest score unlocks after all ${total} decisions.</p>
    <button type="button" class="story-cta" data-action="og-next">ROUND ${movesMade + 1} <b aria-hidden="true">→</b></button>
    <button type="button" class="story-text-btn" data-action="story-exit">Pause and keep my progress</button>`;
}

export function originScoreOverlay(row) {
  return `<div class="stage-score gain" role="status"><span class="score-sign">+</span><b class="count-value" data-target="${row.questScoreG}">${fmt(row.questScoreG)}</b><small>PTS</small><em>ORIGIN POINTS · OUT OF ${fmt(row.maxQuestScoreG)}</em></div>`;
}

export function originQuestResultPanel({ row, state, nextEntry }) {
  const finalized = state.quest.status === "finalized";
  const cta = finalized
    ? `<button type="button" class="story-cta" data-action="og-graduate">SEE YOUR VERIFIED SCORE <b aria-hidden="true">→</b></button>`
    : nextEntry
      ? `<button type="button" class="story-cta" data-action="og-next-quest" data-case="${esc(nextEntry.id)}">NEXT QUEST: ${esc(nextEntry.title.toUpperCase())} <b aria-hidden="true">→</b></button>`
      : `<button type="button" class="story-cta" data-action="story-exit">BACK TO YOUR ORIGIN <b aria-hidden="true">→</b></button>`;
  return `<p class="panel-kicker">★ QUEST COMPLETE ★</p>
    <h2 class="panel-title is-small" tabindex="-1">${row.band === "strong" || row.band === "steady" ? "NICE <em>MOVE!</em>" : "TOUGH <em>CALL.</em>"}</h2>
    <div class="panel-balance"><small>RUN SCORE SO FAR${finalized ? "" : " (PROVISIONAL)"}</small><b>${fmt(state.quest.provisionalScoreG)} PTS</b></div>
    <details class="panel-details"><summary>REPLAY YOUR DECISIONS <b aria-hidden="true">⌄</b></summary>${row.result.steps.map((s, i) => `<div><small>ROUND ${i + 1}</small><strong>${esc(s.label)}</strong><p>${esc(s.outcome)}</p></div>`).join("")}</details>
    ${cta}
    <button type="button" class="story-text-btn" data-action="story-exit">Pause and keep my progress</button>
    <p class="panel-fine">Simulated educational outcomes only. Points are not G until your run is complete.</p>`;
}

/* ------------------------------ Graduation ------------------------------ */

export function graduationOverlay(scoreG, maxScoreG) {
  return `<div class="stage-score gain" role="status"><span class="score-sign"></span><b class="count-value" data-target="${scoreG}">${fmt(scoreG)}</b><small>/ ${fmt(maxScoreG)}</small><em>VERIFIED ORIGIN SCORE</em></div>`;
}

export function graduationLines(state, replay) {
  const r = state.receipts[0];
  if (!r) return ["Your Origin is verified."];
  if (r.outcome === "credited") {
    return [replay ? `A new personal best. ${fmt(r.creditDeltaG)} G added to your capital.` : `Your Origin is verified. ${fmt(r.creditDeltaG)} G is now your startup capital.`,
      "Only the part above your old best is paid. Next time, beat it again."];
  }
  return r.verifiedScoreG === 0 && !replay
    ? ["Your Origin is verified. You start with 0 G, and that is a real starting line.", "Every replay is free. Beat your best and the difference is yours."]
    : [`Verified: ${fmt(r.verifiedScoreG)}. Your best is ${fmt(r.bestAfterG)}, so no new capital this time.`, "A lower score never costs you anything. Try again whenever you want."];
}

export function graduationPanel(state, { replay }) {
  const r = state.receipts[0];
  const credited = r?.outcome === "credited";
  return `<p class="panel-kicker">${replay ? "REPLAY VERIFIED" : "ORIGIN VERIFIED"} <b aria-hidden="true">✓</b></p>
    <h2 class="panel-title is-small" tabindex="-1">${replay ? (credited ? "NEW <em>BEST!</em>" : "BEST <em>STANDS.</em>") : "YOU'RE A <em>FOUNDER.</em>"}</h2>
    <div class="panel-balance"><small>${credited ? "CAPITAL ADDED" : "CAPITAL ADDED THIS RUN"}</small><b>${credited ? "+" + fmt(r.creditDeltaG) : "0"} G</b></div>
    <div class="panel-balance"><small>STARTUP CAPITAL</small><b>◉ ${fmt(state.capital.balanceG)} G</b></div>
    <button type="button" class="story-cta" data-action="${replay ? "og-hub" : "fh-enter-hub"}">${replay ? "BACK TO THE FOUNDER HUB" : "ENTER THE FOUNDER HUB"} <b aria-hidden="true">→</b></button>
    <p class="panel-fine">Fictional, non-transferable G. Verified on the server, recorded once.</p>`;
}

/* ------------------------------ Founder Hub ------------------------------ */

function goalCard(goal) {
  const pct = goal.progress ? Math.round((goal.progress.current / goal.progress.total) * 100) : 0;
  return `<li class="fh-goal is-${esc(goal.status)}" data-goal="${esc(goal.id)}">
    <b class="fh-goal-n">${goal.order}</b>
    <span class="fh-goal-copy"><strong>${esc(goal.title)}</strong><small>${esc(goal.why)}</small>
      ${goal.progress ? `<span class="fh-goal-bar" aria-hidden="true"><i style="width:${pct}%"></i></span><small>${goal.progress.current} of ${goal.progress.total} complete</small>` : ""}
      ${goal.nextAction ? `<small class="fh-goal-next">${esc(goal.nextAction)}</small>` : ""}</span>
    <em class="fh-chip">${GOAL_CHIP[goal.status] || "UPCOMING"}</em></li>`;
}

function previewCard(p) {
  return `<li class="fh-preview" data-business-type="${esc(p.businessTypeId)}">
    <span class="fh-preview-copy"><small>${esc(p.category.toUpperCase())}</small><strong>${esc(p.name)}</strong><small>${esc(p.blurb)}</small>
      <small class="fh-price">${esc(p.pricing.label)}${p.pricing.setupCostG != null ? ` Setup ${fmt(p.pricing.setupCostG)} G · reserve ${fmt(p.pricing.minimumOperatingReserveG)} G.` : ""}</small></span>
    <em class="fh-chip">UPCOMING</em></li>`;
}

function receiptRow(r) {
  return `<li><span><strong>Run ${r.runNumber} · verified ${fmt(r.verifiedScoreG)}</strong><small>${r.outcome === "credited" ? `+${fmt(r.creditDeltaG)} G credited` : "No new capital (not above your best)"} · receipt ${esc(r.transactionId ? r.transactionId.slice(0, 8) : "none")}</small></span><b>${r.outcome === "credited" ? "+" + fmt(r.creditDeltaG) : "0"} G</b></li>`;
}

export function heroLine(state) {
  return HERO_LINE[state.capital.status] || HERO_LINE.unclassified;
}

export function founderHubPage(state, { name = "Founder" } = {}) {
  const o = state.origin, cap = state.capital, hub = state.hub, copy = CAPITAL_COPY[cap.status] || CAPITAL_COPY.unclassified;
  const heroBase = sceneDirection("founder-runway", "intro").base;
  const faceBase = CHARACTER_ART["future-you"].image;
  const line = heroLine(state);
  const next = state.nextStep;
  return `<div class="fh-page page-enter"><h1 class="sr-only">Founder Hub</h1>
    <section class="fh-hero" aria-label="Founder Hub">
      ${picture(heroBase, "fh-hero-art", 896)}<div class="fh-hero-shade" aria-hidden="true"></div>
      <div class="fh-cast">
        <figure class="fh-face" aria-hidden="true">${picture(faceBase, "", 600)}</figure>
        <div class="fh-bubble" role="group" aria-label="Future You says"><strong>FUTURE YOU</strong>
          <div class="fh-bubble-text" aria-hidden="true"><p class="tw-line"><span class="tw-shown">${esc(line)}</span><span class="tw-rest"></span></p></div>
          <div class="sr-only"><p>${esc(line)}</p></div></div>
      </div>
    </section>
    <section class="fh-identity" aria-label="Founder identity"><div><small>FOUNDER</small><strong>${esc(name)}</strong></div><div><small>FOUNDER ID</small><strong>${esc(state.founder.code)}</strong></div><div><small>STATUS</small><strong class="fh-graduated">${o.graduation.status === "graduated" ? "GRADUATED ✓" : "QUALIFYING"}</strong></div></section>
    ${draftChip(state)}
    <section class="fh-stats">
      <div><span>VERIFIED ORIGIN SCORE (BEST)</span><strong>${fmt(o.personalBestScoreG)}<small> / ${fmt(o.policy?.maxScoreG ?? 0)}</small></strong></div>
      <div><span>STARTUP CAPITAL</span><strong>◉ ${fmt(cap.balanceG)}<small> G</small></strong></div>
    </section>
    <p class="fh-capital ${copy.tone}"><em class="fh-chip">${copy.chip}</em> ${esc(copy.text)}</p>
    <section class="fh-next" aria-label="Your next step"><small>NEXT STEP</small><h2>${esc(next.title)}</h2><p>${esc(next.body)}</p>
      ${next.action ? `<button class="arcade-button${next.id === "replay_origin" ? "" : " is-orange"}" data-action="${next.action.kind === "preview_businesses" ? "fh-preview" : next.action.kind === "enter_hub" ? "fh-enter-hub" : next.action.kind === "open_origin" ? "fh-open-run" : "fh-replay"}">${esc(next.action.label)} <b>→</b></button>` : ""}
      ${next.milestone ? `<small class="fh-milestone">Next milestone: <b>${esc(hub.goals.find((g) => g.id === next.milestone.goalId)?.title ?? "")}</b> · ${esc(next.milestone.availableIn)}</small>` : ""}</section>
    <div class="arcade-section-title"><strong>YOUR GOALS</strong><small>${hub.goals.filter((g) => g.status === "completed").length} / ${hub.goals.length} DONE</small></div>
    <ol class="fh-goals">${hub.goals.map(goalCard).join("")}</ol>
    <div class="arcade-section-title" id="fh-previews"><strong>STARTER BUSINESSES</strong><small>PREVIEW ONLY</small></div>
    <ul class="fh-previews">${hub.businessPreviews.map(previewCard).join("")}</ul>
    <p class="fh-note">These businesses open in an upcoming build. Nothing here can be bought yet, and no capital is spent by looking.</p>
    <div class="arcade-section-title"><strong>REPLAY THE ORIGIN</strong><small>ALWAYS FREE</small></div>
    <section class="fh-replay"><p>${esc(o.replay.rule)} Your best: <b>${fmt(o.personalBestScoreG)}</b>. Lifetime credited: <b>${fmt(o.lifetimeCreditedG)} G</b>.</p>
      ${o.replay.eligible ? `<button class="cta secondary" data-action="fh-replay">${o.openRun ? "CONTINUE ORIGIN RUN" : "REPLAY ORIGIN"} <span>↗</span></button>` : ""}
      <p class="fh-note">${esc(hub.recovery.educationalActivities.message)}</p></section>
    <details class="fh-receipts"><summary>CAPITAL RECEIPTS · ${state.receipts.length} <b aria-hidden="true">⌄</b></summary><ul>${state.receipts.map(receiptRow).join("") || "<li><span><small>No settled runs yet.</small></span></li>"}</ul></details>
    ${FINE}</div>`;
}
