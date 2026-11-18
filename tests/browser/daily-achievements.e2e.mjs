import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {createGame,STORAGE_KEY} from '../../game-core.mjs';
import {ACHIEVEMENTS} from '../../daily-enhancements.mjs';

const BASE='http://127.0.0.1:4173/?demo=1';
const ORIGIN=new URL(BASE).origin;
const ACHIEVEMENTS_KEY='gwap.telegram.daily-achievements.v1';
const LEADERBOARD_KEY='gwap.telegram.daily-leaderboard.v1';
const TOAST='[data-testid="achievement-toast"]';
const DISMISS='Dismiss achievement notification';
const titles=new Map(ACHIEVEMENTS.map(item=>[item.id,item.title]));
const rarities=new Map(ACHIEVEMENTS.map(item=>[item.id,item.rarity]));

async function makeOfflineContext(browser,viewport,reducedMotion='reduce'){
 const context=await browser.newContext({
  viewport,isMobile:true,hasTouch:true,deviceScaleFactor:2,reducedMotion
 });
 const unexpectedRequests=[];
 // The page references these optional resources, but tests must never contact them.
 await context.route('**/*',async route=>{
  const request=route.request();
  const url=new URL(request.url());
  if(url.origin===ORIGIN && ['GET','HEAD'].includes(request.method()) &&
     url.pathname!=='/api' && !url.pathname.startsWith('/api/')) return route.continue();
  if(url.origin==='https://telegram.org' && url.pathname==='/js/telegram-web-app.js'){
   return route.fulfill({status:200,contentType:'application/javascript',body:'/* offline demo */'});
  }
  if(url.origin==='https://fonts.googleapis.com'){
   return route.fulfill({status:200,contentType:'text/css',body:'/* offline font fallback */'});
  }
  unexpectedRequests.push(request.method()+' '+url.origin+url.pathname);
  return route.fulfill({status:200,contentType:'text/plain',body:''});
 });
 // Establish a valid fresh demo save so the real loaded game state can be compared.
 // No leaderboard or achievements are seeded, and the clock is not changed.
 const initialGame=createGame(Date.now(),12345);
 await context.addInitScript(({origin,key,game})=>{
  if(location.origin!==origin) return;
  if(localStorage.getItem(key)===null) localStorage.setItem(key,JSON.stringify(game));
  // Capture additions even if a duplicate is removed before a later locator check.
  window.__achievementAnnouncements=[];
  const selector='[data-testid="achievement-toast"]';
  const seen=new WeakMap();
  const walk=(node,visit)=>{
   if(node.nodeType!==Node.ELEMENT_NODE) return;
   if(node.matches(selector)) visit(node);
   for(const toast of node.querySelectorAll(selector)) visit(toast);
  };
  const record=toast=>{
   const id=toast.getAttribute('data-achievement-id');
   if(id && seen.get(toast)!==id) window.__achievementAnnouncements.push(id);
   if(id) seen.set(toast,id);
  };
  new MutationObserver(records=>{
   for(const mutation of records){
    if(mutation.type==='childList'){
     for(const node of mutation.removedNodes) walk(node,toast=>seen.delete(toast));
     for(const node of mutation.addedNodes) walk(node,record);
    }
    else if(mutation.target.matches(selector)) record(mutation.target);
   }
  }).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['data-achievement-id']});
 },{origin:ORIGIN,key:STORAGE_KEY,game:initialGame});
 return {context,unexpectedRequests};
}

