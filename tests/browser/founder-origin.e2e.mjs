import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,isShifted} from '../../game-core.mjs';
import {publicGameView} from '../../server/game-service.mjs';
import {executeFounderCommand,FounderError} from '../../server/v2/founder-service.mjs';
import {createMemoryFounderStore} from '../support/memory-founder-store.mjs';
import {config,baseEnv} from '../support/founder-suite.mjs';
import {QUEST_IDS,bestPath,worstPath,harness} from '../support/origin-play.mjs';
import {loadV2Config} from '../../server/v2/config.mjs';
import {CASES} from '../../cases.mjs';
import {ENGINES,launch} from './engines.mjs';

// v2.1-A Founder Entry, end to end in a real browser. Runs once per engine (Chromium and WebKit in CI)
// with touch-enabled mobile emulation, like tests/browser/mobile-engines.e2e.mjs. The server side is the
// REAL founder service + an in-memory store behind route mocks (same pattern as secure-telegram.e2e.mjs).
const BASE='http://127.0.0.1:4173/';
const UID='6100000001';
const NOW=1800000000000;
const SEED=7;

function mockTelegram(){
 window.Telegram={WebApp:{
  initData:'test-signed-launch-validated-by-mocked-server',
  initDataUnsafe:{user:{first_name:'Ada'}},
  ready(){},expand(){},setHeaderColor(){},setBackgroundColor(){},onEvent(){},
  BackButton:{onClick(){},show(){},hide(){}},
  HapticFeedback:{impactOccurred(){},notificationOccurred(){}}
 }};
}
// `probeStatus` and `postStatus` simulate authentication failures; `enabled:false` simulates the flag being off.
async function open(engine,{enabled=true,seed=SEED,cfg=config,probeStatus=200,postStatus=0,graduate=false}={}){
 const browser=await launch(engine);
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,reducedMotion:'reduce'});
 await context.addInitScript(mockTelegram);
 const store=createMemoryFounderStore({commandBudget:{limit:100000,windowSeconds:60}});
 if (graduate) {
  const founder = harness({store,config:cfg,telegramUserId:UID,seed});
  await founder.playRun(bestPath);
  await founder.send('enter_hub');
 }
 const posts=[];let clock=NOW;
 await context.route('**/api/session',r=>r.fulfill({status:200,contentType:'application/json',body:'{"authenticated":true}'}));
 await context.route('**/api/game',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({state:publicGameView(createGame(NOW,12345),NOW)})}));
 await context.route('**/api/v2/founder',async route=>{
  const req=route.request();
  if(!enabled){await route.fulfill({status:404,contentType:'application/json',body:'{"error":"not_found"}'});return}
  if(req.method()==='GET'&&probeStatus!==200){await route.fulfill({status:probeStatus,contentType:'application/json',body:'{"error":"sign_in_required"}'});return}
  let input={command:'snapshot'};
  if(req.method()==='POST'){
   input=JSON.parse(req.postData());posts.push(input);
   if(postStatus){await route.fulfill({status:postStatus,contentType:'application/json',body:'{"error":"sign_in_required"}'});return}
  }
  try{
   const founder=await executeFounderCommand({store,config:cfg,telegramUserId:UID,now:(clock+=1000),newSeed:()=>seed,...input});
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({founder})});
  }catch(e){
   const status=e instanceof FounderError?e.status:503;
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify({error:e.code||'founder_service_unavailable'})});
  }
 });
 const page=await context.newPage();
 await page.route('https://telegram.org/js/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:'/* mocked */'}));
 const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 return {browser,context,page,store,posts,pageErrors};
}
// Touch-class interaction, as a phone user would do it.
const press=loc=>loc.tap();
async function openFounderTab(page){await press(page.locator('.bottomnav [data-view="founder"]'))}
async function playQuest(page,caseId,path,{last=false}={}){
 await press(page.locator(`[data-action="fh-open-quest"][data-case="${caseId}"]`).first());
 await page.locator('.story-stage.phase-intro').waitFor();
 await press(page.locator('[data-action="og-decide"]'));
 for(let i=0;i<path.length;i++){
  await page.locator('.story-stage.phase-decision').waitFor();
  await press(page.locator(`[data-action="og-choose"][data-choice="${path[i]}"]`));
  if(i<path.length-1){
   await page.locator('.story-stage.phase-consequence').waitFor();
   await press(page.locator('[data-action="og-next"]'));
  }
 }
 await page.locator('.story-stage.phase-result').waitFor();
 if(!last)await press(page.locator('[data-action="story-exit"]').first());
}
async function navIsOneRow(page){
 const tops=await page.locator('.bottomnav .tab').evaluateAll(els=>els.map(e=>Math.round(e.getBoundingClientRect().top)));
 assert.equal(tops.length,4);
 assert.equal(new Set(tops).size,1,'four tabs must sit on one row: '+tops);
}
async function noHorizontalScroll(page){
 const w=await page.evaluate(()=>[document.documentElement.scrollWidth,window.innerWidth]);
 assert.ok(w[0]<=w[1]+1,`horizontal overflow ${w[0]} > ${w[1]}`);
}
const digits=t=>t.replace(/,/g,'');

