#!/usr/bin/env node
/**
 * GitHub Actions incident ticket for the *Preview* endpoint probe.
 * Opens one issue per failure episode, and closes it on recovery.
 * Requires issues:write; never logs the GitHub token.
 */
const token=process.env.GITHUB_TOKEN;
const repository=process.env.GITHUB_REPOSITORY;
const state=process.env.MONITOR_STATE;
const runId=process.env.GITHUB_RUN_ID;
if(!token||!repository||!/^[-.\w]+\/[-.\w]+$/.test(repository)||
   !['success','failure'].includes(state)||!/^\d+$/.test(runId||'')) {
  console.error('Preview incident sync missing or invalid environment');
  process.exitCode=1;
}else{
  const title='[GWAPOHOLICS Preview] Endpoint monitor failing';
  const url='https://github.com/'+repository+'/actions/runs/'+runId;
  const headers={'Accept':'application/vnd.github+json',
    'Authorization':'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28'};
  const base='https://api.github.com/repos/'+repository;
  async function request(path,method='GET',data){
    const res=await fetch(base+path,{method,headers:{...headers,...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
    if(!res.ok)throw new Error('GitHub issues API HTTP '+res.status);
    return res.json();
  }
  try{
    // This private-beta repository has far fewer than 100 concurrent open issues.
    const issues=await request('/issues?state=open&per_page=100');
    const current=issues.find(issue=>!issue.pull_request&&issue.title===title);
    if(state==='failure'&&!current){
      await request('/issues','POST',{
        title,
        body:'The scheduled credential-free Preview endpoint monitor failed twice.\n\nRun: '+url+'\n\nCheck Preview routing, HTTP 401 on unauthenticated `GET /api/game`, HTTP 400 on invalid `POST /api/session`, and Vercel runtime logs. This probe does NOT validate authenticated Telegram sessions, PostgreSQL transactions, or production. Do not paste secrets into this issue.'
      });
      console.log('Opened Preview monitoring issue');
    }else if(state==='failure'){
      console.log('Preview incident issue already open; no duplicate created');
    }else if(current){
      await request('/issues/'+current.number+'/comments','POST',{body:'Credential-free Preview endpoints recovered. Passing run: '+url+'\nAuthenticated gameplay and database readiness remain separate checks.'});
      await request('/issues/'+current.number,'PATCH',{state:'closed'});
      console.log('Closed Preview monitoring issue after recovery');
    }else{
      console.log('Preview endpoints healthy; no open incident');
    }
  }catch(e){
    console.error('Preview incident ticket update failed:',e.message);
    process.exitCode=1;
  }
}
