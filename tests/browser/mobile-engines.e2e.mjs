import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
const BASE=process.env.GWAPOHOLICS_E2E_URL||'http://127.0.0.1:4173/?demo=1';

async function firstDecision(engine,opts){
 const browser=await engine.launch({headless:true});
 try{
  const ctx=await browser.newContext({
    viewport:opts.viewport,isMobile:true,hasTouch:true,deviceScaleFactor:2,
    reducedMotion:'reduce'
  });
  const page=await ctx.newPage();
  const pageErrors=[];
  page.on('pageerror',e=>pageErrors.push(String(e)));
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.locator('[data-action="open-case"][data-case="streaming-pivot"]').first().tap();
  const scene=page.locator('.story-stage.phase-intro');
  await scene.waitFor();
  const size=await scene.boundingBox();
  assert.ok(size?.width>=opts.viewport.width-2,'full viewport width');
  assert.ok(size?.height>=opts.viewport.height-50,'full viewport height');
  await page.locator('[data-action="decide"]').tap();
  await page.locator('.story-stage.phase-decision').waitFor();
  const controls=page.locator('.stage-panel [data-action="choose"]');
  assert.equal(await controls.count(),3);
  await controls.first().scrollIntoViewIfNeeded();
  await controls.first().tap();
  await page.locator('.story-stage.phase-consequence').waitFor();
  assert.equal(pageErrors.length,0,pageErrors.join('\n'));
  await ctx.close();
 }finally{await browser.close()}
}
test('Android-sized Chromium touch flow: cinema, readable choices, reaction',async()=>{
 await firstDecision(chromium,{viewport:{width:393,height:873}});
});
test('iPhone-sized WebKit touch flow: cinema, safe controls, reaction',async()=>{
 await firstDecision(webkit,{viewport:{width:375,height:812}});
});
