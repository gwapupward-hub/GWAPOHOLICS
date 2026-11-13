import test from 'node:test';
import assert from 'node:assert/strict';
import { CASES } from '../cases.mjs';
import { hasStoryMode, sceneDirection, narrativeScene, storyAssetExt } from '../story-runtime.mjs';
import { storyStage } from '../cinematic-view.mjs';
import { brandProps, BRAND_PROP_KEYS } from '../brand-props.mjs';

test('brand backlog is a second real Story Mode quest; the other three are not enabled prematurely',()=>{
 assert.equal(hasStoryMode('streaming-pivot'),true);
 assert.equal(hasStoryMode('brand-backlash'),true);
 assert.equal(CASES.find(x=>x.id==='brand-backlash').stages.length,4);
 for(const id of ['supply-shock','founder-runway','inflation-trap'])assert.equal(hasStoryMode(id),false);
});
test('all nine Brand Backlash scene assets and prop sets are declared',()=>{
 assert.equal(BRAND_PROP_KEYS.length,9);
 for(const key of BRAND_PROP_KEYS){
  const opts=key.startsWith('result-')?{band:key.substring(7)}:key.startsWith('decision-')?{round:Number(key.substring(9))-1}:{};
  const phase=key.startsWith('result-')?'result':key.startsWith('decision-')?'decision':'intro';
  const direction=sceneDirection('brand-backlash',phase,opts);
  assert.ok(direction?.base.endsWith('/'+key),key);
  assert.equal(direction.caseId,'brand-backlash');
  assert.ok(brandProps(key).includes('stage-prop'),key);
  const text=narrativeScene('brand-backlash',phase,opts);
  assert.ok(text?.image.endsWith(key+'.jpg'),key);
 }
});
test('Brand scene uses existing full-screen component without requesting missing WebP',()=>{
 const dir=sceneDirection('brand-backlash','intro');
 const html=storyStage({
  phase:'intro',direction:dir,previous:null,speaker:'gwap-o',
  emotion:'talking',lines:['Your loyal customers are watching'],panel:'<button>GO</button>',
  label:'Brand Backlash',ribbon:'Brand Backlash',
  progress:{label:'Intro',total:4,done:0,current:-1},balance:1000
 });
 assert.match(html,/class="story-stage phase-intro/);
 assert.match(html,/assets\/scenes\/brand-backlash\/intro.jpg/);
 assert.doesNotMatch(html,/assets\/scenes\/brand-backlash\/intro.webp/);
 assert.match(html,/class="stage-layer stage-props"/);
 assert.equal(storyAssetExt(dir.base),'jpg');
});
