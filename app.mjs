import { BOT_USERNAME } from "./config.mjs";
import { startTelegramSession, refreshPlayer, sendGameCommand } from "./server-client.mjs";
import { homeNarrator, cinematicMotionClass, toggleCinematicMotion, storyMotionEnabled, storyStage, introPanel, decisionPanel, consequencePanel, resultPanel, resultScore } from "./cinematic-view.mjs";
import { narrativeScene, sceneDirection, reactionFor, hasStoryMode, STORY_CHARACTERS, CHARACTER_ART, storyAssetExt } from "./story-runtime.mjs";
import { createSceneDirector, SCENE_STEPS, EXIT_STEPS } from "./story-director.mjs";
import { bindTypewriter, DEFAULT_TYPE_SPEED } from "./typewriter.mjs";
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
const explicitDemo = new URLSearchParams(location.search).get("demo") === "1";
const canPlay = isTelegram || localPreview || explicitDemo;
const remoteRequested = isTelegram && !explicitDemo;
let remoteStatus = remoteRequested ? "connecting" : "demo";
let pendingCommand = null;

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
  if (game.remote) return;
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
    // Story Mode sizes itself to Telegram's stable viewport, so the stage never jumps while the sheet expands.
    const syncViewport = () => {
      const h = tg.viewportStableHeight || tg.viewportHeight;
      if (h) document.documentElement.style.setProperty("--app-height", `${h}px`);
    };
    syncViewport();
    tg.onEvent?.("viewportChanged", syncViewport);
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

// Toasts live outside #app so showing one never re-renders (or restarts) a cinematic shot.
const toastHost = document.createElement("div");
toastHost.className = "toast-host";
document.body.append(toastHost);
// One polite live region announces each shot's full dialogue once, instead of every typed character.
const announcer = document.createElement("div");
announcer.className = "sr-only";
announcer.setAttribute("aria-live", "polite");
document.body.append(announcer);

function renderToast() {
  toastHost.innerHTML = toast ? `<div class="toast" role="alert">${esc(toast)}</div>` : "";
}

function showToast(message) {
  toast = message;
  renderToast();
  window.setTimeout(() => { if (toast === message) { toast = null; renderToast(); } }, 3800);
}


function visibleStage(entry){
  if(game.remote){
    const step=game.draft?.step;
    if(!step||game.draft.caseId!==entry.id)throw new Error('Secure step unavailable');
    return step;
  }
  return stageView(entry,game.draft.path,game.seed);
}
function visibleResult(entry,run){
  if(game.remote){
    if(!run?.result)throw new Error('Secure result unavailable');
    return run.result;
  }
  return chainResult(entry,run.path,game.seed);
}
function visibleEvidence(entry){
  return game.remote ? (game.evidence?.[entry.id] || []) : evidenceFor(entry,game.seed);
}
async function remoteCommand(command,extra={}){
  const signature=JSON.stringify({command,...extra});
  const requestId=pendingCommand?.signature===signature ? pendingCommand.requestId : crypto.randomUUID();
  pendingCommand={signature,requestId};
  const next=await sendGameCommand({command,...extra,requestId});
  pendingCommand=null;
  return next;
}
async function resyncRemote(){
  if(!game.remote)return;
  try{game=await refreshPlayer();leaveStory();render()}
  catch{showToast('Connection interrupted. Confirmed progress is saved on the server.')}
}
async function authenticatePlayer(){
  remoteStatus='connecting';render();
  try{
    game=await startTelegramSession(tg?.initData);
    remoteStatus='ready';view='home';caseId=null;stage='brief';
  }catch{
    remoteStatus='failed';
  }
  render();
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
${homeNarrator()}<div class="arcade-stats"><div><span>YOUR CAPITAL</span><strong>◉ ${coins(game.balance)}<small> G</small></strong></div><div><span>MISSIONS</span><strong>${done}<small> / 5</small></strong></div></div>
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
<div class="arcade-evidence">${visibleEvidence(entry).slice(0,3).map(e=>`<div><small>${esc(e.label)}</small><b>${esc(e.value)}</b></div>`).join("")}</div>
<p class="arcade-tip">4 quick moves. Every decision changes what happens next.</p><button class="arcade-button" data-action="decide">LET'S DO BUSINESS <b>→</b></button><p class="arcade-fine">Your coins settle only after all four moves. All outcomes are fictional.</p></div>`;
}

