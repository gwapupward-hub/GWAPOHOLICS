import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {CASES} from '../cases.mjs';
import {STORY_RESULT_BANDS,hasStoryMode,sceneDirection,storyAssetExt} from '../story-runtime.mjs';
import {seasonProps,SEASON_PROP_CASE_IDS,SEASON_PROP_SCENES} from '../season-props.mjs';
import {storyStage} from '../cinematic-view.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const paths=[['intro',{}],...[0,1,2,3].map(round=>['decision',{round}]),...STORY_RESULT_BANDS.map(band=>['result',{band}])];
test('all 45 Season 1 illustrated scene slots exist as durable artwork',()=>{
 assert.equal(CASES.length,5);
 for(const quest of CASES){
  assert.equal(hasStoryMode(quest.id),true,quest.id);
  for(const [phase,opts] of paths){
   const d=sceneDirection(quest.id,phase,opts);
   assert.ok(d,quest.id+':'+phase);
   assert.ok(existsSync(root+d.base.substring(1)+'.jpg'),d.base+'.jpg');
   if(quest.id==='streaming-pivot')assert.ok(existsSync(root+d.base.substring(1)+'.webp'),d.base+'.webp');
   assert.equal(storyAssetExt(d.base),quest.id==='streaming-pivot'?'webp':'jpg');
  }
 }
});
test('all three new quests have scene-specific props without mixing brands',()=>{
 assert.deepEqual([...SEASON_PROP_CASE_IDS].sort(),['founder-runway','inflation-trap','supply-shock']);
 assert.equal(SEASON_PROP_SCENES.length,9);
 for(const id of SEASON_PROP_CASE_IDS)for(const key of SEASON_PROP_SCENES){
  const markup=seasonProps(id,key);
  assert.equal((markup.match(/class="stage-prop"/g)||[]).length,3);
  assert.doesNotMatch(markup,/<script|onload=/);
 }
 assert.equal(seasonProps('brand-backlash','intro'),'');
});
test('new episodes render a real full-screen scene without missing WebP requests',()=>{
 const d=sceneDirection('supply-shock','decision',{round:0});
 const html=storyStage({direction:d,phase:'decision',previous:null,speaker:'advisor',emotion:'talking',
  label:'Supply Shock',ribbon:'MISSION 3',lines:['Supply lines are blocked'],panel:'<button>Choose</button>',
  progress:{label:'1 of 4',total:4,done:0,current:0},balance:1000});
 assert.match(html,/assets\/scenes\/supply-shock\/decision-01\.jpg/);
 assert.doesNotMatch(html,/assets\/scenes\/supply-shock\/decision-01\.webp/);
 assert.match(html,/class="stage-layer stage-props"/);
});
