/**
 * Preview-only GitHub incident lifecycle.
 * Uses the GitHub Actions ephemeral token; never logs it or request headers.
 * Invoke through sync-preview-monitor-issue.mjs after the HTTP probes finish.
 */
export const PREVIEW_INCIDENT_TITLE='[GWAPOHOLICS Preview] Endpoint monitor failing';
export const PREVIEW_INCIDENT_DRILL_TITLE='[GWAPOHOLICS Preview] DRILL: issue notification lifecycle';

export async function syncPreviewIncident({
  state,repository,runId,token,assignee,title=PREVIEW_INCIDENT_TITLE,fetchImpl=fetch
}={}){
  if(!['success','failure'].includes(state)||
      ![PREVIEW_INCIDENT_TITLE,PREVIEW_INCIDENT_DRILL_TITLE].includes(title)||
      typeof repository!=='string'|| !/^[\w.-]+\/[\w.-]+$/.test(repository)||
      !/^\d+$/.test(String(runId??''))||
      typeof token!=='string'||!token||
      typeof assignee!=='string'|| !/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(assignee)){
    throw new Error('Invalid Preview incident configuration');
  }
  const base='https://api.github.com/repos/'+repository;
  const run='https://github.com/'+repository+'/actions/runs/'+runId;
  const headers={
    'Accept':'application/vnd.github+json',
    'Authorization':'Bearer '+token,
    'X-GitHub-Api-Version':'2022-11-28'
  };
  async function request(path,method='GET',payload){
    const hasBody=payload!==undefined;
    const response=await fetchImpl(base+path,{
      method,headers:{...headers,...(hasBody?{'Content-Type':'application/json'}:{})},
      body:hasBody?JSON.stringify(payload):undefined
    });
    if(!response.ok)throw new Error('GitHub issues API HTTP '+response.status);
    return response.json();
  }
  const issues=await request('/issues?state=open&per_page=100');
  if(!Array.isArray(issues))throw new Error('Invalid GitHub issues response');
  const current=issues.find(issue=>!issue.pull_request&&issue.title===title);
  if(state==='failure'){
    if(!current){
      const created=await request('/issues','POST',{
        title,assignees:[assignee],
        body:(title===PREVIEW_INCIDENT_DRILL_TITLE?
          'CONTROLLED DRILL — This test issue is not a real Preview outage.\n\nRun: '+run:
          'The scheduled credential-free Preview endpoint monitor failed twice.\n\nRun: '+run)+
          '\n\nCheck Preview routing, expected HTTP 401/400/401 responses, and Vercel runtime logs. '+
          'This probe does NOT validate real Telegram sessions, database transactions or production. '+
          'Do not paste secrets into this issue.'
      });
      return {action:'opened',issueNumber:created?.number??null};
    }
    const assigned=(current.assignees??[]).some(a=>a.login===assignee);
    if(!assigned){
      const users=[...new Set([...(current.assignees??[]).map(a=>a.login).filter(Boolean),assignee])];
      await request('/issues/'+current.number,'PATCH',{assignees:users});
      return {action:'assigned',issueNumber:current.number};
    }
    return {action:'existing',issueNumber:current.number};
  }
  if(!current)return {action:'healthy',issueNumber:null};
  await request('/issues/'+current.number+'/comments','POST',{
    body:(title===PREVIEW_INCIDENT_DRILL_TITLE?'CONTROLLED DRILL completed. Run: ':'Credential-free Preview endpoints recovered. Passing run: ')+run+
      '\nAuthenticated gameplay and database readiness remain separate checks.'
  });
  await request('/issues/'+current.number,'PATCH',{state:'closed'});
  return {action:'closed',issueNumber:current.number};
}
