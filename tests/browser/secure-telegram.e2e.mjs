import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createGame,startCase,chooseStep,completeChain} from '../../game-core.mjs';
import {publicGameView} from '../../server/game-service.mjs';

const BASE='http://127.0.0.1:4173/';
const ID='streaming-pivot';
const NOW=1800000000000;
function mockTelegram(){
 window.Telegram={WebApp:{
  initData:'test-signed-launch-validated-by-mocked-server',
  initDataUnsafe:{user:{first_name:'Test'}},
  ready(){},expand(){},setHeaderColor(){},setBackgroundColor(){},onEvent(){},
  BackButton:{onClick(){},show(){},hide(){}},
  HapticFeedback:{impactOccurred(){},notificationOccurred(){}}
 }};
}
test('authenticated player uses server authority for all four moves and resumes without local coin storage',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  let game=createGame(NOW,12345),writes=[],sessionCalls=0;
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await context.addInitScript(mockTelegram);
  await context.route('**/api/session',async route=>{
   sessionCalls++;
   assert.equal(route.request().method(),'POST');
   assert.equal(JSON.parse(route.request().postData()).initData,'test-signed-launch-validated-by-mocked-server');
   await route.fulfill({status:200,contentType:'application/json',body:'{"authenticated":true}'});
  });
  await context.route('**/api/game',async route=>{
   const req=route.request();
   if(req.method()==='POST'){
    const body=JSON.parse(req.postData());
    assert.equal('balance' in body,false);
    assert.equal('seed' in body,false);
    assert.equal('delta' in body,false);
    writes.push(body);
    if(body.command==='start')game=startCase(game,body.caseId);
    else if(body.command==='choose'){
      game=chooseStep(game,body.caseId,body.choiceId);
      if(game.draft.path.length===4)game=completeChain(game,body.caseId,NOW+4000);
    } else throw Error('Unexpected command '+body.command);
   }
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({state:publicGameView(game,NOW)})});
  });
  const page=await context.newPage();
  await page.route('https://telegram.org/js/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:'/* Telegram WebApp mocked by addInitScript */'}));
  const pageErrors=[];page.on('pageerror',err=>pageErrors.push(String(err)));
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.locator('[data-action="open-case"][data-case="'+ID+'"]').first().waitFor();
  assert.equal(sessionCalls,1,'test must use signed Telegram server mode instead of browser-local demo');
  assert.match(await page.locator('.prototype-tag').innerText(),/VERIFIED TELEGRAM PLAYER/);
  await page.locator('[data-action="open-case"][data-case="'+ID+'"]').first().click();
  await page.locator('[data-action="decide"]').click();
  for(let i=0;i<4;i++){
   await page.locator('.story-stage.phase-decision').waitFor();
   await page.locator('.stage-panel [data-action="choose"]').first().click();
   if(i<3){
    await page.locator('.story-stage.phase-consequence').waitFor();
    await page.locator('[data-action="next-step"]').click();
   }
  }
  await page.locator('.story-stage.phase-result').waitFor();
  assert.equal(game.played.length,1);
  assert.equal(game.ledger.filter(x=>x.type==='case').length,1);
  assert.equal(writes.filter(x=>x.command==='choose').length,4);
  assert.equal(writes.filter(x=>x.command==='start').length,1);
  assert.equal(pageErrors.length,0,pageErrors.join('\n'));
  const storage=await page.evaluate(()=>localStorage.getItem('gwap.telegram.business-sim.demo.v1'));
  assert.equal(storage,null);
  const balance=game.balance;
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('[data-action="open-case"]').first().waitFor();
  assert.equal(game.balance,balance);
  assert.ok(sessionCalls>=2);
  assert.equal(pageErrors.length,0,pageErrors.join('\n'));
  await context.close();
 }finally{await browser.close()}
});
