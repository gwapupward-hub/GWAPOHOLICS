import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const BASE=process.env.GWAPOHOLICS_E2E_URL||'http://127.0.0.1:4173/?demo=1';
const QUESTS=['streaming-pivot','brand-backlash','supply-shock','founder-runway','inflation-trap'];

async function openScenario(page,id){
 const all=page.locator('[data-action="open-case"][data-case="'+id+'"]');
 assert.ok(await all.count(),'missing quest entry '+id);
 await all.first().click();
 await page.locator('.story-stage.phase-intro').waitFor();
 await page.locator('[data-action="decide"]').click();
 await page.locator('.story-stage.phase-decision').waitFor();
}
async function finishQuest(page,id){
 for(let round=0;round<4;round++){
  await page.locator('.story-stage.phase-decision').waitFor();
  const choices=page.locator('.stage-panel [data-action="choose"]');
  assert.equal(await choices.count(),3,id+' round '+round);
  await choices.first().click();
  if(round<3){
   await page.locator('.story-stage.phase-consequence').waitFor();
   await page.locator('[data-action="next-step"]').click();
  }
 }
 await page.locator('.story-stage.phase-result').waitFor();
 assert.ok(await page.locator('.stage-score').count(),id+' result score');
 const source=page.locator('.stage-art');
 const loaded=await source.evaluate(el=>el.complete&&el.naturalWidth>0);
 assert.ok(loaded,id+' result art should load');
}
test('all five cinematic quests play to real endings and cannot farm replay rewards',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const page=await context.newPage();
  page.on('pageerror',err=>{throw err;});
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  for(const id of QUESTS){
   await openScenario(page,id);
   const stage=page.locator('.story-stage');
   const bounds=await stage.boundingBox();
   assert.ok(bounds?.width>=389&&bounds?.height>=800,'full-screen bounds '+id);
   await finishQuest(page,id);
  }
  const balance=await page.evaluate(()=>JSON.parse(localStorage.getItem('gwap.telegram.business-sim.demo.v1')).balance);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('gwap.telegram.business-sim.demo.v1')).played);
  assert.equal(saved.length,5);
  await page.reload({waitUntil:'domcontentloaded'});
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('gwap.telegram.business-sim.demo.v1')).played.length),5);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('gwap.telegram.business-sim.demo.v1')).balance),balance);
  await page.locator('[data-action="nav"][data-view="cases"]').last().click();
  const finished=page.locator('[data-action="view-run"]');
  assert.equal(await finished.count(),5);
  await context.close();
 }finally{await browser.close();}
});
test('small phone preserves bottom control reachability and reduced-motion narration',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:360,height:700},reducedMotion:'reduce'});
  const page=await context.newPage();
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await openScenario(page,'streaming-pivot');
  const stage=page.locator('.story-stage');
  assert.ok(await stage.isVisible());
  assert.equal(await stage.getAttribute('data-step'),'choices');
  const first=page.locator('.stage-panel [data-action="choose"]').first();
  await first.scrollIntoViewIfNeeded();
  assert.ok(await first.isVisible());
  await first.click();
  await page.locator('.story-stage.phase-consequence').waitFor();
  await context.close();
 }finally{await browser.close();}
});