function caseDecision(entry) {
const step=visibleStage(entry);
return `<div class="arcade-flow page-enter"><div class="arcade-flowtop"><button data-action="nav" data-view="home">← PAUSE</button><span>MISSION ${entry.number}</span></div>
<div class="arcade-round"><strong>ROUND ${step.index+1}</strong><span>OF ${step.total}</span></div>
<div class="arcade-meter">${Array.from({length:step.total},(_,i)=>`<i class="${i<step.index?"done":i===step.index?"now":""}"></i>`).join("")}</div>
<div class="arcade-label">⚡ ${step.index===0?"YOU'RE THE BOSS":"THE PLOT THICKENS"}</div><div class="arcade-prompt">${step.setup?`<p>${esc(step.setup)}</p>`:""}<h1>${esc(step.prompt)}</h1></div>
<div class="arcade-pick">WHAT'S YOUR MOVE? <small>TAP ONE</small></div>
<div class="arcade-choices">${step.choices.map((c,i)=>`<button class="arcade-choice" data-action="choose" data-choice="${esc(c.id)}"><span class="arcade-letter">${String.fromCharCode(65+i)}</span><span><strong>${esc(c.label)}</strong><small>${esc(c.detail)}</small></span><b>↗</b></button>`).join("")}</div>
<p class="arcade-fine">Your choice locks immediately. Coin results come after round 4.</p></div>`;
}

function beatPage(entry) {
const n=game.draft.path.length,step=visibleStage(entry);
return `<div class="arcade-beat page-enter"><div class="arcade-round"><strong>MOVE ${n} LOCKED IN</strong><span>✓</span></div><div class="arcade-meter">${Array.from({length:4},(_,i)=>`<i class="${i<n?"done":""}"></i>`).join("")}</div>
<div class="arcade-beat-icon"><div class="arcade-circle"></div><span>⚡</span></div>
<div class="arcade-new">THE STORY CHANGES</div><h1>THAT HAD<br><em>CONSEQUENCES.</em></h1>
<div class="arcade-story arcade-outcome"><p>${esc(step.opening||"Your move just changed the game.")}</p></div>
<p class="arcade-tip">Your cash result unlocks after all four decisions.</p><button class="arcade-button" data-action="next-step">ROUND ${n+1} <b>→</b></button><button class="arcade-text-button" data-action="nav" data-view="home">Pause and keep my progress</button></div>`;
}