async function savedAchievements(page){
 return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),ACHIEVEMENTS_KEY);
}
async function announcementIds(page){
 return page.evaluate(()=>window.__achievementAnnouncements.slice());
}
async function playDaily(page,previousChoices){
 await page.locator('[data-action="open-daily"]').first().click();
 const audio=page.locator('[data-action="toggle-daily-audio"]');
 if(!previousChoices){
  assert.equal(await audio.getAttribute('aria-pressed'),'true','daily sound is initially on');
  await audio.click();
 }
 assert.equal(await audio.getAttribute('aria-pressed'),'false','daily sound is muted');
 await page.locator('[data-action="start-daily"]').click();
 const mini=page.locator('[data-action="daily-mini-choose"]').first();
 const choices=[await mini.getAttribute('data-choice')];
 assert.ok(choices[0],'bonus lab offers a choice');
 if(previousChoices) assert.equal(choices[0],previousChoices[0],'replay uses the same bonus choice');
 await mini.click();
 for(let round=0;round<4;round++){
  const first=page.locator('[data-action="daily-choose"]').first();
  await first.waitFor({state:'visible'});
  const id=await first.getAttribute('data-choice');
  assert.ok(id,'daily round '+(round+1)+' offers a choice');
  if(previousChoices) assert.equal(id,previousChoices[round+1],'replay uses the same round '+(round+1)+' choice');
  choices.push(id);
  await first.click();
 }
 await page.locator('.daily-score strong').waitFor({state:'visible'});
 return choices;
}

async function assertDailyResult(page){
 assert.match(await page.locator('.daily-score').innerText(),/ENHANCED CHALLENGE SCORE/);
 assert.match(await page.locator('.daily-score-note').innerText(),/no G coins were added or removed/i);
 assert.equal(await page.locator('[data-action="toggle-daily-audio"]').getAttribute('aria-pressed'),'false',
  'sound remains muted on the result screen');
}

async function dismissQueue(page,expected,{checkAudio=true}={}){
 const toast=page.locator(TOAST);
 for(const id of expected){
  await page.waitForFunction(({selector,id})=>{
   const nodes=document.querySelectorAll(selector);
   return nodes.length===1 && nodes[0].getAttribute('data-achievement-id')===id;
  },{selector:TOAST,id},{timeout:3000});
  await toast.waitFor({state:'visible'});
  const details=await toast.evaluate(el=>({
   count:document.querySelectorAll('[data-testid="achievement-toast"]').length,
   id:el.getAttribute('data-achievement-id'),
   text:el.innerText,
   classes:el.className,
   reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,
   animation:getComputedStyle(el).animationName,
   audio:document.querySelector('[data-action="toggle-daily-audio"]')?.getAttribute('aria-pressed'),
   role:el.parentElement.getAttribute('role'),
   live:el.parentElement.getAttribute('aria-live'),
   atomic:el.parentElement.getAttribute('aria-atomic'),
   insideApp:Boolean(el.parentElement.closest('#app'))
  }));
  assert.equal(details.count,1,'only one achievement toast is displayed at a time');
  assert.equal(details.id,id);
  assert.ok(details.text.includes(titles.get(id)),'toast describes '+id);
  assert.ok(details.text.includes(rarities.get(id).toUpperCase()),'toast names its rarity');
  assert.ok(details.classes.split(' ').includes('rarity-'+rarities.get(id)),'toast uses the matching rarity color');
  assert.equal(details.reduced,true,'browser requests reduced motion');
  assert.equal(details.animation,'none','toast does not animate with reduced motion');
  if(checkAudio) assert.equal(details.audio,'false','achievement notifications do not unmute daily sound');
  assert.equal(details.role,'status');
  assert.equal(details.live,'polite');
  assert.equal(details.atomic,'true');
  assert.equal(details.insideApp,false,
   'achievement announcements use their own live region outside the game view');
  const close=toast.getByRole('button',{name:DISMISS,exact:true});
  assert.equal(await close.count(),1,'toast has an accessible dismiss button');
  await close.click(); // Advances immediately rather than waiting for the 4.2s timer.
 }
 await toast.waitFor({state:'detached',timeout:3000});
}

