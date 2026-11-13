import { BOT_USERNAME } from "./config.mjs";
import { CASES, DIMENSIONS, RECOVERY_QUESTIONS } from "./cases.mjs";
import {
  STORAGE_KEY, MIN_PLAY_BALANCE, STARTING_COINS, RECOVERY_REWARD,
  createGame, startCase, chooseStep, completeChain, chainResult, stageView,
  completeRecovery, recoveryAvailable, isLocked, isValidGame, getDecisionStyle,
  playableCases, evidenceFor
} from "./game-core.mjs";

const root = document.querySelector("#app");
const tg = window.Telegram?.WebApp;
const isTelegram = Boolean(tg?.initData);
const localPreview = ["localhost", "127.0.0.1"].includes(location.hostname) || location.protocol === "file:";
const canPlay = isTelegram || localPreview || new URLSearchParams(location.search).get("demo") === "1";

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const coins = (value) => new Intl.NumberFormat("en-US").format(value);
const dateText = (time) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(time));
const bestName = tg?.initDataUnsafe?.user?.first_name?.trim()?.slice(0, 16) || "Founder";

let game;
try {
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
  game = isValidGame(stored) ? stored : createGame();
} catch {
  game = createGame();
}

let view = "home";
let caseId = null;
let stage = "brief";
let selectedChoice = null;
let toast = null;
let resetArmed = false;
let moveBusy = false;

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(game)); }
  catch { showToast("Device storage is unavailable; your progress may not persist."); }
}

function haptic(kind = "light") {
  try { tg?.HapticFeedback?.impactOccurred(kind); } catch { /* optional Telegram feature */ }
}

function setupTelegram() {
  if (!tg) return;
  try {
    tg.ready();
    tg.expand();
    tg.setHeaderColor?.("#0a0d0a");
    tg.setBackgroundColor?.("#0a0d0a");
    tg.BackButton?.onClick(() => {
      if (view === "scenario" && stage === "decide" && !game.draft?.path.length) { stage = "brief"; selectedChoice = null; render(); return; }
      changeView("home");
    });
  } catch { /* keep the prototype functional in older clients */ }
}

function backButton() {
  try { if (view === "scenario" || view === "recovery") tg?.BackButton?.show(); else tg?.BackButton?.hide(); }
  catch { /* browser preview */ }
}

function showToast(message) {
  toast = message;
  render({ quiet: true });
  window.setTimeout(() => { if (toast === message) { toast = null; render({ quiet: true }); } }, 3800);
}

