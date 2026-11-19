import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createGame} from '../../game-core.mjs';
import {publicGameView} from '../../server/game-service.mjs';
import {executeFounderCommand,FounderError} from '../../server/v2/founder-service.mjs';
import {createMemoryFounderStore} from '../support/memory-founder-store.mjs';
import {config,baseEnv} from '../support/founder-suite.mjs';
import {QUEST_IDS,bestPath,worstPath} from '../support/origin-play.mjs';
import {loadV2Config} from '../../server/v2/config.mjs';
import {isShifted} from '../../game-core.mjs';
import {CASES} from '../../cases.mjs';

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
async function open({enabled=true,seed=SEED,cfg=config}={}){
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await context.addInitScript(mockTelegram);
 const store=createMemoryFounderStore({commandBudget:{limit:100000,windowSeconds:60}});
 const posts=[];let clock=NOW;
 await context.route('**/api/session',r=>r.fulfill({status:200,contentType:'application/json',body:'{"authenticated":true}'}));
 await context.route('**/api/game',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({state:publicGameView(createGame(NOW,12345),NOW)})}));
 await context.route('**/api/v2/founder',async route=>{
  if(!enabled){await route.fulfill({status:404,contentType:'application/json',body:'{"error":"not_found"}'});return}
  const req=route.request();
  let input={command:'snapshot'};
  if(req.method()==='POST'){input=JSON.parse(req.postData());posts.push(input);}
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
async function openFounderTab(page){
 await page.locator('.bottomnav [data-view="founder"]').click();
}
async function playQuest(page,caseId,path,{last=false}={}){
 await page.locator(`[data-action="fh-open-quest"][data-case="${caseId}"]`).first().click();
 await page.locator('.story-stage.phase-intro').waitFor();
 await page.locator('[data-action="og-decide"]').click();
 for(let i=0;i<path.length;i++){
  await page.locator('.story-stage.phase-decision').waitFor();
  await page.locator(`[data-action="og-choose"][data-choice="${path[i]}"]`).click();
  if(i<path.length-1){
   await page.locator('.story-stage.phase-consequence').waitFor();
   await page.locator('[data-action="og-next"]').click();
  }
 }
 await page.locator('.story-stage.phase-result').waitFor();
 if(!last)await page.locator('[data-action="story-exit"]').first().click();
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

test('new player: zero start, five cinematic Origin quests, verified credit, graduation, persistent Founder Hub',async()=>{
 const {browser,page,store,posts,pageErrors}=await open();
 try{
  await page.locator('.fh-home-banner').waitFor();
  assert.match(await page.locator('.fh-home-banner').innerText(),/START AT ZERO/);
  await openFounderTab(page);
  assert.match(await page.locator('.fh-page h1').innerText(),/START AT\s+ZERO/);
  await navIsOneRow(page);
  assert.match(await page.locator('.arcade-wallet').innerText(),/0\s*G/);
  await noHorizontalScroll(page);
  await page.locator('[data-action="fh-start-run"]').click();
  await page.locator('.fh-page .case-list-item').first().waitFor();
  assert.equal(await page.locator('.fh-page .case-list-item').count(),5);
  assert.match(await page.locator('.fh-page .eyebrow').innerText(),/ORIGIN RUN 1/);

  for(let i=0;i<QUEST_IDS.length;i++){
   const id=QUEST_IDS[i];
   await playQuest(page,id,bestPath(id,SEED),{last:i===QUEST_IDS.length-1});
   if(i<QUEST_IDS.length-1){
    await page.locator('.fh-page .case-list-item.done').nth(i).waitFor();
    assert.equal(await page.locator('.fh-page .case-list-item.done').count(),i+1);
    assert.equal(store.db.ledger.length,0,'no capital before all five quests are complete');
   }
  }
  // fifth quest result -> verified score -> graduation (cinematic)
  const resultText=await page.locator('.story-stage.phase-result .stage-panel').innerText();
  assert.match(resultText,/Points are not G until your run is complete/);
  await page.locator('[data-action="og-graduate"]').click();
  await page.locator('[data-action="fh-enter-hub"]').waitFor();
  const server=store.db.ledger[0];
  assert.equal(store.db.ledger.length,1);
  const graduation=await page.locator('.story-stage .stage-panel').innerText();
  assert.match(graduation,/ORIGIN VERIFIED/);
  assert.ok(graduation.replace(/,/g,'').includes(String(server.creditDeltaG)),'graduation shows the server credit');
  assert.ok((await page.locator('.stage-score').innerText()).replace(/,/g,'').includes(String(server.verifiedScoreG)),'overlay shows the verified score');
  await page.locator('[data-action="fh-enter-hub"]').click();

  // Founder Hub
  await page.locator('.fh-identity').waitFor();
  const hub=await page.locator('.fh-page').innerText();
  assert.match(hub,/FOUNDER\s+Ada/);
  assert.match(hub,/F-[0-9A-F]{8}/);
  assert.match(hub,/GRADUATED/);
  assert.ok(hub.replace(/,/g,'').includes(String(server.verifiedScoreG)),'verified score visible');
  assert.match(await page.locator('.fh-stats').innerText().then(t=>t.replace(/,/g,'')),new RegExp(String(server.balanceAfterG)));
  assert.match(await page.locator('.arcade-wallet').innerText().then(t=>t.replace(/,/g,'')),new RegExp(String(server.balanceAfterG)));
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
  await page.setViewportSize({width:320,height:640});
  await noHorizontalScroll(page);
  await navIsOneRow(page);
  await page.setViewportSize({width:390,height:844});

  // cross-session persistence: a brand-new page load (no local state) sees the same founder
  const before=store.db.ledger.length;
  await page.reload({waitUntil:'domcontentloaded'});
  await openFounderTab(page);
  await page.locator('.fh-identity').waitFor();
  assert.match(await page.locator('.fh-stats').innerText().then(t=>t.replace(/,/g,'')),new RegExp(String(server.balanceAfterG)));
  assert.equal(store.db.ledger.length,before);
  const keys=await page.evaluate(()=>Object.keys(localStorage));
  assert.deepEqual(keys.filter(k=>!k.startsWith('gwapoholics.motion')),[],'no founder data in browser storage');

  // replay with an equal score: unlimited replays, zero additional G, never a duplicate credit
  await page.locator('[data-action="fh-replay"]').last().click();
  await page.locator('.fh-page .case-list-item').first().waitFor();
  for(let i=0;i<QUEST_IDS.length;i++)await playQuest(page,QUEST_IDS[i],bestPath(QUEST_IDS[i],SEED),{last:i===QUEST_IDS.length-1});
  await page.locator('[data-action="og-graduate"]').click();
  await page.locator('[data-action="og-hub"]').waitFor();
  assert.match(await page.locator('.story-stage .stage-panel').innerText(),/REPLAY VERIFIED[\s\S]*BEST STANDS[\s\S]*0 G/);
  assert.equal(store.db.ledger.length,1,'an equal replay creates no credit');
  assert.equal(store.db.settlements.length,2);
  await page.locator('[data-action="og-hub"]').click();
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

test('zero-capital founder still enters the hub, sees ZERO CAPITAL and has an eligible replay path',async()=>{
 let seed=0;while(isShifted(CASES[0],seed)||isShifted(CASES[3],seed))seed+=1;
 const {browser,page,store,pageErrors}=await open({seed});
 try{
  await openFounderTab(page);
  await page.locator('[data-action="fh-start-run"]').click();
  await page.locator('.fh-page .case-list-item').first().waitFor();
  for(let i=0;i<QUEST_IDS.length;i++)await playQuest(page,QUEST_IDS[i],worstPath(QUEST_IDS[i],seed),{last:i===QUEST_IDS.length-1});
  await page.locator('[data-action="og-graduate"]').click();
  assert.match(await page.locator('.story-stage .stage-panel').innerText(),/YOU'RE A\s+FOUNDER[\s\S]*0 G/i);
  assert.equal(store.db.ledger.length,0,'zero outcome is a receipt, not a credit');
  await page.locator('[data-action="fh-enter-hub"]').click();
  await page.locator('.fh-identity').waitFor();
  assert.match(await page.locator('.fh-capital').innerText(),/ZERO CAPITAL/);
  assert.match(await page.locator('.fh-next').innerText(),/Raise your startup capital/);
  assert.equal(await page.locator('[data-action="fh-replay"]').count()>=1,true);
  await page.locator('.fh-next [data-action="fh-replay"]').click();
  await page.locator('.fh-page .case-list-item').first().waitFor();
  assert.match(await page.locator('.fh-page .eyebrow').innerText(),/ORIGIN RUN 2/);
  assert.equal(pageErrors.length,0,pageErrors.join('\n'));
 }finally{await browser.close()}
});

test('a run in progress survives a reload and resumes from server state',async()=>{
 const {browser,page,store,pageErrors}=await open();
 try{
  await openFounderTab(page);
  await page.locator('[data-action="fh-start-run"]').click();
  await page.locator('.fh-page .case-list-item').first().waitFor();
  for(let i=0;i<2;i++)await playQuest(page,QUEST_IDS[i],bestPath(QUEST_IDS[i],SEED));
  // begin a third quest and stop after two decisions
  const third=QUEST_IDS[2],p3=bestPath(third,SEED);
  await page.locator(`[data-action="fh-open-quest"][data-case="${third}"]`).first().click();
  await page.locator('[data-action="og-decide"]').click();
  await page.locator('.story-stage.phase-decision').waitFor();
  await page.locator(`[data-action="og-choose"][data-choice="${p3[0]}"]`).click();
  await page.locator('.story-stage.phase-consequence').waitFor();
  await page.reload({waitUntil:'domcontentloaded'});
  await openFounderTab(page);
  await page.locator('.fh-page .case-list-item').first().waitFor();
  assert.match(await page.locator('.fh-page .eyebrow').innerText(),/2 \/ 5 QUESTS/);
  assert.match(await page.locator('.fh-page').innerText(),/IN PROGRESS · RESUME/);
  assert.equal(store.db.ledger.length,0,'an unfinished run awards no capital');
  await page.locator(`[data-action="fh-open-quest"][data-case="${third}"]`).first().click();
  await page.locator('.story-stage.phase-decision').waitFor();
  assert.match(await page.locator('.story-stage .stage-ribbon').innerText(),/ORIGIN 3\/5/);
  assert.equal(pageErrors.length,0,pageErrors.join('\n'));
 }finally{await browser.close()}
});

test('feature flag OFF: no Founder entry point appears and the v1 home is unchanged',async()=>{
 const {browser,page,pageErrors}=await open({enabled:false});
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

test('Origin closed (policy unapproved): hub explains it and offers no way to start',async()=>{
 const closed=loadV2Config({GWAP_V2_FOUNDER_HUB:'1',GWAP_V2_ORIGIN_POLICY:'origin-v1-draft',GWAP_V2_ANALYTICS_KEY:baseEnv.GWAP_V2_ANALYTICS_KEY});
 const {browser,page,store}=await open({cfg:closed});
 try{
  await openFounderTab(page);
  await page.locator('.fh-page').waitFor();
  assert.match(await page.locator('.fh-page').innerText(),/OPENS SOON|awaiting approval/i);
  assert.equal(await page.locator('[data-action="fh-start-run"]').count(),0);
  assert.equal(store.db.founders.size,0);
 }finally{await browser.close()}
});