async function assertProfile(page,unlocked){
 await page.locator('[data-action="nav"][data-view="profile"]').first().click();
 const section=page.locator('.achievement-grid');
 await section.waitFor({state:'visible'});
 const actual=await section.locator('.achievement-card.is-unlocked strong').allTextContents();
 assert.deepEqual(actual.slice().sort(),unlocked.map(id=>titles.get(id)).sort(),
  'profile shows every persisted unlocked achievement');
}

async function exercise(engine,viewport){
 const browser=await engine.launch({headless:true});
 let context;
 try{
  const setup=await makeOfflineContext(browser,viewport);
  context=setup.context;
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push('pageerror: '+String(error)));
  page.on('console',message=>{if(message.type()==='error') errors.push('console: '+message.text());});
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.locator('[data-action="open-daily"]').first().waitFor();
  const initial=await page.evaluate(({gameKey,achievementKey,leaderboardKey})=>({
   game:JSON.parse(localStorage.getItem(gameKey)),
   achievements:localStorage.getItem(achievementKey),
   leaderboard:localStorage.getItem(leaderboardKey)
  }),{gameKey:STORAGE_KEY,achievementKey:ACHIEVEMENTS_KEY,leaderboardKey:LEADERBOARD_KEY});
  assert.equal(initial.achievements,null,'fresh context has no achievements');
  assert.equal(initial.leaderboard,null,'fresh context has no local scores');
  assert.equal(typeof initial.game.balance,'number');
  const wallet=await page.locator('.arcade-wallet').innerText();
  assert.match(wallet,/G/);

  const choices=await playDaily(page);
  const first=await savedAchievements(page); // Check persistence before any reload.
  assert.ok(first && Array.isArray(first.unlocked) && Array.isArray(first.history));
  assert.equal(first.history.length,1);
  assert.equal(first.history[0].rank,1,'first local score is top of its board');
  assert.ok(first.unlocked.includes('first-call'),'first completion unlocks first-call');
  assert.ok(first.unlocked.includes('top-of-board'),'first local score unlocks top-of-board');
  assert.equal(new Set(first.unlocked).size,first.unlocked.length,'stored IDs are distinct');
  assert.ok(first.unlocked.every(id=>titles.has(id)),'stored IDs belong to the achievement catalog');
  await dismissQueue(page,first.unlocked);
  await assertDailyResult(page);
  assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),STORAGE_KEY),initial.game,
   'daily challenge does not change the persisted game state or G balance');
  assert.equal(await page.locator('.arcade-wallet').innerText(),wallet,
   'daily result displays the unchanged in-memory G balance');
  assert.deepEqual(await announcementIds(page),first.unlocked,
   'each newly unlocked ID is announced exactly once in stored order');

  await page.locator('[data-action="nav"][data-view="home"]').first().click();
  await assertProfile(page,first.unlocked);
  assert.equal(await page.locator(TOAST).count(),0,'navigation does not reannounce achievements');
  assert.deepEqual(await announcementIds(page),first.unlocked);

  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('[data-action="open-daily"]').first().waitFor();
  assert.deepEqual(await savedAchievements(page),first,'unlocked achievements persist across reload');
  assert.equal(await page.locator(TOAST).count(),0,'reload does not replay notifications');
  assert.deepEqual(await announcementIds(page),[],'reload produces no transient announcements');
  assert.equal(await page.locator('.arcade-wallet').innerText(),wallet);
  await assertProfile(page,first.unlocked);
  assert.equal(await page.locator(TOAST).count(),0);
  assert.deepEqual(await announcementIds(page),[],'profile navigation does not reannounce achievements');
  await page.locator('[data-action="nav"][data-view="home"]').first().click();

  await playDaily(page,choices);
  const replay=await savedAchievements(page);
  assert.equal(replay.history.length,2,'replay completes a second daily run');
  assert.ok(first.unlocked.every(id=>replay.unlocked.includes(id)),'replay retains existing badges');
  const fresh=replay.unlocked.filter(id=>!first.unlocked.includes(id));
  assert.equal(new Set(replay.unlocked).size,replay.unlocked.length);
  await dismissQueue(page,fresh);
  await assertDailyResult(page);
  assert.deepEqual(await announcementIds(page),fresh,
   'replay only announces newly unlocked IDs, never earlier badges');
  assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),STORAGE_KEY),initial.game);
  assert.equal(await page.locator('.arcade-wallet').innerText(),wallet);
  assert.deepEqual(setup.unexpectedRequests,[],'no API or unexpected external requests');
  assert.deepEqual(errors,[],'no page or console errors');
 }finally{
  if(context) await context.close();
  await browser.close();
 }
}