function changeView(next) {
  view = next;
  caseId = null;
  selectedChoice = null;
  resetArmed = false;
  stage = "brief";
  haptic();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openCase(id) {
  if (isLocked(game)) { changeView("recovery"); return; }
  if (game.draft?.path.length && game.draft.caseId !== id) {
    showToast("Finish your open chain first. Coins count only when all four decisions are made.");
    id = game.draft.caseId;
  }
  if (game.played.some((run) => run.caseId === id)) { showToast("This case is already complete. Its coins cannot be earned twice."); return; }
  if (!CASES.some((entry) => entry.id === id)) return;
  caseId = id;
  view = "scenario";
  stage = game.draft?.caseId === id && game.draft.path.length ? "decide" : "brief";
  selectedChoice = null;
  haptic();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function getCase() { return CASES.find((entry) => entry.id === caseId); }

// The chain you have open, or else the next case you have not played.
function activeCase() {
  if (game.draft) return CASES.find((entry) => entry.id === game.draft.caseId);
  return playableCases(game)[0];
}

function dotLogo(){return '<img src="./brand.svg" class="arcade-mark" alt="" width="42" height="42">';}

function topbar(){return `<header class="topbar arcade-top"><div class="brand-lockup">${dotLogo()}<div class="arcade-wordmark"><strong>GWAPOHOLICS</strong><small>THE BUSINESS GAME</small></div></div><div class="arcade-wallet"><b>◉</b> ${coins(game.balance)}<small>G</small></div></header>`;}

function bottomnav(){return `<nav class="bottomnav arcade-nav">${[["home","PLAY","◆"],["cases","MISSIONS","▦"],["profile","YOU","◉"]].map(([key,label,glyph])=>`<button class="tab ${view===key?"active":""}" data-action="nav" data-view="${key}"><span class="tab-icon">${glyph}</span><span>${label}</span></button>`).join("")}</nav>`;}

function miniBalance() {
  return `<div class="mini-balance"><span class="coin-glyph">◉</span><span>${coins(game.balance)}</span><small>G</small></div>`;
}

function welcome(){
const next=activeCase(),done=game.played.length,prog=done*20;
return `<div class="arcade-home page-enter">
<div class="arcade-kicker"><span><i></i> SEASON 01 · ${esc(bestName.toUpperCase())}</span><span>${done}/5 CLEARED</span></div>
<section class="arcade-hero"><div class="arcade-orbit">G</div><div class="arcade-star star-a">✦</div><div class="arcade-star star-b">✦</div>
<div class="arcade-hero-inside"><span>THE WORLD IS YOUR BOARDROOM</span><h1>MAKE<br>THE <em>CALL.</em></h1><p>Big decisions. Bigger consequences.<br>Think fast. Build smart.</p>
${isLocked(game)?`<button class="arcade-button is-orange" data-action="nav" data-view="recovery">START YOUR COMEBACK <b>→</b></button>`:next?`<button class="arcade-button" data-action="open-case" data-case="${next.id}">${game.draft?.path.length?"CONTINUE MISSION":"PLAY NOW"} <b>→</b></button>`:`<button class="arcade-button" data-action="nav" data-view="profile">YOUR LEGACY <b>→</b></button>`}</div></section>
<div class="arcade-stats"><div><span>YOUR CAPITAL</span><strong>◉ ${coins(game.balance)}<small> G</small></strong></div><div><span>MISSIONS</span><strong>${done}<small> / 5</small></strong></div></div>
<div class="arcade-how"><div>⚡</div><span><b>HOW TO PLAY</b><small>Read the problem → make a call → watch what happens. Four moves finish a mission.</small></span></div>
<div class="arcade-section-title"><strong>UP NEXT</strong><small>${prog}% COMPLETE</small></div>
${next?`<button class="arcade-next" data-action="open-case" data-case="${next.id}"><b>${next.number}</b><span><small>${esc(next.category.toUpperCase())} · ${next.minutes} MIN</small><strong>${esc(next.title)}</strong><i>${esc(next.hook)}</i></span><em>↗</em></button>`:`<div class="arcade-next"><strong>Season 01 complete. Your choices shaped your legacy.</strong></div>`}
<div class="arcade-progress"><span style="width:${prog}%"></span></div><p class="arcade-fine">Educational simulation · virtual coins have no cash value</p></div>`;
}

function caseList() {
  return `<div class="page-enter"><div class="eyebrow with-line">SEASON 01 <span>5 CASE FILES</span></div><div class="page-heading"><h1>THE CASE<br><em>FILES.</em></h1><p>Five real-world-inspired pressure tests. Four linked decisions each, and every choice changes the next.</p></div>
    <div class="case-list">${CASES.map((entry) => {
      const run = game.played.find((item) => item.caseId === entry.id);
      return `<button class="case-list-item ${run ? "done" : ""}" data-action="${run ? "view-run" : "open-case"}" data-case="${entry.id}" ${isLocked(game) && !run ? "disabled" : ""}>
        <div class="case-list-num">${entry.number}</div><div class="case-list-content"><span class="case-list-category">${esc(entry.category.toUpperCase())} <span>· ${entry.minutes} MIN</span></span><strong>${esc(entry.title)}</strong><small>${run ? `DECIDED · ${run.delta >= 0 ? "+" : ""}${coins(run.delta)} G` : esc(entry.hook)}</small></div><span class="case-list-arrow">${run ? "✓" : "↗"}</span>
      </button>`;
    }).join("")}</div>
    ${isLocked(game) ? `<button class="cta primary" data-action="nav" data-view="recovery">UNLOCK GAMEPLAY <span>↗</span></button>` : ""}
    <div class="small-print">Historical inspiration ≠ historical outcome. Every payoff is a teaching simulation.</div>
  </div>`;
}

function caseBrief(entry){
return `<div class="arcade-flow page-enter"><div class="arcade-flowtop"><button data-action="nav" data-view="home">← BACK</button><span>MISSION ${entry.number} / 05</span></div>
<div class="arcade-new">NEW MISSION UNLOCKED <b>✦</b></div>
<div class="arcade-emblem"><strong>${entry.number}</strong><span>★</span></div><h1 class="arcade-title">${esc(entry.title.toUpperCase())}<em>.</em></h1><p class="arcade-hook">${esc(entry.hook)}</p>
<div class="arcade-story"><div><strong>THE SITUATION</strong><small>${esc(entry.era)}</small></div><p>${esc(entry.story)}</p></div>
<div class="arcade-evidence">${evidenceFor(entry,game.seed).slice(0,3).map(e=>`<div><small>${esc(e.label)}</small><b>${esc(e.value)}</b></div>`).join("")}</div>
<p class="arcade-tip">4 quick moves. Every decision changes what happens next.</p><button class="arcade-button" data-action="decide">LET'S DO BUSINESS <b>→</b></button><p class="arcade-fine">Your coins settle only after all four moves. All outcomes are fictional.</p></div>`;
}

function caseDecision(entry) {
const step=stageView(entry,game.draft.path,game.seed);
return `<div class="arcade-flow page-enter"><div class="arcade-flowtop"><button data-action="nav" data-view="home">← PAUSE</button><span>MISSION ${entry.number}</span></div>
<div class="arcade-round"><strong>ROUND ${step.index+1}</strong><span>OF ${step.total}</span></div>
<div class="arcade-meter">${Array.from({length:step.total},(_,i)=>`<i class="${i<step.index?"done":i===step.index?"now":""}"></i>`).join("")}</div>
<div class="arcade-label">⚡ ${step.index===0?"YOU'RE THE BOSS":"THE PLOT THICKENS"}</div><div class="arcade-prompt">${step.setup?`<p>${esc(step.setup)}</p>`:""}<h1>${esc(step.prompt)}</h1></div>
<div class="arcade-pick">WHAT'S YOUR MOVE? <small>TAP ONE</small></div>
<div class="arcade-choices">${step.choices.map((c,i)=>`<button class="arcade-choice" data-action="choose" data-choice="${esc(c.id)}"><span class="arcade-letter">${String.fromCharCode(65+i)}</span><span><strong>${esc(c.label)}</strong><small>${esc(c.detail)}</small></span><b>↗</b></button>`).join("")}</div>
<p class="arcade-fine">Your choice locks immediately. Coin results come after round 4.</p></div>`;
}

function beatPage(entry) {
const n=game.draft.path.length,step=stageView(entry,game.draft.path,game.seed);
return `<div class="arcade-beat page-enter"><div class="arcade-round"><strong>MOVE ${n} LOCKED IN</strong><span>✓</span></div><div class="arcade-meter">${Array.from({length:4},(_,i)=>`<i class="${i<n?"done":""}"></i>`).join("")}</div>
<div class="arcade-beat-icon"><div class="arcade-circle"></div><span>⚡</span></div>
<div class="arcade-new">THE STORY CHANGES</div><h1>THAT HAD<br><em>CONSEQUENCES.</em></h1>
<div class="arcade-story arcade-outcome"><p>${esc(step.opening||"Your move just changed the game.")}</p></div>
<p class="arcade-tip">Your cash result unlocks after all four decisions.</p><button class="arcade-button" data-action="next-step">ROUND ${n+1} <b>→</b></button><button class="arcade-text-button" data-action="nav" data-view="home">Pause and keep my progress</button></div>`;
}

function caseResult(entry,run){
const result=chainResult(entry,run.path,game.seed),win=run.delta>=0,next=playableCases(game)[0];
return `<div class="arcade-result ${win?"gain":"loss"} page-enter"><div class="arcade-result-label">★ MISSION COMPLETE ★</div><div class="arcade-confetti">${Array.from({length:17},(_,i)=>`<i style="--n:${i}"></i>`).join("")}</div><div class="arcade-medal">${win?"★":"↗"}</div><span>${esc(entry.title.toUpperCase())}</span><h1>${win?"NICE":"TOUGH"}<br><em>${win?"MOVE!":"CALL."}</em></h1>
<div class="arcade-result-delta">${run.delta>=0?"+":"−"}<b class="count-value" data-target="${Math.abs(run.delta)}">${coins(Math.abs(run.delta))}</b><small> G</small></div><p class="arcade-result-desc">SIMULATED COINS ${win?"GAINED":"LOST"}</p>
<div class="arcade-result-total"><small>NEW BALANCE</small><b>◉ ${coins(run.balanceAfter)} G</b></div>
<div class="arcade-takeaway"><small>YOUR TAKEAWAY</small><p>${esc(entry.takeaway)}</p></div>
<details class="arcade-details"><summary>REPLAY YOUR DECISIONS <b>⌄</b></summary>${result.steps.map((s,i)=>`<div><small>ROUND ${i+1} · ${s.delta>=0?"+":""}${coins(s.delta)} G</small><strong>${esc(s.label)}</strong><p>${esc(s.outcome)}</p></div>`).join("")}</details>
${isLocked(game)?`<button class="arcade-button is-orange" data-action="nav" data-view="recovery">START RECOVERY <b>→</b></button>`:next?`<button class="arcade-button" data-action="open-case" data-case="${next.id}">NEXT MISSION <b>→</b></button>`:`<button class="arcade-button" data-action="nav" data-view="profile">YOUR STRATEGY DNA <b>→</b></button>`}
<button class="arcade-text-button" data-action="nav" data-view="home">Back to game home</button><p class="arcade-fine">Simulated educational outcomes only. No cash or token redemptions.</p></div>`;
}

function profilePage() {
  const summary = getDecisionStyle(game);
  const count = game.played.length;
  const sorted = DIMENSIONS.map((dimension) => ({ ...dimension, score: game.profile[dimension.key] || 0 }));
  return `<div class="page-enter"><div class="eyebrow with-line">YOUR PLAYER FILE <span>DECISION INTELLIGENCE</span></div><div class="page-heading"><h1>STRATEGY<br><em>DNA.</em></h1><p>Your decisions leave patterns. Learn how you think, then challenge your habits.</p></div>
    <div class="profile-card"><div class="profile-card-top"><span>PLAYER ARCHETYPE</span><span class="profile-asterisk">✳</span></div><h2>${esc(summary.title.toUpperCase())}</h2><p>${esc(summary.subtitle)}</p><div class="profile-divider"></div><div class="profile-meta"><div><span>DECISIONS</span><strong>${count}</strong></div><div><span>CAPITAL</span><strong>${coins(game.balance)} G</strong></div><div><span>STATUS</span><strong>${isLocked(game) ? "RECOVERY" : "ACTIVE"}</strong></div></div></div>
    <div class="section-label"><h2>YOUR 10 DIMENSIONS</h2><span class="tiny-index">DEVELOPING</span></div>
    <div class="dimensions">${sorted.map((dim, i) => {
      const width = Math.max(6, Math.min(100, 50 + dim.score * 5));
      return `<div class="dimension"><div class="dimension-title"><span><b>${String(i + 1).padStart(2, "0")}</b> ${esc(dim.name)}</span><span>${dim.score > 0 ? "+" : ""}${dim.score}</span></div><div class="dimension-bar"><span style="width:${width}%"></span></div><small>${esc(dim.short)}</small></div>`;
    }).join("")}</div>
    <div class="tip-panel">This is a reflection tool, not a financial aptitude test. Values represent the tendencies in your ${count || "future"} simulated decision${count === 1 ? "" : "s"}.</div>
    ${isTelegram ? "" : `<button class="cta secondary reset-button" data-action="reset">${resetArmed ? "TAP AGAIN TO RESET THE PREVIEW" : "RESET LOCAL PREVIEW DATA"}</button>`}
  </div>`;
}

function ledgerPage() {
  return `<div class="page-enter"><div class="eyebrow with-line">TRANSACTION HISTORY <span>VIRTUAL ONLY</span></div><div class="page-heading"><h1>THE<br><em>LEDGER.</em></h1><p>Every game coin has a story. Here are yours.</p></div>
    <div class="ledger-total"><span>AVAILABLE GAME CAPITAL</span><strong><span>◉</span> ${coins(game.balance)} <small>G</small></strong><p>Not money · not a crypto balance · not withdrawable</p></div>
    <div class="section-label"><h2>ALL ACTIVITY</h2><span class="tiny-index">${game.ledger.length} ENTRIES</span></div>
    <div class="ledger-list">${[...game.ledger].reverse().map((entry) => `<div class="ledger-item"><span class="ledger-icon ${entry.amount >= 0 ? "in" : "out"}">${entry.type === "welcome" ? "✳" : entry.type === "recovery" ? "↻" : "↗"}</span><div class="ledger-description"><strong>${esc(entry.label)}</strong><small>${dateText(entry.at)} · ${entry.type === "welcome" ? "STARTING CAPITAL" : entry.type === "recovery" ? "EDUCATIONAL REWARD" : "SIMULATED RESULT"}</small></div><div class="ledger-amount ${entry.amount >= 0 ? "in" : "out"}">${entry.amount >= 0 ? "+" : ""}${coins(entry.amount)} G<small>${coins(entry.balanceAfter)} AFTER</small></div></div>`).join("")}</div>
    <div class="tip-panel">The prototype saves this ledger on your device. Before real multiplayer, balances and decisions must move to a verified, server-controlled ledger.</div>
  </div>`;
}

function recoveryPage() {
  if (!isLocked(game)) return `<div class="page-enter"><div class="page-heading"><h1>YOU'RE<br><em>ACTIVE.</em></h1><p>Your balance is at least ${MIN_PLAY_BALANCE} G. You don't need recovery.</p></div><button class="cta primary" data-action="nav" data-view="home">BACK TO GAME <span>↗</span></button></div>`;
  const ready = recoveryAvailable(game);
  const remainMs = game.lastRecoveryAt === null ? 0 : Math.max(0, 24 * 60 * 60 * 1000 - (Date.now() - game.lastRecoveryAt));
  const hours = Math.ceil(remainMs / (60 * 60 * 1000));
  return `<div class="page-enter"><div class="scenario-top"><button class="back-link" data-action="nav" data-view="home">← THE FLOOR</button>${miniBalance()}</div><div class="case-identifier"><span class="case-id-green">EDUCATIONAL RECOVERY</span><span>LEARN TO RETURN</span></div>
    <h1 class="scenario-title">GET BACK<br>IN THE <em>GAME.</em></h1><p class="scenario-hook">Your balance dropped below ${MIN_PLAY_BALANCE} G. Business has consequences. Recovery has lessons.</p>
    <div class="recovery-note"><span>↻</span><div><strong>${ready ? `EARN ${RECOVERY_REWARD} G` : "COOLDOWN ACTIVE"}</strong><small>${ready ? "Two correct answers unlock a controlled, nonwithdrawable education reward." : `Next recovery challenge in about ${hours} hour${hours === 1 ? "" : "s"}.`}</small></div></div>
    ${ready ? `<form id="recovery-form">${RECOVERY_QUESTIONS.map((question, index) => `<fieldset class="quiz-group"><legend><span>QUESTION ${index + 1}</span>${esc(question.prompt)}</legend>${question.options.map((option, optionIndex) => `<label class="quiz-option"><input type="radio" name="q${index}" value="${optionIndex}" required /><span>${esc(option)}</span></label>`).join("")}</fieldset>`).join("")}<button type="submit" class="cta primary">SUBMIT LEARNING CHECK <span>↗</span></button></form>` : `<button class="cta secondary" data-action="nav" data-view="profile">REVIEW YOUR STRATEGY PROFILE</button>`}
    <p class="under-cta">Recovery is limited to one successful reward per 24 hours. It may take more than one day to restore your minimum balance.</p>
  </div>`;
}

function gatePage() {
  const username = BOT_USERNAME.replace(/^@/, "").trim();
  const link = username ? `https://t.me/${encodeURIComponent(username)}?startapp` : null;
  return `<div class="gate-wrap">${dotLogo()}<span class="gate-label">TELEGRAM EXCLUSIVE</span><h1>THE GAME<br>LIVES IN<br><em>TELEGRAM.</em></h1><p>This game is built specifically for the Telegram Mini App experience. Open it inside Telegram to make your first move.</p>${link ? `<a class="cta primary" href="${link}">OPEN IN TELEGRAM <span>↗</span></a>` : `<div class="gate-missing">Bot link coming soon. The founder must configure a Telegram bot and a public HTTPS Mini App URL.</div>`}<small>Virtual economy only · No token or withdrawal</small></div>`;
}

// Set when a chain settles, so the result amount counts up once after the screen appears.
let countPending = false;

const signed = (value) => `${value >= 0 ? "+" : "−"}${coins(Math.abs(value))}`;

function stageSegments(total, current) {
  const segments = Array.from({ length: total }, (_, index) => `<span class="${index < current ? "done" : index === current ? "current" : ""}"></span>`);
  return `<div class="stage-segments" aria-hidden="true">${segments.join("")}</div>`;
}

// Counts the settled amount up once. Reduced-motion users keep the static number from the markup.
function countUp() {
  const el = root.querySelector(".count-value");
  const target = Number(el?.dataset.target);
  if (!el || !target || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
  const start = performance.now();
  const duration = 900;
  el.textContent = "0";
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    el.textContent = coins(Math.round(target * (1 - Math.pow(1 - t, 3))));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function render(options = {}) {
  if (!canPlay) { root.innerHTML = `<main class="app-shell"><div class="app-inner">${gatePage()}</div></main>`; return; }
  let content;
  if (view === "home") content = welcome();
  else if (view === "cases") content = caseList();
  else if (view === "profile") content = profilePage();
  else if (view === "ledger") content = ledgerPage();
  else if (view === "recovery") content = recoveryPage();
  else if (view === "scenario") {
    const entry = getCase();
    const run = entry && game.played.find((item) => item.caseId === entry.id);
    content = !entry ? welcome()
      : stage === "decide" && game.draft?.caseId === entry.id ? caseDecision(entry)
      : stage === "result" && run ? caseResult(entry, run)
      : stage === "beat" && game.draft?.caseId === entry.id ? beatPage(entry)
      : caseBrief(entry);
  }
  root.innerHTML = `<main class="app-shell"><div class="app-inner">${topbar()}<div class="prototype-tag"><span>◉</span> PLAYTEST · LOCAL-ONLY COINS · NO CASH VALUE</div><div class="page-content${options.quiet ? " quiet" : ""}">${content}</div>${view==="scenario" || view==="recovery" ? "" : bottomnav()}</div></main>${toast ? `<div class="toast" role="alert">${esc(toast)}</div>` : ""}`;
  backButton();
  if (countPending) { countPending = false; countUp(); }
}

root.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button || button.disabled) return;
  const { action } = button.dataset;
  if (action === "nav") { changeView(button.dataset.view); return; }
  if (action === "open-case") { openCase(button.dataset.case); return; }
  if (action === "decide") {
    try { game = startCase(game, caseId); persist(); stage = "decide"; selectedChoice = null; haptic(); render(); }
    catch (error) { showToast(error.message); }
    return;
  }
  if (action === "back-stage") { stage = "brief"; selectedChoice = null; render(); return; }
  if (action === "choose") {
    if (moveBusy || !caseId || !game.draft) return;
    moveBusy = true;
    const id = button.dataset.choice;
    button.classList.add("locked-choice");
    haptic("medium");
    window.setTimeout(() => {
      try {
        const current = getCase();
        game = chooseStep(game, caseId, id);
        if (game.draft.path.length === current.stages.length) {
          game = completeChain(game, caseId);
          stage = "result";
          countPending = true;
          try { tg?.HapticFeedback?.notificationOccurred(game.played.at(-1).delta >= 0 ? "success" : "warning"); } catch {}
        } else stage = "beat";
        persist(); render(); window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (error) { showToast(error.message); }
      finally { moveBusy = false; }
    }, 250);
    return;
  }
  if (action === "next-step") { stage = "decide"; haptic("light"); render(); window.scrollTo({top:0,behavior:"smooth"}); return; }
  if (action === "confirm") {
    if (!selectedChoice || !caseId) return;
    try {
      const entry = getCase();
      game = chooseStep(game, caseId, selectedChoice);
      selectedChoice = null;
      if (game.draft.path.length === entry.stages.length) {
        game = completeChain(game, caseId);
        stage = "result";
        countPending = true;
      }
      persist();
      haptic("medium");
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) { showToast(error.message); }
    return;
  }
  if (action === "view-run") { caseId=button.dataset.case; view="scenario"; stage="result"; countPending=false; render(); window.scrollTo(0,0); return; }
  if (action === "reset") {
    // Reset exists only in the browser preview, and needs a second tap instead of a native dialog.
    if (isTelegram) return;
    if (!resetArmed) { resetArmed = true; haptic(); render(); return; }
    game = createGame(); persist(); changeView("home"); showToast("Preview reset. You have 1,000 virtual coins again.");
  }
});

root.addEventListener("submit", (event) => {
  if (event.target.id !== "recovery-form") return;
  event.preventDefault();
  const data = new FormData(event.target);
  const answers = RECOVERY_QUESTIONS.map((_, i) => data.get(`q${i}`) === null ? -1 : Number(data.get(`q${i}`)));
  try {
    game = completeRecovery(game, answers);
    persist();
    haptic("medium");
    if (isLocked(game)) showToast(`+${RECOVERY_REWARD} G earned. You're still below ${MIN_PLAY_BALANCE} G; return after your cooldown.`);
    else showToast(`+${RECOVERY_REWARD} G earned. You're back in the game!`);
    changeView(isLocked(game) ? "recovery" : "home");
  } catch (error) { showToast(error.message); }
});

setupTelegram();
render();
