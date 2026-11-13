import test from 'node:test';
import assert from 'node:assert/strict';
import { propsForScene, storyProps, PIVOT_PROP_KEYS } from '../story-props.mjs';
import { storyStage } from '../cinematic-view.mjs';
import { sceneDirection } from '../story-runtime.mjs';

test('all nine Streaming Pivot illustrated beats have independent prop cues', () => {
  assert.equal(PIVOT_PROP_KEYS.length,9);
  for (const key of PIVOT_PROP_KEYS) {
    const props=propsForScene(key);
    assert.ok(props.length>=3,key);
    assert.equal(new Set(props.map(p=>p.order)).size,props.length);
    const markup=storyProps(key);
    assert.match(markup,/class="stage-layer stage-props" aria-hidden="true"/);
    assert.equal((markup.match(/class="stage-prop"/g)||[]).length,props.length);
    assert.equal((markup.match(/<svg /g)||[]).length,props.length);
    assert.doesNotMatch(markup, /<script|<foreignObject|onload=|<text/i);
  }
});
test('unknown scenes do not get generic or misleading props',()=>{
  assert.deepEqual(propsForScene('brand-backlash'),[]);
  assert.equal(storyProps('not-a-scene'),'');
});
test('the full-screen stage mounts independent decorative overlays',()=>{
  const direction=sceneDirection('streaming-pivot','decision',{round:2});
  const markup=storyStage({
    phase:'decision', direction, previous:null, speaker:'advisor',
    emotion:'talking', lines:['Choose wisely'], panel:'<button>Test</button>',
    label:'Decision', ribbon:'ROUND 3',
    progress:{label:'Round 3',total:4,done:2,current:2},balance:1000
  });
  assert.match(markup,/class="stage-layer stage-props" aria-hidden="true"/);
  assert.match(markup,/data-prop="crate"/);
  assert.match(markup,/class="stage-layer stage-shade"/);
});