test('daily achievements: Chromium shows and persists each new badge once',async()=>{
 await exercise(chromium,{width:393,height:873});
});
test('daily achievements: WebKit shows and persists each new badge once',async()=>{
 await exercise(webkit,{width:375,height:812});
});


test('unseen queued badges resume after a reload without replaying the visible badge',async()=>{
 const browser=await chromium.launch({headless:true});
 let context;
 try{
  const setup=await makeOfflineContext(browser,{width:393,height:873});
  context=setup.context;
  const page=await context.newPage();
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await playDaily(page);
  const saved=await savedAchievements(page);
  const first=await page.locator(TOAST).getAttribute('data-achievement-id');
  assert.equal(first,saved.unlocked[0]);
  const remaining=saved.unlocked.slice(1);
  assert.ok(remaining.length>=1,'a second badge is queued');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(({selector,id})=>document.querySelector(selector)?.getAttribute('data-achievement-id')===id,
   {selector:TOAST,id:remaining[0]});
  assert.deepEqual(await savedAchievements(page),saved,'reloading does not change saved achievements');
  await dismissQueue(page,remaining,{checkAudio:false});
  assert.deepEqual(await announcementIds(page),remaining,'only previously unseen badges are resumed');
  assert.deepEqual(setup.unexpectedRequests,[]);
 }finally{
  if(context) await context.close();
  await browser.close();
 }
});

test('failed achievement storage reports temporary progress without a saved-unlock toast',async()=>{
 const browser=await chromium.launch({headless:true});
 let context;
 try{
  const setup=await makeOfflineContext(browser,{width:393,height:873});
  context=setup.context;
  await context.addInitScript(key=>{
   const save=Storage.prototype.setItem;
   window.__failAchievementWrites=true;
   Storage.prototype.setItem=function(name,value){
    if(this===window.localStorage && name===key && window.__failAchievementWrites) throw new DOMException('Storage blocked','QuotaExceededError');
    return save.call(this,name,value);
   };
  },ACHIEVEMENTS_KEY);
  const page=await context.newPage();
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  const choices=await playDaily(page);
  assert.match(await page.locator('.toast[role="alert"]').innerText(),/achievements are temporary/i);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),ACHIEVEMENTS_KEY),null);
  assert.equal(await page.locator(TOAST).count(),0,'no permanent unlock is announced when saving fails');
  assert.deepEqual(await announcementIds(page),[]);
  await page.evaluate(()=>{window.__failAchievementWrites=false;});
  await page.locator('[data-action="nav"][data-view="home"]').first().click();
  await playDaily(page,choices);
  const saved=await savedAchievements(page);
  assert.ok(saved.unlocked.includes('first-call') && saved.unlocked.includes('top-of-board'));
  await dismissQueue(page,saved.unlocked);
  assert.deepEqual(await announcementIds(page),saved.unlocked,'deferred badges are announced once after saving succeeds');
  assert.deepEqual(setup.unexpectedRequests,[]);
 }finally{
  if(context) await context.close();
  await browser.close();
 }
});

