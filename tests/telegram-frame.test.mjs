import test from 'node:test';
import assert from 'node:assert/strict';
import { readTelegramFrame, syncTelegramFrame } from '../telegram-frame.mjs';

test('ordinary browser and non-fullscreen Telegram preserve original app placement',()=>{
 assert.deepEqual(readTelegramFrame(null),{isFullscreen:false,top:0,bottom:0});
 assert.deepEqual(readTelegramFrame({isFullscreen:false,safeAreaInset:{top:59},contentSafeAreaInset:{top:65}}),{isFullscreen:false,top:0,bottom:0});
});
test('fullscreen iPhone clears Telegram status bar and native menu overlay',()=>{
 const frame=readTelegramFrame({isFullscreen:true,safeAreaInset:{top:59,bottom:34},contentSafeAreaInset:{top:56,bottom:0}});
 assert.equal(frame.isFullscreen,true);
 assert.equal(frame.top,125);
 assert.equal(frame.bottom,34);
});
test('fullscreen fallback provides usable top clearance when older Telegram SDK returns zero',()=>{
 const frame=readTelegramFrame({isFullscreen:true,safeAreaInset:{top:0},contentSafeAreaInset:{top:0}});
 assert.equal(frame.top,116);
});
test('large content inset detects fullscreen even when older clients lack isFullscreen',()=>{
 const frame=readTelegramFrame({isExpanded:true,contentSafeAreaInset:{top:90},safeAreaInset:{top:30}});
 assert.equal(frame.isFullscreen,true);
 assert.equal(frame.top,130);
});
test('invalid inset values are rejected and cannot break CSS layout',()=>{
 const frame=readTelegramFrame({isFullscreen:true,safeAreaInset:{top:'oops',bottom:-100},contentSafeAreaInset:{top:Infinity,bottom:NaN}});
 assert.deepEqual(frame,{isFullscreen:true,top:116,bottom:0});
});
test('fullscreen CSS class and custom properties update on Telegram lifecycle events',()=>{
 const classes=new Set(),vars=new Map();
 const doc={documentElement:{
  classList:{toggle(name,on){if(on) classes.add(name);else classes.delete(name);}},
  style:{setProperty(k,v){vars.set(k,v);}}
 }};
 syncTelegramFrame({isFullscreen:true,safeAreaInset:{top:59,bottom:34},contentSafeAreaInset:{top:56}},doc);
 assert.ok(classes.has('telegram-fullscreen'));
 assert.equal(vars.get('--gwap-telegram-top'),'125px');
 assert.equal(vars.get('--gwap-telegram-bottom'),'34px');
 syncTelegramFrame({isFullscreen:false},doc);
 assert.ok(!classes.has('telegram-fullscreen'));
 assert.equal(vars.get('--gwap-telegram-top'),'0px');
});
