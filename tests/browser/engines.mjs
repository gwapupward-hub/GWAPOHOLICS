// Browser engines used by the end-to-end suite. CI runs BOTH Chromium and WebKit (iPhone class).
// Locally, restrict with e.g. BROWSER_ENGINES=chromium when WebKit is not installed.
// A requested engine that cannot launch FAILS the run; it is never skipped silently.
import {chromium,webkit} from 'playwright';

const known={chromium,webkit};
export const ENGINE_NAMES=(process.env.BROWSER_ENGINES||'chromium,webkit').split(',').map(s=>s.trim()).filter(Boolean);
for(const name of ENGINE_NAMES){
 if(!Object.hasOwn(known,name))throw new Error(`Unknown BROWSER_ENGINES entry "${name}" (expected chromium and/or webkit)`);
}
export const ENGINES=ENGINE_NAMES.map(name=>({name,type:known[name]}));
export const launch=(engine)=>engine.type.launch({headless:true});