test('keyboard focus pauses a toast and moves through the queue on dismissal',async()=>{
 const browser=await chromium.launch({headless:true});
 let context;
 try{
  const setup=await makeOfflineContext(browser,{width:393,height:873});
  context=setup.context;
  const page=await context.newPage();
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await playDaily(page);
  const saved=await savedAchievements(page);
  assert.ok(saved.unlocked.length>=2);
  const toast=page.locator(TOAST);
  assert.equal(await toast.getAttribute('data-achievement-id'),saved.unlocked[0]);
  const close=toast.getByRole('button',{name:DISMISS,exact:true});
  await close.focus();
  await page.waitForTimeout(4400);
  assert.equal(await toast.getAttribute('data-achievement-id'),saved.unlocked[0],
   'focused toast does not disappear after its ordinary timeout');
  await page.keyboard.press('Escape');
  await page.waitForFunction(({selector,id})=>document.querySelector(selector)?.getAttribute('data-achievement-id')===id,
   {selector:TOAST,id:saved.unlocked[1]});
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),DISMISS,
   'focus moves to the next dismiss control');
  await dismissQueue(page,saved.unlocked.slice(1));
  assert.equal(await page.evaluate(()=>document.querySelector('#app').contains(document.activeElement)),true,
   'focus returns to a game control after the last toast');
  assert.deepEqual(setup.unexpectedRequests,[]);
 }finally{
  if(context) await context.close();
  await browser.close();
 }
});

test('normal-motion mode uses the animated rarity-coded toast',async()=>{
 const browser=await chromium.launch({headless:true});
 let context;
 try{
  const setup=await makeOfflineContext(browser,{width:393,height:873},'no-preference');
  context=setup.context;
  const page=await context.newPage();
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await playDaily(page);
  const toast=page.locator(TOAST);
  const id=await toast.getAttribute('data-achievement-id');
  assert.ok((await toast.getAttribute('class')).split(' ').includes('rarity-'+rarities.get(id)));
  assert.match(await toast.innerText(),new RegExp(rarities.get(id),'i'));
  assert.equal(await toast.evaluate(el=>getComputedStyle(el).animationName),'achievement-toast-enter');
  assert.deepEqual(setup.unexpectedRequests,[]);
 }finally{
  if(context) await context.close();
  await browser.close();
 }
});


test('active notifications pause while hidden and defer during Story Mode',async()=>{
 const browser=await chromium.launch({headless:true});
 let context;
 try{
  const setup=await makeOfflineContext(browser,{width:393,height:873});
  context=setup.context;
  const page=await context.newPage();
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await playDaily(page);
  const toast=page.locator(TOAST);
  const id=await toast.getAttribute('data-achievement-id');
  await page.evaluate(()=>{
   Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});
   document.dispatchEvent(new Event('visibilitychange'));
  });
  assert.equal(await page.locator('[data-achievement-notifications]').evaluate(el=>el.hidden),true);
  await page.waitForTimeout(4400);
  assert.equal(await toast.getAttribute('data-achievement-id'),id,'hidden tab cannot advance the queue');
  await page.evaluate(()=>{
   delete document.visibilityState;
   document.dispatchEvent(new Event('visibilitychange'));
  });
  await toast.waitFor({state:'visible'});
  assert.equal(await toast.getAttribute('data-achievement-id'),id);
  await page.getByRole('button',{name:'Back to the floor'}).click();
  await page.locator('[data-action="open-case"][data-case="streaming-pivot"]').first().click();
  await page.locator('.story-stage').waitFor({state:'visible'});
  assert.equal(await page.locator('[data-achievement-notifications]').evaluate(el=>el.hidden),true,
   'toast host does not cover the Story Mode HUD');
  await page.locator('[data-action="story-exit"]').click();
  await toast.waitFor({state:'visible'});
  assert.equal(await toast.getAttribute('data-achievement-id'),id,'same badge resumes after leaving Story Mode');
  assert.deepEqual(setup.unexpectedRequests,[]);
 }finally{
  if(context) await context.close();
  await browser.close();
 }
});
