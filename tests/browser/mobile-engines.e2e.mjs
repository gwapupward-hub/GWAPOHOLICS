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

test('iPhone fullscreen Telegram sign-in screen clears native top controls',async()=>{
 const browser=await webkit.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,deviceScaleFactor:2,reducedMotion:'reduce'});
  await ctx.addInitScript(()=>{
    window.Telegram={WebApp:{
      initData:'mock-initdata-from-test-bot',isFullscreen:true,isExpanded:true,
      safeAreaInset:{top:59,bottom:34,left:0,right:0},
      contentSafeAreaInset:{top:56,bottom:0,left:0,right:0},
      viewportStableHeight:852,viewportHeight:852,
      ready(){},expand(){},setHeaderColor(){},setBackgroundColor(){},onEvent(){},
      BackButton:{onClick(){},show(){},hide(){}},
      HapticFeedback:{impactOccurred(){},notificationOccurred(){}}
    }};
  });
  await ctx.route('https://telegram.org/js/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:'/* mocked Telegram */'}));
  await ctx.route('**/api/session',route=>route.fulfill({status:401,contentType:'application/json',body:'{"error":"invalid_telegram_launch"}'}));
  const page=await ctx.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  const url=new URL(BASE);url.searchParams.delete('demo');
  await page.goto(url.href,{waitUntil:'domcontentloaded'});
  await page.locator('.arcade-title').waitFor();
  await page.waitForFunction(()=>document.querySelector('.arcade-hook')?.textContent?.includes('Telegram verification failed'));
  const box=await page.locator('.arcade-title').boundingBox();
  assert.ok(box && box.y>=125,'sign-in heading must be below fullscreen Telegram controls, got '+box?.y);
  assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('telegram-fullscreen')),true);
  const bottom=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--gwap-telegram-bottom').trim());
  assert.equal(bottom,'34px');
  assert.equal(errors.length,0,errors.join('\n'));
  await ctx.close();
 }finally{await browser.close();}
});
