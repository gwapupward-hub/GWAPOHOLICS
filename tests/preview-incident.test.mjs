import test from 'node:test';
import assert from 'node:assert/strict';
import {PREVIEW_INCIDENT_TITLE,PREVIEW_INCIDENT_DRILL_TITLE,syncPreviewIncident} from '../scripts/preview-incident.mjs';

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

test('controlled DRILL opens an assigned test-only issue and closes it without touching real incidents',async()=>{
  let openIssue=null;
  const calls=[];
  const fetchImpl=async(url,request)=>{
    const path=url.replace('https://api.github.com/repos/gwapupward-hub/GWAPOHOLICS','');
    const body=request.body?JSON.parse(request.body):null;
    calls.push({path,method:request.method,body});
    if(path==='/issues?state=open&per_page=100')return json(openIssue?[openIssue]:[]);
    if(path==='/issues'&&request.method==='POST'){
      openIssue={number:72,title:body.title,assignees:body.assignees.map(login=>({login}))};
      return json({number:72},201);
    }
    if(path==='/issues/72/comments'&&request.method==='POST')return json({id:9},201);
    if(path==='/issues/72'&&request.method==='PATCH'){
      openIssue=null;
      return json({number:72,state:'closed'});
    }
    throw Error('Unexpected drill call: '+path);
  };
  const shared={...defaults,title:PREVIEW_INCIDENT_DRILL_TITLE,fetchImpl};
  const opened=await syncPreviewIncident({...shared,state:'failure'});
  assert.deepEqual(opened,{action:'opened',issueNumber:72});
  assert.equal(calls[1].body.title,PREVIEW_INCIDENT_DRILL_TITLE);
  assert.deepEqual(calls[1].body.assignees,['gwapupward-hub']);
  assert.match(calls[1].body.body,/not a real Preview outage/i);
  assert.doesNotMatch(calls[1].body.body,/failed twice/);
  const closed=await syncPreviewIncident({...shared,state:'success'});
  assert.deepEqual(closed,{action:'closed',issueNumber:72});
  assert.equal(openIssue,null);
  assert.equal(calls.filter(x=>x.path==='/issues'&&x.method==='POST').length,1);
  assert.equal(calls.filter(x=>x.path==='/issues/72'&&x.method==='PATCH').length,1);
});

test('invalid issue title is rejected so drills cannot target unrelated incidents',async()=>{
  let hits=0;
  await assert.rejects(syncPreviewIncident({...defaults,title:'Customer outage',fetchImpl:async()=>{
    hits++;
    return json([]);
  }}),/Invalid Preview incident configuration/);
  assert.equal(hits,0);
});

test('fresh drill issue closes by canonical ID even when open-issues listing is stale',async()=>{
  const calls=[];
  const fetchImpl=async(url,opts)=>{
    const path=url.replace('https://api.github.com/repos/gwapupward-hub/GWAPOHOLICS','');
    calls.push({path,method:opts.method,body:opts.body&&JSON.parse(opts.body)});
    if(path==='/issues?state=open&per_page=100')return json([]); // stale even after POST
    if(path==='/issues'&&opts.method==='POST')return json({number:73},201);
    if(path==='/issues/73'&&opts.method==='GET')
      return json({number:73,title:PREVIEW_INCIDENT_DRILL_TITLE,state:'open',assignees:[{login:'gwapupward-hub'}]});
    if(path==='/issues/73/comments'&&opts.method==='POST')return json({id:11},201);
    if(path==='/issues/73'&&opts.method==='PATCH')return json({number:73,state:'closed'});
    throw Error('unexpected path '+path);
  };
  const shared={...defaults,title:PREVIEW_INCIDENT_DRILL_TITLE,fetchImpl};
  const first=await syncPreviewIncident({...shared,state:'failure'});
  assert.deepEqual(first,{action:'opened',issueNumber:73});
  const second=await syncPreviewIncident({...shared,state:'success',issueNumber:first.issueNumber});
  assert.deepEqual(second,{action:'closed',issueNumber:73});
  assert.deepEqual(calls.map(x=>[x.method,x.path]),[
    ['GET','/issues?state=open&per_page=100'],
    ['POST','/issues'],
    ['GET','/issues/73'],
    ['POST','/issues/73/comments'],
    ['PATCH','/issues/73']
  ]);
});

test('direct drill issue validation refuses to close an unrelated issue',async()=>{
  let writes=0;
  const fetchImpl=async(url,opts)=>{
    if(opts.method!=='GET'){writes++;return json({})}
    return json({number:73,title:PREVIEW_INCIDENT_TITLE,state:'open'});
  };
  await assert.rejects(syncPreviewIncident({...defaults,state:'success',
    title:PREVIEW_INCIDENT_DRILL_TITLE,issueNumber:73,fetchImpl}),/Drill issue identity or open state not verified/);
  assert.equal(writes,0);
});

test('canonical issue-ID recovery is never permitted for real incidents or failure actions',async()=>{
  for(const options of [
    {title:PREVIEW_INCIDENT_TITLE,state:'success',issueNumber:73},
    {title:PREVIEW_INCIDENT_DRILL_TITLE,state:'failure',issueNumber:73},
    {title:PREVIEW_INCIDENT_DRILL_TITLE,state:'success',issueNumber:-1}
  ]){
    let requests=0;
    await assert.rejects(syncPreviewIncident({...defaults,...options,fetchImpl:async()=>{
      requests++;return json([]);
    }}),/Invalid Preview incident configuration/);
    assert.equal(requests,0);
  }
});
