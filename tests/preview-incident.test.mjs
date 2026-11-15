import test from 'node:test';
import assert from 'node:assert/strict';
import {PREVIEW_INCIDENT_TITLE,syncPreviewIncident} from '../scripts/preview-incident.mjs';

const defaults={
  state:'failure',repository:'gwapupward-hub/GWAPOHOLICS',
  runId:'43693865341',token:'test-only-never-real',assignee:'gwapupward-hub'
};
const json=(data,status=200)=>new Response(JSON.stringify(data),{
  status,headers:{'content-type':'application/json'}
});
const mock=(issues=[],options={})=>{
  const calls=[];
  const fetchImpl=async(url,request)=>{
    const path=url.replace('https://api.github.com/repos/gwapupward-hub/GWAPOHOLICS','');
    const payload=request.body===undefined?undefined:JSON.parse(request.body);
    calls.push({path,method:request.method,payload,auth:request.headers.Authorization});
    if(options.status)return json({message:'failure'},options.status);
    if(path==='/issues?state=open&per_page=100')return json(issues);
    if(path==='/issues'&&request.method==='POST')return json({number:88},201);
    if(path.endsWith('/comments')&&request.method==='POST')return json({id:99},201);
    if(request.method==='PATCH')return json({number:88,state:payload.state??'open'});
    throw Error('Unexpected mock request '+path);
  };
  return {calls,fetchImpl};
};

test('healthy Preview makes no GitHub issue writes',async()=>{
  const m=mock();
  const result=await syncPreviewIncident({...defaults,state:'success',fetchImpl:m.fetchImpl});
  assert.deepEqual(result,{action:'healthy',issueNumber:null});
  assert.deepEqual(m.calls.map(x=>x.method),['GET']);
});

test('first failure opens issue assigned to the verified notification recipient',async()=>{
  const m=mock();
  const result=await syncPreviewIncident({...defaults,fetchImpl:m.fetchImpl});
  assert.deepEqual(result,{action:'opened',issueNumber:88});
  assert.deepEqual(m.calls.map(x=>x.method),['GET','POST']);
  assert.equal(m.calls[1].path,'/issues');
  assert.equal(m.calls[1].payload.title,PREVIEW_INCIDENT_TITLE);
  assert.deepEqual(m.calls[1].payload.assignees,['gwapupward-hub']);
  assert.match(m.calls[1].payload.body,/actions\/runs\/43693865341/);
  assert.ok(m.calls.every(x=>x.auth==='Bearer test-only-never-real'));
});

test('ongoing failure does not duplicate assigned incident',async()=>{
  const existing={number:51,title:PREVIEW_INCIDENT_TITLE,assignees:[{login:'gwapupward-hub'}]};
  const m=mock([existing]);
  const result=await syncPreviewIncident({...defaults,fetchImpl:m.fetchImpl});
  assert.deepEqual(result,{action:'existing',issueNumber:51});
  assert.deepEqual(m.calls.map(x=>x.method),['GET']);
});

test('an existing unassigned incident is assigned without creating a duplicate',async()=>{
  const existing={number:51,title:PREVIEW_INCIDENT_TITLE,assignees:[{login:'other-maintainer'}]};
  const m=mock([existing]);
  const result=await syncPreviewIncident({...defaults,fetchImpl:m.fetchImpl});
  assert.deepEqual(result,{action:'assigned',issueNumber:51});
  assert.deepEqual(m.calls.map(x=>x.method),['GET','PATCH']);
  assert.equal(m.calls[1].path,'/issues/51');
  assert.deepEqual(m.calls[1].payload.assignees,['other-maintainer','gwapupward-hub']);
});

test('recovery comments and closes exactly the matching open incident',async()=>{
  const matching={number:51,title:PREVIEW_INCIDENT_TITLE,assignees:[{login:'gwapupward-hub'}]};
  const unrelated={number:52,title:'Unrelated issue'};
  const aPullRequest={number:40,title:PREVIEW_INCIDENT_TITLE,pull_request:{url:'https://example.com'}};
  const m=mock([unrelated,aPullRequest,matching]);
  const result=await syncPreviewIncident({...defaults,state:'success',fetchImpl:m.fetchImpl});
  assert.deepEqual(result,{action:'closed',issueNumber:51});
  assert.deepEqual(m.calls.map(x=>x.method),['GET','POST','PATCH']);
  assert.equal(m.calls[1].path,'/issues/51/comments');
  assert.equal(m.calls[2].path,'/issues/51');
  assert.deepEqual(m.calls[2].payload,{state:'closed'});
});

test('GitHub API failure fails closed and does not claim an incident was opened',async()=>{
  const m=mock([],{status:403});
  await assert.rejects(
    syncPreviewIncident({...defaults,fetchImpl:m.fetchImpl}),
    /GitHub issues API HTTP 403/
  );
  assert.deepEqual(m.calls.map(x=>x.method),['GET']);
});

test('missing assignee and invalid configuration prevent GitHub writes',async()=>{
  for(const fields of [
    {assignee:undefined},{assignee:'not valid'},
    {repository:'unknown'},{state:'unknown'},{runId:'bad'},{token:''}
  ]){
    let count=0;
    await assert.rejects(
      syncPreviewIncident({...defaults,...fields,fetchImpl:async()=>{count++;return json([])}}),
      /Invalid Preview incident configuration/
    );
    assert.equal(count,0);
  }
});
