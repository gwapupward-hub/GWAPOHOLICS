// Fails fast (seconds, not minutes) when the browser CI environment is not what the tests expect:
//  - the installed Playwright package must equal the version the pinned container image was built for,
//  - every requested engine (BROWSER_ENGINES, default chromium,webkit) must actually launch.
// Prints the versions it found (and appends them to the GitHub step summary) so every CI run records its environment.
import {appendFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {release} from 'node:os';
import {chromium,webkit} from 'playwright';

const require=createRequire(import.meta.url);
const known={chromium,webkit};
const expected=process.env.PLAYWRIGHT_VERSION||'';
const engines=(process.env.BROWSER_ENGINES||'chromium,webkit').split(',').map(s=>s.trim()).filter(Boolean);
const rows=[];
let failed=false;
const fail=(message)=>{failed=true;console.error('::error::'+message);};

const pkg=require('playwright/package.json').version;
rows.push(['playwright (npm package)',pkg]);
rows.push(['node',process.versions.node]);
rows.push(['kernel',release()]);
rows.push(['PLAYWRIGHT_BROWSERS_PATH',process.env.PLAYWRIGHT_BROWSERS_PATH||'(default)']);
if(expected&&pkg!==expected)fail(`Playwright package ${pkg} does not match the container image version ${expected}. Update the image tag/digest and PLAYWRIGHT_VERSION together.`);
if(Number(process.versions.node.split('.')[0])<22)fail(`Node ${process.versions.node} is older than the required 22.`);

for(const name of engines){
 if(!Object.hasOwn(known,name)){fail(`Unknown engine "${name}"`);continue;}
 try{
  const browser=await known[name].launch({headless:true});
  const page=await (await browser.newContext()).newPage();
  await page.setContent('<main><p>ok</p></main>');
  const text=await page.locator('p').innerText();
  rows.push([`${name} (launches and renders)`,`${browser.version()}${text==='ok'?'':' — RENDER CHECK FAILED'}`]);
  if(text!=='ok')fail(`${name} launched but did not render a trivial page`);
  await browser.close();
 }catch(error){
  rows.push([`${name}`,'FAILED TO LAUNCH']);
  fail(`${name} failed to launch: ${String(error.message).split('\n')[0]}`);
 }
}
const table=rows.map(([k,v])=>`| ${k} | ${v} |`).join('\n');
console.log(rows.map(([k,v])=>`${k}: ${v}`).join('\n'));
if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,`### Browser environment\n\n| item | value |\n| --- | --- |\n${table}\n\n`);
process.exit(failed?1:0);