for(const engine of ENGINES){
 const t=(name,fn)=>test(`[${engine.name}] ${name}`,fn);

 t('new player: zero start, five cinematic Origin quests, verified credit, graduation, persistent Founder Hub',async()=>{
  const {browser,page,store,posts,pageErrors}=await open(engine);
  try{
   await page.locator('.fh-home-banner').waitFor();
   assert.match(await page.locator('.fh-home-banner').innerText(),/START AT ZERO/);
   await openFounderTab(page);
   assert.match(await page.locator('.fh-page h1').innerText(),/START AT\s+ZERO/);
   await navIsOneRow(page);
   assert.match(await page.locator('.arcade-wallet').innerText(),/0\s*G/);
   await noHorizontalScroll(page);
   await press(page.locator('[data-action="fh-start-run"]'));
   await page.locator('.fh-page .case-list-item').first().waitFor();
   assert.equal(await page.locator('.fh-page .case-list-item').count(),5);
   assert.match(await page.locator('.fh-page .eyebrow').innerText(),/ORIGIN RUN 1/);

   for(let i=0;i<QUEST_IDS.length;i++){
    const id=QUEST_IDS[i];
    if(i===0){
     // quest scene accessibility: labelled stage, dialogue announced once through a polite live region
     await press(page.locator(`[data-action="fh-open-quest"][data-case="${id}"]`).first());
     await page.locator('.story-stage.phase-intro').waitFor();
     assert.ok(await page.locator('.story-stage[aria-label]').count()===1,'story stage is labelled');
     assert.match(await page.locator('[aria-live="polite"]').first().textContent(),/ORIGIN QUEST 1 · BRIEFING/);
     assert.match(await page.locator('.hud-balance').getAttribute('aria-label'),/Origin points so far/);
     await page.locator('[data-action="story-exit"]').first().tap();
     await page.locator('.fh-page .case-list-item').first().waitFor();
    }
    await playQuest(page,id,bestPath(id,SEED),{last:i===QUEST_IDS.length-1});
    if(i<QUEST_IDS.length-1){
     await page.locator('.fh-page .case-list-item.done').nth(i).waitFor();
     assert.equal(await page.locator('.fh-page .case-list-item.done').count(),i+1);
     assert.equal(store.db.ledger.length,0,'no capital before all five quests are complete');
    }
   }
   const resultText=await page.locator('.story-stage.phase-result .stage-panel').innerText();
   assert.match(resultText,/Points are not G until your run is complete/);
   await press(page.locator('[data-action="og-graduate"]'));
   await page.locator('[data-action="fh-enter-hub"]').waitFor();
   const server=store.db.ledger[0];
   assert.equal(store.db.ledger.length,1);
   const graduation=await page.locator('.story-stage .stage-panel').innerText();
   assert.match(graduation,/ORIGIN VERIFIED/);
   assert.ok(digits(graduation).includes(String(server.creditDeltaG)),'graduation shows the server credit');
   assert.ok(digits(await page.locator('.stage-score').innerText()).includes(String(server.verifiedScoreG)),'overlay shows the verified score');
   await press(page.locator('[data-action="fh-enter-hub"]'));

   // Founder Hub
   await page.locator('.fh-identity').waitFor();
   const hub=await page.locator('.fh-page').innerText();
   assert.match(hub,/FOUNDER\s+Ada/);
   assert.match(hub,/F-[0-9A-F]{8}/);
   assert.match(hub,/GRADUATED/);
   assert.ok(digits(hub).includes(String(server.verifiedScoreG)),'verified score visible');
   assert.match(digits(await page.locator('.fh-stats').innerText()),new RegExp(String(server.balanceAfterG)));
   assert.match(digits(await page.locator('.arcade-wallet').innerText()),new RegExp(String(server.balanceAfterG)));
   assert.equal(await page.locator('.fh-goal').count(),5);
   assert.equal(await page.locator('.fh-goal.is-completed').count(),1);
   assert.equal(await page.locator('.fh-goal.is-upcoming').count(),4);
   assert.equal(await page.locator('.fh-preview').count(),3);
   assert.equal(await page.locator('.fh-previews button, .fh-previews a, .fh-preview [data-action]').count(),0,'previews are not purchasable');
   assert.match(await page.locator('.fh-next').innerText(),/NEXT STEP[\s\S]*first company/i);
   assert.match(await page.locator('.fh-bubble').innerText(),/FUTURE YOU/);
   await noHorizontalScroll(page);
   await navIsOneRow(page);
   // identity cells never break words mid-token (e.g. "GRADUAT-ED", "F-" / "ABC123")
   const cells=await page.locator('.fh-identity strong').evaluateAll(els=>els.map(e=>e.getBoundingClientRect().height));
   assert.ok(cells.every(h=>h<28),'identity values stay on one line: '+cells);

   // essential accessibility: one page heading, every control named, reduced motion honoured, dialogue readable without animation
   assert.equal(await page.locator('h1').count(),1);
   assert.equal(await page.evaluate(()=>document.documentElement.lang),'en');
   const unnamed=await page.evaluate(()=>[...document.querySelectorAll('button,a[href]')].filter(el=>!((el.innerText||'').trim()||el.getAttribute('aria-label'))).length);
   assert.equal(unnamed,0,'every button/link has an accessible name');
   assert.ok(await page.locator('.app-shell.story-static').count()===1,'prefers-reduced-motion switches the shell to static mode');
   assert.equal(await page.locator('.fh-hero-art').evaluate(el=>getComputedStyle(el).animationName),'none','no decorative animation under reduced motion');
   const heroLine=(await page.locator('.fh-bubble .sr-only').textContent()).trim();
   assert.ok(heroLine.length>20);
   assert.equal((await page.locator('.fh-bubble-text').textContent()).replace(/\s+/g,' ').trim(),heroLine,'dialogue is fully shown immediately when motion is reduced');
   assert.equal(await page.locator('.fh-goals').evaluate(el=>el.tagName),'OL','goals are an ordered list');
   // keyboard operability: focus the primary action, activate with Enter, the previews section scrolls into view
   await page.locator('.fh-next .arcade-button').focus();
   assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-action')),'fh-preview');
   await page.keyboard.press('Enter');
   await page.waitForFunction(()=>{const r=document.getElementById('fh-previews')?.getBoundingClientRect();return r&&r.top<innerHeight&&r.bottom>0});

   // 320 px phone: no horizontal scroll, nav still one row
   await page.setViewportSize({width:320,height:640});
   await noHorizontalScroll(page);
   await navIsOneRow(page);
   await page.setViewportSize({width:390,height:844});

   // cross-session persistence: a brand-new page load (no local state) sees the same founder
   const before=store.db.ledger.length;
   await page.reload({waitUntil:'domcontentloaded'});
   await openFounderTab(page);
   await page.locator('.fh-identity').waitFor();
   assert.match(digits(await page.locator('.fh-stats').innerText()),new RegExp(String(server.balanceAfterG)));
   assert.equal(store.db.ledger.length,before);
   const keys=await page.evaluate(()=>Object.keys(localStorage));
   assert.deepEqual(keys.filter(k=>!k.startsWith('gwapoholics.motion')),[],'no founder data in browser storage');

   // replay with an equal score: unlimited replays, zero additional G, never a duplicate credit
   await press(page.locator('[data-action="fh-replay"]').last());
   await page.locator('.fh-page .case-list-item').first().waitFor();
   for(let i=0;i<QUEST_IDS.length;i++)await playQuest(page,QUEST_IDS[i],bestPath(QUEST_IDS[i],SEED),{last:i===QUEST_IDS.length-1});
   await press(page.locator('[data-action="og-graduate"]'));
   await page.locator('[data-action="og-hub"]').waitFor();
   assert.match(await page.locator('.story-stage .stage-panel').innerText(),/REPLAY VERIFIED[\s\S]*BEST STANDS[\s\S]*0 G/);
   assert.equal(store.db.ledger.length,1,'an equal replay creates no credit');
   assert.equal(store.db.settlements.length,2);
   await press(page.locator('[data-action="og-hub"]'));
   await page.locator('.fh-identity').waitFor();
   assert.match(await page.locator('.fh-receipts').textContent(),/Run 2[\s\S]*No new capital/);
   assert.match(await page.locator('.fh-receipts summary').innerText(),/CAPITAL RECEIPTS · 2/);

   // only the four allowed fields ever leave the browser
   for(const body of posts){
    assert.ok(Object.keys(body).every(k=>['command','requestId','caseId','choiceId'].includes(k)),JSON.stringify(body));
    assert.ok(!/score|balance|capital|delta|founderId/i.test(JSON.stringify(body)));
   }
   assert.ok(posts.length>=52,'25+1 commands per run, two runs, plus hub entry');
   assert.equal(pageErrors.length,0,pageErrors.join('\n'));
  }finally{await browser.close()}
 });

 t('first company: review terms, confirm supplier, recover a lost response and reopen the receipt',async()=>{
  const cfg={...config,businessSchemaEnabled:true,starterOffer:{businessTypeId:'barbershop',version:1,name:'Barbershop',setupCostG:17,minimumOperatingReserveG:5}};
  const {browser,page,store,posts,pageErrors}=await open(engine,{cfg,graduate:true});
  try{
   await page.setViewportSize({width:320,height:640});
   await openFounderTab(page);
   await page.getByRole('button',{name:/review opening terms/i}).click();
   await page.getByRole('radio',{name:/reserve a delivery slot/i}).check();
   // Let the server commit. Cut the response before the page receives it.
   await page.route('**/api/v2/founder',async route=>{
    if(route.request().method()==='GET') return route.fallback();
    const input=route.request().postDataJSON();
    posts.push(input);
    await executeFounderCommand({store,config:cfg,telegramUserId:UID,now:NOW,...input});
    await route.abort('failed');
   });
   await page.getByRole('button',{name:/confirm opening/i}).click();
   await page.locator('#fh-company-name').waitFor();
   const company=[...store.db.businesses.values()][0];
   assert.equal(company.setupCostG,17);
   assert.equal(company.decision.choiceId,'scheduled');
   assert.equal(posts.filter(p=>p.command==='business_open').length,1);
   assert.equal(await page.getByRole('button',{name:/confirm opening/i}).count(),0);
   await page.reload(); await openFounderTab(page);
   assert.ok((await page.getByRole('region',{name:'Your business'}).innerText()).includes(company.transactionId));
   assert.equal(store.db.businesses.size,1);
   await noHorizontalScroll(page);
   assert.deepEqual(pageErrors,[]);
  }finally{await browser.close()}
 });

 t('zero-capital founder still enters the hub, sees ZERO CAPITAL and has an eligible replay path',async()=>{
  let seed=0;while(isShifted(CASES[0],seed)||isShifted(CASES[3],seed))seed+=1;
  const {browser,page,store,pageErrors}=await open(engine,{seed});
  try{
   await openFounderTab(page);
   await press(page.locator('[data-action="fh-start-run"]'));
   await page.locator('.fh-page .case-list-item').first().waitFor();
   for(let i=0;i<QUEST_IDS.length;i++)await playQuest(page,QUEST_IDS[i],worstPath(QUEST_IDS[i],seed),{last:i===QUEST_IDS.length-1});
   await press(page.locator('[data-action="og-graduate"]'));
   assert.match(await page.locator('.story-stage .stage-panel').innerText(),/YOU'RE A\s+FOUNDER[\s\S]*0 G/i);
   assert.equal(store.db.ledger.length,0,'zero outcome is a receipt, not a credit');
   await press(page.locator('[data-action="fh-enter-hub"]'));
   await page.locator('.fh-identity').waitFor();
   assert.match(await page.locator('.fh-capital').innerText(),/ZERO CAPITAL/);
   assert.match(await page.locator('.fh-next').innerText(),/Raise your startup capital/);
   assert.equal(await page.locator('[data-action="fh-replay"]').count()>=1,true);
   await press(page.locator('.fh-next [data-action="fh-replay"]'));
   await page.locator('.fh-page .case-list-item').first().waitFor();
   assert.match(await page.locator('.fh-page .eyebrow').innerText(),/ORIGIN RUN 2/);
   assert.equal(pageErrors.length,0,pageErrors.join('\n'));
  }finally{await browser.close()}
 });

 t('a run in progress survives a reload and resumes from server state',async()=>{
  const {browser,page,store,pageErrors}=await open(engine);
  try{
   await openFounderTab(page);
   await press(page.locator('[data-action="fh-start-run"]'));
   await page.locator('.fh-page .case-list-item').first().waitFor();
   for(let i=0;i<2;i++)await playQuest(page,QUEST_IDS[i],bestPath(QUEST_IDS[i],SEED));
   const third=QUEST_IDS[2],p3=bestPath(third,SEED);
   await press(page.locator(`[data-action="fh-open-quest"][data-case="${third}"]`).first());
   await press(page.locator('[data-action="og-decide"]'));
   await page.locator('.story-stage.phase-decision').waitFor();
   await press(page.locator(`[data-action="og-choose"][data-choice="${p3[0]}"]`));
   await page.locator('.story-stage.phase-consequence').waitFor();
   await page.reload({waitUntil:'domcontentloaded'});
   await openFounderTab(page);
   await page.locator('.fh-page .case-list-item').first().waitFor();
   assert.match(await page.locator('.fh-page .eyebrow').innerText(),/2 \/ 5 QUESTS/);
   assert.match(await page.locator('.fh-page').innerText(),/IN PROGRESS · RESUME/);
   assert.equal(store.db.ledger.length,0,'an unfinished run awards no capital');
   await press(page.locator(`[data-action="fh-open-quest"][data-case="${third}"]`).first());
   await page.locator('.story-stage.phase-decision').waitFor();
   assert.match(await page.locator('.story-stage .stage-ribbon').innerText(),/ORIGIN 3\/5/);
   assert.equal(pageErrors.length,0,pageErrors.join('\n'));
  }finally{await browser.close()}
 });

 t('feature flag OFF: no Founder entry point appears and the v1 home is unchanged',async()=>{
  const {browser,page,pageErrors}=await open(engine,{enabled:false});
  try{
   await page.locator('[data-action="open-case"]').first().waitFor();
   await page.waitForTimeout(300);
   assert.equal(await page.locator('.fh-home-banner').count(),0);
   assert.equal(await page.locator('.bottomnav [data-view="founder"]').count(),0);
   assert.equal(await page.locator('.bottomnav .tab').count(),3);
   assert.match(await page.locator('.prototype-tag').innerText(),/VERIFIED TELEGRAM PLAYER/);
   assert.equal(pageErrors.length,0,pageErrors.join('\n'));
  }finally{await browser.close()}
 });

 t('Origin closed (policy unapproved): hub explains it and offers no way to start',async()=>{
  const closed=loadV2Config({GWAP_V2_FOUNDER_HUB:'1',GWAP_V2_ORIGIN_POLICY:'origin-v1-draft',GWAP_V2_ANALYTICS_KEY:baseEnv.GWAP_V2_ANALYTICS_KEY});
  const {browser,page,store}=await open(engine,{cfg:closed});
  try{
   await openFounderTab(page);
   await page.locator('.fh-page').waitFor();
   assert.match(await page.locator('.fh-page').innerText(),/OPENS SOON|awaiting approval/i);
   assert.equal(await page.locator('[data-action="fh-start-run"]').count(),0);
   assert.equal(store.db.founders.size,0);
  }finally{await browser.close()}
 });

 t('authentication boundary: an unauthenticated probe reveals no Founder UI and leaves v1 playable',async()=>{
  const {browser,page,store,posts,pageErrors}=await open(engine,{probeStatus:401});
  try{
   await page.locator('[data-action="open-case"]').first().waitFor();
   await page.waitForTimeout(300);
   assert.equal(await page.locator('.fh-home-banner').count(),0);
   assert.equal(await page.locator('.bottomnav [data-view="founder"]').count(),0);
   assert.equal(store.db.founders.size,0);
   assert.equal(posts.length,0,'no founder command is ever sent without a verified session');
   assert.equal(pageErrors.length,0,pageErrors.join('\n'));
  }finally{await browser.close()}
 });

 t('authentication boundary: a session that expires mid-flow shows a safe message and changes nothing',async()=>{
  const {browser,page,store,pageErrors}=await open(engine,{postStatus:401});
  try{
   await openFounderTab(page);
   await press(page.locator('[data-action="fh-start-run"]'));
   await page.locator('.toast').waitFor();
   assert.match(await page.locator('.toast').innerText(),/Telegram session expired/);
   assert.match(await page.locator('.fh-page h1').innerText(),/START AT\s+ZERO/,'still on the gate');
   assert.equal(store.db.founders.size,0);
   assert.equal(store.db.ledger.length,0);
   assert.equal(pageErrors.length,0,pageErrors.join('\n'));
  }finally{await browser.close()}
 });
}