function caseResult(entry,run){
const result=visibleResult(entry,run),win=run.delta>=0,next=playableCases(game)[0];
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
    <div class="tip-panel">${game.remote ? "Your virtual rewards are saved in your authenticated player ledger." : "This is only a local demo ledger. No verified account balance is changed."}</div>
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

// Counts a settled amount up once. With motion off the static number from the markup stays.
function countUp(el = root.querySelector(".count-value"), animate = !window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
  const target = Number(el?.dataset.target);
  if (!el || !target || !animate) return;
  const start = performance.now();
  const duration = 1100;
  el.textContent = "0";
  const step = (now) => {
    if (!el.isConnected) return;
    const t = Math.min(1, (now - start) / duration);
    el.textContent = coins(Math.round(target * (1 - Math.pow(1 - t, 3))));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ------------------------------------------------------------------------- *
 * Story Mode (Cinematic Sprint 1A). Only quests with exported art use it;
 * the other four quests keep the classic layout until the founder approves.
 * Every coin and decision still flows through game-core.mjs unchanged.
 * ------------------------------------------------------------------------- */

const story = {
  active: false,
  el: null,
  typer: null,
  previous: null,        // last background, so the next shot can crossfade from it
  countOnEnter: false,
  keyboard: false,
  preloaded: new Map()
};

const director = createSceneDirector({ onStep: applyStoryStep });

function storyEligible() {
  return view === "scenario" && hasStoryMode(caseId) && Boolean(getCase());
}

function preloadImage(base) {
  // Warms the WebP that the <picture> elements choose (every supported Telegram WebView decodes WebP).
  if (!base || story.preloaded.has(base)) return;
  const img = new Image();
  img.decoding = "async";
  img.src = base + "." + storyAssetExt(base);
  story.preloaded.set(base, img);
}

function preloadShot(caseIdToLoad, phase, opts) {
  const direction = sceneDirection(caseIdToLoad, phase, opts);
  if (direction) preloadImage(direction.base);
  const speaker = phase === "result" ? "future-you" : narrativeScene(caseIdToLoad, phase, opts)?.speaker;
  if (speaker && CHARACTER_ART[speaker]) preloadImage(CHARACTER_ART[speaker].image);
}

function storyShot(entry) {
  const total = entry.stages.length;
  const run = game.played.find((item) => item.caseId === entry.id);
  const draftOpen = game.draft?.caseId === entry.id;
  const ribbon = (direction) => `MISSION ${entry.number} · ${direction.title.toUpperCase()}`;
  const base = { balance: game.balance };

  if (stage === "result" && run) {
    const result = chainResult(entry, run.path, game.seed);
    const direction = sceneDirection(entry.id, "result", { band: result.band });
    const scene = narrativeScene(entry.id, "result", { band: result.band });
    return { ...base, key: `${entry.id}:result`, phase: "result", direction, speaker: "future-you", emotion: direction.emotion, effect: direction.effect,
      lines: [scene.line, `Lesson: ${entry.takeaway}`], overlay: resultScore(run.delta),
      panel: resultPanel({ run, result, next: playableCases(game)[0], locked: isLocked(game) }),
      label: `${entry.title}: result`, ribbon: ribbon(direction), progress: { label: "MISSION COMPLETE", total, done: total, current: -1 } };
  }
  if (stage === "beat" && draftOpen && game.draft.path.length) {
    const made = game.draft.path.length;
    const step = stageView(entry, game.draft.path, game.seed);
    const direction = sceneDirection(entry.id, "consequence", { round: made - 1 });
    const emotion = reactionFor(entry.id, step.opening);
    const effect = emotion === "worried" ? "impact" : emotion === "celebrating" ? "glow" : emotion === "talking" ? "none" : "dim";
    return { ...base, key: `${entry.id}:beat:${made}`, phase: "consequence", direction, speaker: "gwap-o", emotion, effect,
      lines: [step.opening || "Your move just changed the game."], panel: consequencePanel(made, total),
      label: `${entry.title}: consequence of move ${made}`, ribbon: `MISSION ${entry.number} · THE FALLOUT`, progress: { label: `MOVE ${made} LOCKED`, total, done: made, current: -1 } };
  }
  if (stage === "decide" && draftOpen) {
    const step = stageView(entry, game.draft.path, game.seed);
    const direction = sceneDirection(entry.id, "decision", { round: step.index });
    const scene = narrativeScene(entry.id, "decision", { round: step.index });
    return { ...base, key: `${entry.id}:decide:${step.index}`, phase: "decision", direction, speaker: scene.speaker, emotion: direction.emotion, effect: "none",
      lines: [scene.line, step.setup], panel: decisionPanel(step),
      label: `${entry.title}: round ${step.index + 1} of ${total}`, ribbon: ribbon(direction), progress: { label: `ROUND ${step.index + 1} OF ${total}`, total, done: step.index, current: step.index } };
  }
  const direction = sceneDirection(entry.id, "intro");
  const scene = narrativeScene(entry.id, "intro");
  return { ...base, key: `${entry.id}:intro`, phase: "intro", direction, speaker: scene.speaker, emotion: direction.emotion, effect: "none",
    lines: [scene.line, entry.story], panel: introPanel(entry, evidenceFor(entry, game.seed)),
    label: `${entry.title}: mission brief`, ribbon: ribbon(direction), progress: { label: `MISSION ${entry.number} · BRIEFING`, total, done: 0, current: -1 } };
}

function preloadAfter(shot, entry) {
  if (shot.phase === "intro") preloadShot(entry.id, "decision", { round: 0 });
  else if (shot.phase === "decision" || shot.phase === "consequence") {
    const nextRound = game.draft ? game.draft.path.length + (shot.phase === "decision" ? 1 : 0) : 4;
    if (nextRound < entry.stages.length) preloadShot(entry.id, "decision", { round: nextRound });
  }
}

function setStoryChrome(on) {
  if (story.active === on) return;
  story.active = on;
  document.documentElement.classList.toggle("story-mode", on);
  try { on ? tg?.disableVerticalSwipes?.() : tg?.enableVerticalSwipes?.(); } catch { /* older clients */ }
}

function leaveStory() {
  director.dispose();
  story.typer?.dispose();
  story.typer = null;
  story.el = null;
  story.previous = null;
  setStoryChrome(false);
}

function renderStory() {
  const entry = getCase();
  const shot = storyShot(entry);
  shot.previous = story.previous;
  director.dispose();
  story.typer?.dispose();
  setStoryChrome(true);
  root.innerHTML = `<main class="story-shell">${storyStage(shot)}</main>`;
  story.el = root.querySelector(".story-stage");
  story.previous = shot.direction.base;
  const art = story.el.querySelector(".stage-art");
  if (art?.complete && art.naturalWidth) story.el.classList.add("art-ready");
  const motion = storyMotionEnabled();
  const speed = Number(new URLSearchParams(location.search).get("typespeed")) || DEFAULT_TYPE_SPEED;
  const bubbleText = story.el.querySelector(".bubble-text");
  story.typer = bindTypewriter(story.el.querySelector(".stage-bubble"), {
    speed,
    instant: !motion,
    // On short screens the bubble scrolls; keep the line being typed in view.
    onFrame: () => { if (bubbleText.scrollHeight > bubbleText.clientHeight) bubbleText.scrollTop = bubbleText.scrollHeight; },
    onDone: () => director.typingDone()
  });
  story.countOnEnter = shot.phase === "result" && countPending;
  countPending = false;
  const name = STORY_CHARACTERS[shot.speaker]?.name || "Narrator";
  announcer.textContent = `${shot.progress.label}. ${name}: ${shot.lines.filter(Boolean).join(" ")}`;
  director.play({ reducedMotion: !motion });
  preloadAfter(shot, entry);
  backButton();
}

function applyStoryStep(step) {
  const el = story.el;
  if (!el || !el.isConnected) return;
  el.dataset.step = step;
  // Cumulative classes (at-details, at-enter, ...) let CSS stage each reveal once and keep it.
  const order = [...SCENE_STEPS, ...EXIT_STEPS];
  const reached = order.indexOf(step);
  order.forEach((name, i) => el.classList.toggle(`at-${name}`, i <= reached));
  if (step === "enter" && story.countOnEnter) { story.countOnEnter = false; countUp(el.querySelector(".count-value"), true); }
  if (step === "typing") story.typer?.start();
  if (step === "choices") {
    if (story.countOnEnter) story.countOnEnter = false; // motion off: keep the static settled number
    story.typer?.complete();
    const panel = el.querySelector(".stage-panel");
    panel?.removeAttribute("inert");
    // Keyboard users land on the decision; touch and pointer users keep their place.
    if (story.keyboard && (!document.activeElement || document.activeElement === document.body)) panel?.querySelector("[tabindex='-1']")?.focus({ preventScroll: true });
  }
  if (step === "locked") el.querySelector(".stage-panel")?.setAttribute("aria-busy", "true");
}

function hurryStory() {
  if (!story.active) return;
  if (director.step === "typing") story.typer?.complete();
  else director.hurry();
}

function skipStory() {
  if (!story.active) return;
  director.skip();
  story.typer?.complete();
}

// Applies a decision through the existing game core, unchanged from the classic flow.
function commitChoice(id) {
  try {
    const current = getCase();
    game = chooseStep(game, caseId, id);
    if (game.draft.path.length === current.stages.length) {
      game = completeChain(game, caseId);
      stage = "result";
      countPending = true;
      try { tg?.HapticFeedback?.notificationOccurred(game.played.at(-1).delta >= 0 ? "success" : "warning"); } catch {}
    } else stage = "beat";
    persist(); render(); if (!story.active) window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) { showToast(error.message); }
  finally { moveBusy = false; }
}

function chooseInStory(button) {
  if (moveBusy || !caseId || !game.draft) return;
  const id = button.dataset.choice;
  const entry = getCase();
  // The director accepts exactly one selection, and only once decisions are visible.
  if (!director.select(() => commitChoice(id))) return;
  moveBusy = true;
  button.classList.add("is-chosen");
  button.setAttribute("aria-pressed", "true");
  story.el?.classList.add("has-choice");
  haptic("medium");
  // The last move settles the chain: warm up only the one result scene the player will see.
  if (!game.remote && game.draft.path.length === entry.stages.length - 1) {
    try { preloadShot(entry.id, "result", { band: chainResult(entry, [...game.draft.path, id], game.seed).band }); } catch { /* preload is optional */ }
  }
}

function render(options = {}) {
  if(remoteRequested && remoteStatus!=='ready'){
    leaveStory();
    const msg=remoteStatus==='connecting'
      ? 'Verifying your Telegram account and retrieving your progress.'
      : 'Secure sign-in is unavailable. Your virtual coins have not changed.';
    root.innerHTML='<main class="app-shell"><div class="app-inner"><section class="arcade-flow page-enter" style="padding:28px 18px"><h1 class="arcade-title">GWAPOHOLICS.</h1><p class="arcade-hook">'+msg+'</p><button class="arcade-button" data-action="auth-retry">RETRY SECURE SIGN-IN →</button><p class="arcade-fine">For local playtesting only use ?demo=1. Demo coins do not become live account coins.</p></section></div></main>';
    return;
  }
  if (!canPlay) { leaveStory(); root.innerHTML = `<main class="app-shell"><div class="app-inner">${gatePage()}</div></main>`; return; }
  if (storyEligible()) { renderStory(); return; }
  leaveStory();
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
  root.innerHTML = `<main class="app-shell ${cinematicMotionClass()}"><div class="app-inner">${topbar()}<div class="prototype-tag"><span>◉</span> ${game.remote ? "VERIFIED TELEGRAM PLAYER · VIRTUAL COINS" : "PLAYTEST · LOCAL-ONLY COINS"} · NO CASH VALUE</div><div class="page-content${options.quiet ? " quiet" : ""}">${content}</div>${view==="scenario" || view==="recovery" ? "" : bottomnav()}</div></main>`;
  backButton();
  if (countPending) { countPending = false; countUp(); }
}

root.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button || button.disabled) return;
  const { action } = button.dataset;
  if (action === "auth-retry") { if(remoteRequested)authenticatePlayer(); return; }
  if (action === "story-hurry") { hurryStory(); return; }
  if (action === "story-skip") { skipStory(); return; }
  if (action === "story-exit") { changeView("home"); return; }
  if (action === "toggle-story-motion") {
    const on = toggleCinematicMotion();
    haptic("light");
    if (story.active && story.el) {
      // Apply in place so the current shot is not restarted.
      story.el.classList.toggle("story-static", !on);
      button.setAttribute("aria-pressed", String(!on));
      button.setAttribute("aria-label", on ? "Turn story animation off" : "Turn story animation on");
      button.firstElementChild.textContent = on ? "✦" : "✧";
      if (!on) skipStory();
    } else render();
    return;
  }
  if (action === "nav") { changeView(button.dataset.view); return; }
  if (action === "open-case") { openCase(button.dataset.case); return; }
  if (action === "decide") {
    try { game = startCase(game, caseId); persist(); stage = "decide"; selectedChoice = null; haptic(); render(); }
    catch (error) { showToast(error.message); }
    return;
  }
  if (action === "back-stage") { stage = "brief"; selectedChoice = null; render(); return; }
  if (action === "choose") {
    if (story.active) { chooseInStory(button); return; }
    if (moveBusy || !caseId || !game.draft) return;
    moveBusy = true;
    const id = button.dataset.choice;
    button.classList.add("locked-choice");
    haptic("medium");
    window.setTimeout(() => commitChoice(id), 250);
    return;
  }
  if (action === "next-step") { stage = "decide"; haptic("light"); render(); if (!story.active) window.scrollTo({top:0,behavior:"smooth"}); return; }
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

// Hidden app: finish the current shot instantly and pause ambient loops; nothing runs in the background.
document.addEventListener("visibilitychange", () => {
  const hidden = document.visibilityState === "hidden";
  document.documentElement.classList.toggle("app-hidden", hidden);
  if (hidden) skipStory();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Tab") story.keyboard = true;
  if (!story.active) return;
  const onControl = event.target.closest?.("button, a, input, summary, details, [tabindex]");
  if ((event.key === " " || event.key === "Enter") && !onControl) { event.preventDefault(); hurryStory(); }
  if (event.key === "Escape") skipStory();
});
document.addEventListener("pointerdown", () => { story.keyboard = false; }, { passive: true });

// Pointer parallax (fine pointers only): background, light and cast layers drift by different amounts.
let parallaxFrame = 0;
document.addEventListener("pointermove", (event) => {
  if (!story.active || !story.el || event.pointerType !== "mouse" || !storyMotionEnabled() || parallaxFrame) return;
  parallaxFrame = requestAnimationFrame(() => {
    parallaxFrame = 0;
    if (!story.el) return;
    story.el.style.setProperty("--px", ((event.clientX / innerWidth) * 2 - 1).toFixed(3));
    story.el.style.setProperty("--py", ((event.clientY / innerHeight) * 2 - 1).toFixed(3));
  });
}, { passive: true });

// Images fade in when decoded; a failed scene keeps its readable gradient fallback.
root.addEventListener("load", (event) => {
  if (event.target.classList?.contains("stage-art")) event.target.closest(".story-stage")?.classList.add("art-ready");
}, true);
root.addEventListener("error", (event) => {
  const img = event.target;
  if (img.tagName !== "IMG") return;
  if (img.classList.contains("stage-art")) img.closest(".story-stage")?.classList.add("art-missing");
  else img.closest(".stage-character")?.classList.add("is-missing");
}, true);

setupTelegram();
if(remoteRequested)authenticatePlayer();
else render();
