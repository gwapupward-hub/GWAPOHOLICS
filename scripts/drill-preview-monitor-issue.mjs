#!/usr/bin/env node
/**
 * Opt-in GitHub issue lifecycle drill.
 * Only touches a clearly labeled [DRILL] issue; never triggers a real outage.
 */
import {syncPreviewIncident,PREVIEW_INCIDENT_DRILL_TITLE} from './preview-incident.mjs';

if(process.env.GWAP_INCIDENT_DRILL_CONFIRM!=='PREVIEW_GITHUB_ONLY'){
  console.error('Explicit Preview-only drill confirmation required');
  process.exitCode=1;
}else{
  const options={
    token:process.env.GITHUB_TOKEN,
    repository:process.env.GITHUB_REPOSITORY,
    runId:process.env.GITHUB_RUN_ID,
    assignee:process.env.GWAP_MONITOR_ASSIGNEE,
    title:PREVIEW_INCIDENT_DRILL_TITLE
  };
  try{
    const opened=await syncPreviewIncident({...options,state:'failure'});
    if(!Number.isSafeInteger(opened.issueNumber)||opened.issueNumber<1){
      throw new Error('Drill issue creation was not confirmed');
    }
    // Resolve the issue by its canonical ID, not the eventually consistent
    // GitHub open-issues list immediately after creation.
    const closed=await syncPreviewIncident({...options,state:'success',issueNumber:opened.issueNumber});
    if(closed.action!=='closed'||closed.issueNumber!==opened.issueNumber){
      throw new Error('Drill issue closure was not confirmed');
    }
    console.log('Preview incident DRILL completed: issue #'+opened.issueNumber+' opened/assigned and closed');
  }catch(e){
    console.error('Preview incident DRILL failed:',e.message);
    process.exitCode=1;
  }
}
