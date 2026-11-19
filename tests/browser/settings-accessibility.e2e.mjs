import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {createGame} from '../../game-core.mjs';
import {publicGameView} from '../../server/game-service.mjs';

const BASE='http://127.0.0.1:4173/';
const ENGINES=[['Chromium',chromium],['WebKit',webkit]];

for (const [name,engine] of ENGINES) {
  test(name+' settings: keyboard toggles, persistence, legal navigation, compact layout', async()=>{
    const browser=await engine.launch({headless:true});
    try{
      const context=await browser.newContext({viewport:{width:320,height:640},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
      const page=await context.newPage();
      const errors=[];page.on('pageerror',e=>errors.push(String(e)));
      await page.goto(BASE+'?demo=1',{waitUntil:'domcontentloaded'});
      await page.locator('[data-action="nav"][data-view="settings"]').first().click();
      assert.equal(await page.getByRole('heading',{name:/settings/i}).count(),1);
      const music=page.getByRole('checkbox',{name:'Background music'});
      await music.waitFor();
      assert.equal(await music.isChecked(),true);
      await music.focus(); await page.keyboard.press('Space');
      assert.equal(await music.isChecked(),false);
      const haptics=page.getByRole('checkbox',{name:'Haptic feedback'});
      await haptics.click(); assert.equal(await haptics.isChecked(),false);
      const notices=page.getByRole('checkbox',{name:'In-game notifications'});
      await notices.click(); assert.equal(await notices.isChecked(),false);
      assert.equal(await page.getByRole('slider',{name:'Music volume'}).count(),1);
      assert.equal(await page.getByRole('slider',{name:'Effects volume'}).count(),1);
      assert.equal(await page.locator('[data-action="settings-logout"]').count(),0,'demo has no logout');
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
      assert.equal(overflow,false,'settings should not overflow 320px viewport');
      await page.reload({waitUntil:'domcontentloaded'});
      await page.locator('[data-action="nav"][data-view="settings"]').first().click();
      assert.equal(await page.getByRole('checkbox',{name:'Background music'}).isChecked(),false);
      assert.equal(await page.getByRole('checkbox',{name:'Haptic feedback'}).isChecked(),false);
      assert.equal(await page.getByRole('checkbox',{name:'In-game notifications'}).isChecked(),false);
      await page.getByRole('button',{name:/privacy settings/i}).click();
      assert.equal(await page.getByRole('heading',{level:1,name:/^privacy/i}).count(),1);
      await page.getByRole('checkbox',{name:'Hide header balance'}).check();
      await page.getByRole('button',{name:/back to settings/i}).click();
      await page.getByRole('button',{name:/terms & conditions/i}).click();
      assert.equal(await page.getByRole('heading',{level:1,name:/^terms/i}).count(),1);
      assert.match(await page.locator('.settings-copy').innerText(),/not a finalized or legally reviewed/i);
      assert.equal(errors.length,0,errors.join('\n'));
      await context.close();
    }finally{await browser.close();}
  });

  test(name+' authenticated signout: Escape restores focus, cancel is safe, re-login preserves server balance',async()=>{
    const browser=await engine.launch({headless:true});
    try {
      const game=createGame(1800000000000,12345);
      let logoutCalls=0,sessionCalls=0;
      const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
      await context.addInitScript(()=>{
        window.Telegram={WebApp:{
          initData:'signed-test-session',
          initDataUnsafe:{user:{first_name:'Test'}},
          ready(){},expand(){},setHeaderColor(){},setBackgroundColor(){},onEvent(){},
          BackButton:{onClick(){},show(){},hide(){}},
          HapticFeedback:{impactOccurred(){},notificationOccurred(){}}
        }};
      });
      await context.route('https://telegram.org/js/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:'/* mocked Telegram */'}));
      await context.route('**/api/session',async r=>{
        sessionCalls++;
        await r.fulfill({status:200,contentType:'application/json',body:'{"authenticated":true}'});
      });
      await context.route('**/api/game',async r=>{
        await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({state:publicGameView(game,1800000000000)})});
      });
      await context.route('**/api/logout',async r=>{
        logoutCalls++;
        assert.equal(r.request().method(),'POST');
        await r.fulfill({status:200,contentType:'application/json',body:'{"authenticated":false}'});
      });
      const page=await context.newPage();
      const errors=[];page.on('pageerror',e=>errors.push(String(e)));
      await page.goto(BASE,{waitUntil:'domcontentloaded'});
      await page.locator('.prototype-tag').filter({hasText:'VERIFIED TELEGRAM PLAYER'}).waitFor();
      await page.locator('[data-action="nav"][data-view="settings"]').first().click();
      const opener=page.locator('[data-action="settings-logout"]');
      await opener.click();
      const dialog=page.locator('#game-logout-dialog');
      assert.equal(await dialog.evaluate(el=>el.open),true);
      await page.keyboard.press('Escape');
      assert.equal(await dialog.evaluate(el=>el.open),false);
      assert.equal(await opener.evaluate(el=>el===document.activeElement),true,'Escape restores opener focus');
      assert.equal(logoutCalls,0);
      await opener.click();
      await page.locator('[data-action="settings-logout-cancel"]').click();
      assert.equal(logoutCalls,0,'Cancel does not clear signed session');
      await opener.click();
      await page.locator('[data-action="settings-logout-confirm"]').click();
      assert.equal(logoutCalls,1);
      await page.getByRole('heading',{name:/session ended/i}).waitFor();
      await page.reload({waitUntil:'domcontentloaded'});
      await page.getByRole('heading',{name:/session ended/i}).waitFor();
      assert.equal(sessionCalls,1,'manual logout does not silently re-authenticate');
      await page.getByRole('button',{name:/sign in with telegram/i}).click();
      await page.locator('.prototype-tag').filter({hasText:'VERIFIED TELEGRAM PLAYER'}).waitFor();
      assert.equal(sessionCalls,2);
      assert.equal(await page.evaluate(()=>localStorage.getItem('gwapoholics.manual-signout.v1')),null);
      assert.equal(errors.length,0,errors.join('\n'));
      await context.close();
    } finally { await browser.close(); }
  });
}
